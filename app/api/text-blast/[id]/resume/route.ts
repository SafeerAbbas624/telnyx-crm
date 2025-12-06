import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { formatMessageTemplate } from '@/lib/message-template'

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

    if (blast.status !== 'paused') {
      return NextResponse.json(
        { error: 'Text blast is not paused' },
        { status: 400 }
      )
    }

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

    return NextResponse.json({ blast: updatedBlast })
  } catch (error) {
    console.error('Error resuming text blast:', error)
    return NextResponse.json(
      { error: 'Failed to resume text blast' },
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
    
    // Get contacts from database with properties
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: selectedContactIds },
      },
      include: {
        properties: true,
      },
    })

    // Continue from current index
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
            toNumber: contact.phone1 || contact.phone2 || contact.phone3,
            message: formatMessageTemplate(blast.message, contact),
            contactId: contact.id,
            blastId: blastId,
          }),
        })

        if (response.ok) {
          await prisma.textBlast.update({
            where: { id: blastId },
            data: {
              sentCount: { increment: 1 },
              currentIndex: i + 1,
            },
          })
        } else {
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

    // After loop, only mark as completed if we've actually finished and not paused/stopped
    const finalBlast = await prisma.textBlast.findUnique({
      where: { id: blastId },
    })
    if (finalBlast && finalBlast.status === 'running' && (finalBlast.currentIndex >= contacts.length)) {
      await prisma.textBlast.update({
        where: { id: blastId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })
    }

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


