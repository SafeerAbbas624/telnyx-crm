import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Allow both team members and admins
    if (session.user.role !== 'TEAM_USER' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Only team members and admins can access team email conversations' },
        { status: 403 }
      )
    }

    const conversationId = params.id

    // Check if this is a synthetic ID (contactId-accountId format)
    const parts = conversationId.split('-')

    if (parts.length > 5) {
      // Synthetic ID format
      const contactId = parts.slice(0, 5).join('-')
      const accountId = parts.slice(5).join('-')

      console.log('Team synthetic ID detected:', { contactId, accountId })

      // Get contact and verify assignment
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email1: true,
          email2: true,
          email3: true,
          assignedUsers: {
            where: { userId: session.user.id }
          }
        }
      })

      if (!contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        )
      }

      // Check if contact is assigned (skip for admins)
      if (session.user.role === 'TEAM_USER' && !contact.assignedUsers.length) {
        return NextResponse.json(
          { error: 'Forbidden - Contact not assigned to you' },
          { status: 403 }
        )
      }

      // Get all messages for this contact and account
      const messages = await prisma.emailMessage.findMany({
        where: {
          contactId: contactId,
          emailAccountId: accountId
        },
        orderBy: {
          deliveredAt: 'asc'
        },
        select: {
          id: true,
          messageId: true,
          fromEmail: true,
          fromName: true,
          toEmails: true,
          ccEmails: true,
          bccEmails: true,
          subject: true,
          content: true,
          textContent: true,
          direction: true,
          status: true,
          deliveredAt: true,
          sentAt: true,
          openedAt: true,
          createdAt: true,
          updatedAt: true,
        }
      })

      // Mark inbound messages as read
      await prisma.emailMessage.updateMany({
        where: {
          contactId: contactId,
          emailAccountId: accountId,
          direction: 'inbound',
          openedAt: null
        },
        data: {
          openedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        messages: messages.map(message => ({
          id: message.id,
          messageId: message.messageId,
          from: message.fromEmail,
          fromName: message.fromName || message.fromEmail,
          to: message.toEmails,
          cc: message.ccEmails,
          bcc: message.bccEmails,
          subject: message.subject,
          content: message.content,
          textContent: message.textContent,
          direction: message.direction,
          isRead: !!message.openedAt,
          deliveredAt: message.deliveredAt,
          sentAt: message.sentAt,
          createdAt: message.createdAt,
        })),
        conversation: {
          id: conversationId,
          contact: contact,
          emailAddress: contact.email1 || contact.email2 || contact.email3 || '',
          message_count: messages.length
        }
      })
    }

    // Original logic for real conversation IDs (fallback)
    const conversation = await prisma.emailConversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: {
          include: {
            assignedUsers: {
              where: { userId: session.user.id }
            }
          }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check if the contact is assigned (skip for admins)
    if (session.user.role === 'TEAM_USER' && !conversation.contact?.assignedUsers.length) {
      return NextResponse.json(
        { error: 'Forbidden - Contact not assigned to you' },
        { status: 403 }
      )
    }

    // Get messages - use EmailMessage model
    const messages = await prisma.emailMessage.findMany({
      where: {
        OR: [
          {
            toEmails: {
              has: conversation.emailAddress
            }
          },
          {
            fromEmail: conversation.emailAddress
          }
        ]
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      messages: messages.map(message => ({
        id: message.id,
        subject: message.subject,
        content: message.content,
        from: message.fromEmail,
        fromName: message.fromName,
        to: message.toEmails,
        direction: message.direction,
        createdAt: message.createdAt,
        isRead: !!message.openedAt
      }))
    })

  } catch (error) {
    console.error('Error fetching email messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
