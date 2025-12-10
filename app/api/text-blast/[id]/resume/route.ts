import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { formatMessageTemplate } from '@/lib/message-template'
import { getBestPhoneNumber } from '@/lib/phone-utils'
import { sendTextBlastSms } from '@/lib/text-blast-service'
import { broadcast } from '@/lib/server-events'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blast = await prisma.textBlast.findUnique({
      where: { id: params.id },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Text blast not found' },
        { status: 404 }
      )
    }

    // Allow resuming from paused OR cancelled status
    const resumableStatuses = ['paused', 'cancelled']
    if (!resumableStatuses.includes(blast.status)) {
      return NextResponse.json(
        { error: `Text blast cannot be resumed from "${blast.status}" status. Must be paused or cancelled.` },
        { status: 400 }
      )
    }

    // Check if there are still contacts to process
    const selectedContacts = JSON.parse(blast.selectedContacts as string) || []
    if (blast.currentIndex >= selectedContacts.length) {
      return NextResponse.json(
        { error: 'Text blast already completed - no more contacts to process' },
        { status: 400 }
      )
    }

    const remaining = selectedContacts.length - blast.currentIndex
    console.log(`[TextBlast Resume] Resuming blast ${params.id} from index ${blast.currentIndex}, ${remaining} contacts remaining`)

    const updatedBlast = await prisma.textBlast.update({
      where: { id: params.id },
      data: {
        status: 'running',
        isPaused: false,
        resumedAt: new Date(),
      },
    })

    // Resume the blast processing
    processTextBlast(updatedBlast.id)

    return NextResponse.json({
      blast: updatedBlast,
      message: `Resuming blast - ${remaining} contacts remaining`
    })
  } catch (error) {
    console.error('Error resuming text blast:', error)
    return NextResponse.json(
      { error: 'Failed to resume text blast' },
      { status: 500 }
    )
  }
}

async function processTextBlast(blastId: string) {
  let localSentCount = 0
  let localFailedCount = 0

  try {
    const blast = await prisma.textBlast.findUnique({
      where: { id: blastId },
    })

    if (!blast || blast.status !== 'running') {
      return
    }

    const selectedContactIds = JSON.parse(blast.selectedContacts as string)
    const senderNumbers = JSON.parse(blast.senderNumbers as string)

    // Get contacts from database with properties
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: selectedContactIds },
      },
      include: {
        properties: true,
      },
    })

    // CRITICAL: Preserve original order from selectedContactIds
    const contactMap = new Map(contacts.map(c => [c.id, c]))
    const orderedContacts = selectedContactIds
      .map((id: string) => contactMap.get(id))
      .filter(Boolean)

    const totalContacts = orderedContacts.length
    console.log(`[TextBlast Resume ${blastId}] Resuming from index ${blast.currentIndex}, total: ${totalContacts}`)

    // Continue from current index
    for (let i = blast.currentIndex; i < totalContacts; i++) {
      // Check if blast is still running and not paused
      const currentBlast = await prisma.textBlast.findUnique({
        where: { id: blastId },
        select: { status: true, isPaused: true }
      })

      if (!currentBlast || currentBlast.status !== 'running' || currentBlast.isPaused) {
        // Flush pending updates before stopping
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
        console.log(`[TextBlast Resume ${blastId}] Stopped at index ${i}`)
        return
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
        // Send SMS directly via Telnyx API (same as start route)
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
          console.error(`[TextBlast Resume ${blastId}] Failed to send to ${toNumber}: ${result.error}`)
        }
      } catch (error) {
        localFailedCount++
        console.error(`[TextBlast Resume ${blastId}] Error sending to ${toNumber}:`, error)
      }

      // Update database and broadcast after each message
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

      // Reset local counters after DB update
      localSentCount = 0
      localFailedCount = 0

      // Apply delay between messages
      if (blast.delaySeconds > 0 && i < totalContacts - 1) {
        await new Promise(resolve => setTimeout(resolve, blast.delaySeconds * 1000))
      }
    }

    // Mark as completed after successful finish
    const finalBlast = await prisma.textBlast.findUnique({
      where: { id: blastId },
    })
    if (finalBlast && finalBlast.status === 'running') {
      await prisma.textBlast.update({
        where: { id: blastId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })

      // Broadcast completion
      broadcast('text-blast:progress', {
        blastId,
        sentCount: finalBlast.sentCount,
        failedCount: finalBlast.failedCount,
        currentIndex: finalBlast.currentIndex,
        totalContacts: finalBlast.totalContacts,
        status: 'completed',
      })

      console.log(`[TextBlast Resume ${blastId}] Completed successfully`)
    }

  } catch (error) {
    console.error(`[TextBlast Resume ${blastId}] Fatal error:`, error)
    await prisma.textBlast.update({
      where: { id: blastId },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    })
  }
}


