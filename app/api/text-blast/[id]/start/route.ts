import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getBestPhoneNumber } from '@/lib/phone-utils'
import { formatMessageTemplate } from '@/lib/message-template'
import { sendTextBlastSms } from '@/lib/text-blast-service'
import { broadcast } from '@/lib/server-events'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Parse request body for force start option
    let forceStart = false
    try {
      const body = await request.json()
      forceStart = body?.forceStart === true
    } catch {
      // No body or invalid JSON, use defaults
    }

    const blast = await prisma.textBlast.findUnique({
      where: { id: params.id },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Text blast not found' },
        { status: 404 }
      )
    }

    if (blast.status === 'running') {
      return NextResponse.json(
        { error: 'Text blast is already running' },
        { status: 400 }
      )
    }

    // Check if another blast is running (unless forceStart is true)
    if (!forceStart) {
      const runningBlast = await prisma.textBlast.findFirst({
        where: {
          status: 'running',
          id: { not: params.id } // Exclude current blast
        },
        select: { id: true, name: true, sentCount: true, totalContacts: true },
      })

      if (runningBlast) {
        return NextResponse.json({
          error: 'Another text blast is already running',
          runningBlast,
          requiresConfirmation: true,
        }, { status: 409 }) // 409 Conflict
      }
    }

    // Update blast status to running
    const updatedBlast = await prisma.textBlast.update({
      where: { id: params.id },
      data: {
        status: 'running',
        startedAt: blast.startedAt || new Date(), // Keep original start time if resuming
        isPaused: false,
        resumedAt: blast.status === 'paused' ? new Date() : null,
      },
    })

    // Start the blast processing in the background
    processTextBlast(updatedBlast.id)

    return NextResponse.json({ blast: updatedBlast })
  } catch (error) {
    console.error('Error starting text blast:', error)
    return NextResponse.json(
      { error: 'Failed to start text blast' },
      { status: 500 }
    )
  }
}

// Batch size for processing and status check interval
const BATCH_SIZE = 1 // Update DB and broadcast every message for real-time updates
const STATUS_CHECK_INTERVAL = 1 // Check pause/cancel status every message for responsive control

async function processTextBlast(blastId: string) {
  let localSentCount = 0
  let localFailedCount = 0
  let lastDbUpdate = 0

  try {
    const blast = await prisma.textBlast.findUnique({
      where: { id: blastId },
    })

    if (!blast || blast.status !== 'running') {
      return
    }

    const selectedContactIds = JSON.parse(blast.selectedContacts as string)
    const senderNumbers = JSON.parse(blast.senderNumbers as string)

    // Get contacts from database in proper order (include properties for template variables)
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: selectedContactIds },
      },
      include: {
        properties: true,
      },
    })

    // Create a map for O(1) lookup and maintain order from selectedContactIds
    const contactMap = new Map(contacts.map(c => [c.id, c]))
    const orderedContacts = selectedContactIds
      .map((id: string) => contactMap.get(id))
      .filter(Boolean) // Filter out any missing contacts

    const totalContacts = orderedContacts.length
    console.log(`[TextBlast ${blastId}] Starting from index ${blast.currentIndex}, total: ${totalContacts}`)

    // Start from current index (for resume functionality)
    for (let i = blast.currentIndex; i < totalContacts; i++) {
      // Periodic status check - don't query DB on every message
      if ((i - blast.currentIndex) % STATUS_CHECK_INTERVAL === 0 && i !== blast.currentIndex) {
        const currentBlast = await prisma.textBlast.findUnique({
          where: { id: blastId },
          select: { status: true, isPaused: true }
        })

        if (!currentBlast || currentBlast.status !== 'running' || currentBlast.isPaused) {
          // Flush any pending updates before stopping
          if (localSentCount > 0 || localFailedCount > 0) {
            await prisma.textBlast.update({
              where: { id: blastId },
              data: {
                sentCount: { increment: localSentCount },
                failedCount: { increment: localFailedCount },
                currentIndex: i,
              },
            })
          }
          console.log(`[TextBlast ${blastId}] Stopped at index ${i}`)
          return
        }
      }

      const contact = orderedContacts[i]
      const senderNumber = senderNumbers[i % senderNumbers.length]
      const toNumber = getBestPhoneNumber(contact)

      // Skip contacts without phone numbers
      if (!toNumber) {
        localFailedCount++
        continue
      }

      try {
        // Send SMS directly via Telnyx API (no session required)
        const result = await sendTextBlastSms(
          senderNumber.phoneNumber,
          toNumber,
          formatMessageTemplate(blast.message, contact),
          contact.id,
          blastId
        )

        if (result.success) {
          localSentCount++
        } else {
          localFailedCount++
          console.error(`[TextBlast ${blastId}] Failed to send to ${contact.phone1}: ${result.error}`)
        }
      } catch (error) {
        localFailedCount++
        console.error(`[TextBlast ${blastId}] Error sending to ${contact.phone1}:`, error)
      }

      // Batch update to database every BATCH_SIZE messages
      if ((localSentCount + localFailedCount) >= BATCH_SIZE) {
        const updated = await prisma.textBlast.update({
          where: { id: blastId },
          data: {
            sentCount: { increment: localSentCount },
            failedCount: { increment: localFailedCount },
            currentIndex: i + 1,
          },
        })

        // Broadcast real-time update
        broadcast('text-blast:progress', {
          blastId,
          sentCount: updated.sentCount,
          failedCount: updated.failedCount,
          currentIndex: updated.currentIndex,
          totalContacts: updated.totalContacts,
          status: updated.status,
        })

        lastDbUpdate = i + 1
        localSentCount = 0
        localFailedCount = 0
      }

      // Apply delay between messages
      if (blast.delaySeconds > 0 && i < totalContacts - 1) {
        await new Promise(resolve => setTimeout(resolve, blast.delaySeconds * 1000))
      }
    }

    // Flush any remaining updates
    if (localSentCount > 0 || localFailedCount > 0) {
      const updated = await prisma.textBlast.update({
        where: { id: blastId },
        data: {
          sentCount: { increment: localSentCount },
          failedCount: { increment: localFailedCount },
          currentIndex: totalContacts,
        },
      })

      // Broadcast final update before completion
      broadcast('text-blast:progress', {
        blastId,
        sentCount: updated.sentCount,
        failedCount: updated.failedCount,
        currentIndex: updated.currentIndex,
        totalContacts: updated.totalContacts,
        status: updated.status,
      })
    }

    // Mark as completed
    const finalBlast = await prisma.textBlast.findUnique({
      where: { id: blastId },
      select: { status: true, currentIndex: true }
    })

    if (finalBlast && finalBlast.status === 'running') {
      const completedBlast = await prisma.textBlast.update({
        where: { id: blastId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          currentIndex: totalContacts,
        },
      })

      // Broadcast completion
      broadcast('text-blast:completed', {
        blastId,
        sentCount: completedBlast.sentCount,
        failedCount: completedBlast.failedCount,
        totalContacts: completedBlast.totalContacts,
        status: 'completed',
      })

      console.log(`[TextBlast ${blastId}] Completed successfully`)
    }

  } catch (error) {
    console.error(`[TextBlast ${blastId}] Fatal error:`, error)

    // Try to save any pending progress before marking as failed
    try {
      await prisma.textBlast.update({
        where: { id: blastId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          sentCount: { increment: localSentCount },
          failedCount: { increment: localFailedCount },
        },
      })
    } catch (updateError) {
      console.error(`[TextBlast ${blastId}] Failed to update status:`, updateError)
    }
  }
}


