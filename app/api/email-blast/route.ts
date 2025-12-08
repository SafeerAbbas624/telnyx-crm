import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const checkRunning = searchParams.get('checkRunning') === 'true'

    // If checking for running/paused blasts only
    if (checkRunning) {
      const activeBlast = await prisma.emailBlast.findFirst({
        where: {
          status: { in: ['running', 'paused'] }
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          subject: true,
          content: true,
          status: true,
          isPaused: true,
          sentCount: true,
          failedCount: true,
          totalContacts: true,
          currentIndex: true,
          selectedContacts: true,
          emailAccountId: true,
          delayBetweenEmails: true,
        },
      })
      return NextResponse.json({
        hasRunning: !!activeBlast,
        runningBlast: activeBlast
      })
    }

    const where = status ? { status: status as any } : {}

    const blasts = await prisma.emailBlast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    const blastsWithProgress = blasts.map(blast => ({
      ...blast,
      progress: blast.totalContacts > 0
        ? Math.round((blast.sentCount + blast.failedCount) / blast.totalContacts * 100)
        : 0,
    }))

    return NextResponse.json({ blasts: blastsWithProgress })
  } catch (error) {
    console.error('Error fetching email blasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email blasts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const {
      name,
      subject,
      content,
      emailAccountId,
      selectedContacts,
      delayBetweenEmails = 5,
      startIndex = 0,
    } = body

    if (!subject || !content || !emailAccountId || !selectedContacts?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if another blast is running
    const runningBlast = await prisma.emailBlast.findFirst({
      where: { status: 'running' },
      select: { id: true, name: true },
    })

    if (runningBlast) {
      return NextResponse.json({
        error: 'Another email blast is already running',
        runningBlast,
        requiresConfirmation: true,
      }, { status: 409 })
    }

    // Create the blast
    const blast = await prisma.emailBlast.create({
      data: {
        name: name || `Email Blast ${new Date().toLocaleString()}`,
        subject,
        content,
        emailAccountId,
        totalContacts: selectedContacts.length,
        selectedContacts: JSON.stringify(selectedContacts),
        delayBetweenEmails: delayBetweenEmails || 5,
        currentIndex: startIndex,
        status: 'running',
        startedAt: new Date(),
        createdBy: session?.user?.id || null,
      },
    })

    // Start processing in background
    processEmailBlast(blast.id)

    return NextResponse.json({ blast })
  } catch (error) {
    console.error('Error creating email blast:', error)
    return NextResponse.json(
      { error: 'Failed to create email blast' },
      { status: 500 }
    )
  }
}

// Process email blast in background
async function processEmailBlast(blastId: string) {
  let localSentCount = 0
  let localFailedCount = 0

  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: blastId },
      include: {
        emailAccount: true,
      },
    })

    if (!blast || blast.status !== 'running') {
      return
    }

    const selectedContactIds = typeof blast.selectedContacts === 'string'
      ? JSON.parse(blast.selectedContacts)
      : blast.selectedContacts

    // Get contacts from database
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: selectedContactIds },
      },
      include: {
        properties: true,
      },
    })

    // Create a map for O(1) lookup and maintain order
    const contactMap = new Map(contacts.map(c => [c.id, c]))
    const orderedContacts = selectedContactIds
      .map((id: string) => contactMap.get(id))
      .filter(Boolean)

    const totalContacts = orderedContacts.length
    console.log(`[EmailBlast ${blastId}] Starting from index ${blast.currentIndex}, total: ${totalContacts}`)

    // Start from current index (for resume functionality)
    for (let i = blast.currentIndex; i < totalContacts; i++) {
      // Check if blast is still running - check EVERY email for immediate pause response
      const currentBlast = await prisma.emailBlast.findUnique({
        where: { id: blastId },
        select: { status: true, isPaused: true }
      })

      if (!currentBlast || currentBlast.status !== 'running' || currentBlast.isPaused) {
        // Flush pending updates
        if (localSentCount > 0 || localFailedCount > 0) {
          await prisma.emailBlast.update({
            where: { id: blastId },
            data: {
              sentCount: { increment: localSentCount },
              failedCount: { increment: localFailedCount },
              currentIndex: i,
            },
          })
        }
        console.log(`[EmailBlast ${blastId}] Stopped at index ${i}`)
        return
      }

      const contact = orderedContacts[i]
      const toEmail = contact.email1

      // Skip contacts without email
      if (!toEmail) {
        localFailedCount++
        continue
      }

      try {
        // Send email via SMTP/nodemailer
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailAccountId: blast.emailAccountId,
            toEmails: [toEmail],
            subject: formatEmailTemplate(blast.subject, contact),
            content: formatEmailTemplate(blast.content, contact),
            contactId: contact.id,
            blastId: blast.id,
          }),
        })

        if (response.ok) {
          localSentCount++
        } else {
          localFailedCount++
          console.error(`[EmailBlast ${blastId}] Failed to send to ${toEmail}`)
        }
      } catch (error) {
        localFailedCount++
        console.error(`[EmailBlast ${blastId}] Error sending to ${toEmail}:`, error)
      }

      // Update database every message for real-time updates
      const updated = await prisma.emailBlast.update({
        where: { id: blastId },
        data: {
          sentCount: { increment: localSentCount },
          failedCount: { increment: localFailedCount },
          currentIndex: i + 1,
        },
      })
      localSentCount = 0
      localFailedCount = 0

      // Apply delay between emails
      if (blast.delayBetweenEmails > 0 && i < totalContacts - 1) {
        await new Promise(resolve => setTimeout(resolve, blast.delayBetweenEmails * 1000))
      }
    }

    // Mark as completed
    const finalBlast = await prisma.emailBlast.findUnique({
      where: { id: blastId },
      select: { status: true }
    })

    if (finalBlast && finalBlast.status === 'running') {
      await prisma.emailBlast.update({
        where: { id: blastId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          currentIndex: totalContacts,
        },
      })
      console.log(`[EmailBlast ${blastId}] Completed successfully`)
    }

  } catch (error) {
    console.error(`[EmailBlast ${blastId}] Fatal error:`, error)
    try {
      await prisma.emailBlast.update({
        where: { id: blastId },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      })
    } catch (updateError) {
      console.error(`[EmailBlast ${blastId}] Failed to update status:`, updateError)
    }
  }
}

// Format email template with contact variables
function formatEmailTemplate(template: string, contact: any): string {
  let result = template

  // Replace common variables
  const replacements: Record<string, string> = {
    '{{firstName}}': contact.firstName || '',
    '{{lastName}}': contact.lastName || '',
    '{{fullName}}': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    '{{email}}': contact.email1 || '',
    '{{phone}}': contact.phone1 || '',
    '{{propertyAddress}}': contact.propertyAddress || '',
    '{{city}}': contact.city || '',
    '{{state}}': contact.state || '',
    '{{zipCode}}': contact.zipCode || '',
    '{{llcName}}': contact.llcName || '',
  }

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key, 'gi'), value)
  }

  return result
}

