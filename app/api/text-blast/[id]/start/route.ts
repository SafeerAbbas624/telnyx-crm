import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getBestPhoneNumber } from '@/lib/phone-utils'

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

    if (blast.status === 'running') {
      return NextResponse.json(
        { error: 'Text blast is already running' },
        { status: 400 }
      )
    }

    // Update blast status to running
    const updatedBlast = await prisma.textBlast.update({
      where: { id: params.id },
      data: {
        status: 'running',
        startedAt: new Date(),
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

async function processTextBlast(blastId: string) {
  try {
    const blast = await prisma.textBlast.findUnique({
      where: { id: blastId },
    })

    if (!blast || blast.status !== 'running') {
      return
    }

    const selectedContactIds = JSON.parse(blast.selectedContacts as string)
    const senderNumbers = JSON.parse(blast.senderNumbers as string)
    
    // Get contacts from database
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: selectedContactIds },
      },
    })

    // Start from current index (for resume functionality)
    for (let i = blast.currentIndex; i < contacts.length; i++) {
      // Check if blast is still running and not paused
      const currentBlast = await prisma.textBlast.findUnique({
        where: { id: blastId },
      })

      if (!currentBlast || currentBlast.status !== 'running' || currentBlast.isPaused) {
        break
      }

      const contact = contacts[i]
      const senderNumber = senderNumbers[i % senderNumbers.length]
      
      try {
        // Send SMS via Telnyx API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/telnyx/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromNumber: senderNumber.phoneNumber,
            toNumber: getBestPhoneNumber(contact),
            message: formatMessage(blast.message, contact),
            contactId: contact.id,
            blastId: blastId,
          }),
        })

        if (response.ok) {
          // Update sent count
          await prisma.textBlast.update({
            where: { id: blastId },
            data: {
              sentCount: { increment: 1 },
              currentIndex: i + 1,
            },
          })
        } else {
          // Update failed count
          await prisma.textBlast.update({
            where: { id: blastId },
            data: {
              failedCount: { increment: 1 },
              currentIndex: i + 1,
            },
          })
        }
      } catch (error) {
        console.error(`Error sending message to ${contact.phone1}:`, error)
        await prisma.textBlast.update({
          where: { id: blastId },
          data: {
            failedCount: { increment: 1 },
            currentIndex: i + 1,
          },
        })
      }

      // Apply delay between messages
      if (blast.delaySeconds > 0 && i < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, blast.delaySeconds * 1000))
      }
    }

    // Mark blast as completed
    await prisma.textBlast.update({
      where: { id: blastId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })

  } catch (error) {
    console.error('Error processing text blast:', error)
    await prisma.textBlast.update({
      where: { id: blastId },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    })
  }
}

function formatMessage(template: string, contact: any): string {
  return template
    .replace(/\{firstName\}/g, contact.firstName || '')
    .replace(/\{lastName\}/g, contact.lastName || '')
    .replace(/\{fullName\}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim())
    .replace(/\{email\}/g, contact.email1 || contact.email2 || contact.email3 || '')
    .replace(/\{phone\}/g, contact.phone1 || contact.phone2 || contact.phone3 || '')
    .replace(/\{llcName\}/g, contact.llcName || '')
    .replace(/\{propertyAddress\}/g, contact.propertyAddress || '')
}
