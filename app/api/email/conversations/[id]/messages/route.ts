import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    // First, try to get the EmailConversation by ID
    const conversation = await prisma.emailConversation.findUnique({
      where: { id },
      include: {
        contact: true
      }
    })

    if (conversation && accountId) {
      // New format: using EmailConversation ID
      console.log('EmailConversation ID detected:', { conversationId: id, contactId: conversation.contactId, accountId })

      // Get all messages for this contact and account
      const messages = await prisma.emailMessage.findMany({
        where: {
          contactId: conversation.contactId,
          emailAccountId: accountId
        },
        orderBy: {
          deliveredAt: 'asc' // Chronological order
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
          contactId: conversation.contactId,
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
          fromEmail: message.fromEmail,
          fromName: message.fromName || message.fromEmail,
          toEmails: message.toEmails,
          ccEmails: message.ccEmails,
          bccEmails: message.bccEmails,
          subject: message.subject,
          content: message.content,
          textContent: message.textContent,
          direction: message.direction,
          status: message.status,
          deliveredAt: message.deliveredAt,
          sentAt: message.sentAt,
          openedAt: message.openedAt,
          createdAt: message.createdAt,
          attachments: [], // TODO: Add attachments support
        })),
      })
    }

    // If no conversation found or no accountId provided
    return NextResponse.json(
      { error: 'Conversation not found or accountId missing' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error fetching conversation messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
