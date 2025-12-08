import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: params.id },
      include: { emailAccount: true },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Email blast not found' },
        { status: 404 }
      )
    }

    if (blast.status !== 'paused') {
      return NextResponse.json(
        { error: 'Email blast is not paused' },
        { status: 400 }
      )
    }

    const updatedBlast = await prisma.emailBlast.update({
      where: { id: params.id },
      data: {
        status: 'running',
        isPaused: false,
        resumedAt: new Date(),
      },
    })

    // Resume the blast processing
    processEmailBlast(updatedBlast.id)

    return NextResponse.json({ blast: updatedBlast })
  } catch (error) {
    console.error('Error resuming email blast:', error)
    return NextResponse.json(
      { error: 'Failed to resume email blast' },
      { status: 500 }
    )
  }
}

async function processEmailBlast(blastId: string) {
  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: blastId },
      include: { emailAccount: true },
    })

    if (!blast || blast.status !== 'running') {
      return
    }

    const selectedContactIds = typeof blast.selectedContacts === 'string'
      ? JSON.parse(blast.selectedContacts)
      : blast.selectedContacts

    const contacts = await prisma.contact.findMany({
      where: { id: { in: selectedContactIds } },
      include: { properties: true },
    })

    const contactMap = new Map(contacts.map(c => [c.id, c]))
    const orderedContacts = selectedContactIds
      .map((id: string) => contactMap.get(id))
      .filter(Boolean)

    // Continue from current index
    for (let i = blast.currentIndex; i < orderedContacts.length; i++) {
      const currentBlast = await prisma.emailBlast.findUnique({
        where: { id: blastId },
        select: { status: true, isPaused: true }
      })

      if (!currentBlast || currentBlast.status !== 'running' || currentBlast.isPaused) {
        break
      }

      const contact = orderedContacts[i]
      const toEmail = contact.email1

      if (!toEmail) {
        await prisma.emailBlast.update({
          where: { id: blastId },
          data: { failedCount: { increment: 1 }, currentIndex: i + 1 },
        })
        continue
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: blast.emailAccountId,
            to: toEmail,
            subject: formatEmailTemplate(blast.subject, contact),
            body: formatEmailTemplate(blast.content, contact),
            contactId: contact.id,
          }),
        })

        if (response.ok) {
          await prisma.emailBlast.update({
            where: { id: blastId },
            data: { sentCount: { increment: 1 }, currentIndex: i + 1 },
          })
        } else {
          await prisma.emailBlast.update({
            where: { id: blastId },
            data: { failedCount: { increment: 1 }, currentIndex: i + 1 },
          })
        }
      } catch (error) {
        await prisma.emailBlast.update({
          where: { id: blastId },
          data: { failedCount: { increment: 1 }, currentIndex: i + 1 },
        })
      }

      if (blast.delayBetweenEmails > 0 && i < orderedContacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, blast.delayBetweenEmails * 1000))
      }
    }

    const finalBlast = await prisma.emailBlast.findUnique({
      where: { id: blastId },
    })
    if (finalBlast && finalBlast.status === 'running' && finalBlast.currentIndex >= orderedContacts.length) {
      await prisma.emailBlast.update({
        where: { id: blastId },
        data: { status: 'completed', completedAt: new Date() },
      })
    }
  } catch (error) {
    console.error('Error processing email blast:', error)
    await prisma.emailBlast.update({
      where: { id: blastId },
      data: { status: 'failed', completedAt: new Date() },
    })
  }
}

function formatEmailTemplate(template: string, contact: any): string {
  let result = template
  const replacements: Record<string, string> = {
    '{{firstName}}': contact.firstName || '',
    '{{lastName}}': contact.lastName || '',
    '{{fullName}}': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    '{{email}}': contact.email1 || '',
    '{{phone}}': contact.phone1 || '',
    '{{propertyAddress}}': contact.propertyAddress || '',
    '{{city}}': contact.city || '',
    '{{state}}': contact.state || '',
  }
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key, 'gi'), value)
  }
  return result
}

