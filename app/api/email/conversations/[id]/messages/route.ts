import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Get the conversation first to verify it exists
    const conversation = await prisma.emailConversation.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            email2: true,
            email3: true,
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

    // Get all messages for this conversation
    const messages = await prisma.emailMessage.findMany({
      where: {
        OR: [
          {
            // Messages sent to this contact
            toEmails: {
              has: conversation.emailAddress
            }
          },
          {
            // Messages received from this contact
            fromEmail: conversation.emailAddress
          }
        ]
      },
      orderBy: {
        createdAt: 'asc' // Chronological order
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
        createdAt: true,
        updatedAt: true,
      }
    })

    // Update conversation unread count when messages are viewed
    if (messages.length > 0) {
      await prisma.emailConversation.update({
        where: { id },
        data: {
          unreadCount: 0
        }
      })
    }

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
        isRead: true, // Mark as read since we're viewing them
        createdAt: message.createdAt,
      })),
      conversation: {
        id: conversation.id,
        contact: conversation.contact,
        emailAddress: conversation.emailAddress,
        message_count: messages.length
      }
    })

  } catch (error) {
    console.error('Error fetching conversation messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
