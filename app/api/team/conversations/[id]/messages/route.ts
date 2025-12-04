import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const conversationId = params.id

    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        contact: {
          assignments: {
            some: { userId }
          }
        }
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true
          }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 })
    }

    // Use the existing conversation data to get phone numbers
    const contactId = conversation.contact.id

    const phoneNumbers = [
      conversation.contact.phone1,
      conversation.contact.phone2,
      conversation.contact.phone3
    ].filter(Boolean)

    // Get messages from both Message and TelnyxMessage tables
    const [genericMessages, telnyxMessages] = await Promise.all([
      // Get messages from generic Message table (team dashboard messages)
      prisma.message.findMany({
        where: {
          conversation_id: conversationId
        },
        orderBy: {
          timestamp: 'asc'
        },
        select: {
          id: true,
          content: true,
          direction: true,
          timestamp: true,
          status: true,
          message_type: true,
          phone_number: true,
          media_urls: true,
          sent_by: true
        }
      }),

      // Get messages from TelnyxMessage table (existing messages)
      prisma.telnyxMessage.findMany({
        where: {
          OR: [
            // Messages linked directly to contact
            { contactId: contactId },
            // Outbound messages to contact's phone numbers
            {
              AND: [
                { direction: 'outbound' },
                { toNumber: { in: phoneNumbers } }
              ]
            },
            // Inbound messages from contact's phone numbers
            {
              AND: [
                { direction: 'inbound' },
                { fromNumber: { in: phoneNumbers } }
              ]
            }
          ]
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          id: true,
          content: true,
          direction: true,
          createdAt: true,
          status: true,
          fromNumber: true,
          toNumber: true,
          deliveredAt: true,
          readAt: true,
        }
      })
    ])

    console.log(`Team conversation ${conversationId} messages:`,
      `Generic: ${genericMessages.length}, Telnyx: ${telnyxMessages.length}`)

    // FIX: Mark all unread inbound messages as read
    await prisma.telnyxMessage.updateMany({
      where: {
        OR: [
          { contactId: contactId },
          {
            AND: [
              { direction: 'inbound' },
              { fromNumber: { in: phoneNumbers } }
            ]
          }
        ],
        direction: 'inbound',
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    })

    // Update conversation unread count
    const unreadCount = await prisma.telnyxMessage.count({
      where: {
        OR: [
          { contactId: contactId },
          {
            AND: [
              { direction: 'inbound' },
              { fromNumber: { in: phoneNumbers } }
            ]
          }
        ],
        direction: 'inbound',
        readAt: null
      }
    })

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unread_count: unreadCount }
    })

    // Combine and sort messages by timestamp
    const allMessages = [
      ...genericMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        timestamp: msg.timestamp,
        status: msg.status,
        type: msg.message_type,
        phoneNumber: msg.phone_number,
        mediaUrls: msg.media_urls,
        sentBy: msg.sent_by,
        isFromUser: msg.direction === 'outbound',
        source: 'generic'
      })),
      ...telnyxMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        timestamp: msg.createdAt,
        status: msg.status,
        type: 'sms',
        phoneNumber: msg.direction === 'outbound' ? msg.toNumber : msg.fromNumber,
        mediaUrls: [],
        sentBy: null,
        isFromUser: msg.direction === 'outbound',
        source: 'telnyx'
      }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Transform messages for frontend
    const transformedMessages = allMessages.map(message => ({
      id: message.id,
      content: message.content,
      direction: message.direction,
      timestamp: message.timestamp,
      status: message.status,
      type: message.type,
      phoneNumber: message.phoneNumber,
      mediaUrls: message.mediaUrls,
      sentBy: message.sentBy,
      isFromUser: message.isFromUser
    }))

    return NextResponse.json({
      messages: transformedMessages,
      conversation: {
        id: conversation.id,
        contact: conversation.contact
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
