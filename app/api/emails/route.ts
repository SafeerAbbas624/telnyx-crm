import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      )
    }

    // If user is a team member, check if they have access to this contact
    if (session.user.role === 'TEAM_USER') {
      const assignedContact = await prisma.contactAssignment.findFirst({
        where: {
          contactId: contactId,
          userId: session.user.id
        }
      })

      if (!assignedContact) {
        return NextResponse.json(
          { error: 'Forbidden - Contact not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Get emails for this contact from the correct table
    const emails = await prisma.emailMessage.findMany({
      where: {
        contactId: contactId
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        direction: true,
        subject: true,
        content: true,
        textContent: true,
        status: true,
        fromEmail: true,
        fromName: true,
        toEmails: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        createdAt: true,
      }
    })

    // Transform to match timeline format
    const transformedEmails = emails.map(email => ({
      id: email.id,
      direction: email.direction,
      subject: email.subject,
      content: email.content,
      body: email.textContent || email.content,
      html_body: email.content,
      status: email.status,
      timestamp: email.sentAt || email.createdAt,
      createdAt: email.createdAt,
      sentAt: email.sentAt,
      from_email: email.fromEmail,
      from_name: email.fromName,
      to_email: email.toEmails?.[0] || '',
      to_emails: email.toEmails,
      opened_at: email.openedAt,
      clicked_at: email.clickedAt,
      delivered_at: email.deliveredAt,
    }))

    return NextResponse.json(transformedEmails)
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}

// POST - Create new email
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contact_id, direction, to_email, from_email, subject, body: emailBody, status } = body

    if (!contact_id || !direction || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get a default email account for sending
    const emailAccount = await prisma.emailAccount.findFirst({
      where: { status: 'active' }
    })

    if (!emailAccount) {
      return NextResponse.json(
        { error: 'No email account configured' },
        { status: 400 }
      )
    }

    const email = await prisma.emailMessage.create({
      data: {
        contactId: contact_id,
        emailAccountId: emailAccount.id,
        sentBy: session.user.id,
        direction,
        fromEmail: from_email || emailAccount.emailAddress,
        fromName: emailAccount.displayName,
        toEmails: [to_email || ''],
        subject,
        content: emailBody,
        textContent: emailBody,
        status: status || 'sent',
        sentAt: new Date(),
      }
    })

    return NextResponse.json(email)
  } catch (error) {
    console.error('Error creating email:', error)
    return NextResponse.json(
      { error: 'Failed to create email' },
      { status: 500 }
    )
  }
}
