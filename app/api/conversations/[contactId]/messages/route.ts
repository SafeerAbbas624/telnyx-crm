import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build the query based on user role
    let whereClause: any = { id: params.contactId }

    // If user is a team member, only allow access to assigned contacts
    if (session.user.role === 'TEAM_MEMBER') {
      whereClause = {
        id: params.contactId,
        assignedUsers: {
          some: {
            userId: session.user.id
          }
        }
      }
    }

    // Get contact to find phone numbers
    const contact = await prisma.contact.findUnique({
      where: whereClause,
      select: {
        id: true,
        phone1: true,
        phone2: true,
        phone3: true,
      }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const phoneNumbers = [contact.phone1, contact.phone2, contact.phone3].filter(Boolean)

    // Get messages from both Message and TelnyxMessage tables
    const [genericMessages, telnyxMessages] = await Promise.all([
      // Get messages from generic Message table (used by team dashboard)
      prisma.message.findMany({
        where: {
          contact_id: params.contactId
        },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          direction: true,
          content: true,
          status: true,
          timestamp: true,
          phone_number: true,
          message_type: true,
          sent_by: true,
        }
      }),

      // Get messages from TelnyxMessage table (Telnyx-specific)
      prisma.telnyxMessage.findMany({
        where: {
          OR: [
            // Messages linked directly to contact
            { contactId: params.contactId },
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
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          direction: true,
          status: true,
          fromNumber: true,
          toNumber: true,
          createdAt: true,
          deliveredAt: true,
          readAt: true,
        }
      })
    ])

    console.log(`Admin messages for contact ${params.contactId}:`,
      `Generic: ${genericMessages.length}, Telnyx: ${telnyxMessages.length}`)

    // Combine and sort messages by timestamp
    const allMessages = [
      ...genericMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        status: msg.status,
        timestamp: msg.timestamp,
        fromNumber: msg.phone_number,
        toNumber: msg.phone_number,
        createdAt: msg.timestamp,
        deliveredAt: null,
        readAt: null,
        source: 'generic'
      })),
      ...telnyxMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        status: msg.status,
        timestamp: msg.createdAt,
        fromNumber: msg.fromNumber,
        toNumber: msg.toNumber,
        createdAt: msg.createdAt,
        deliveredAt: msg.deliveredAt,
        readAt: msg.readAt,
        source: 'telnyx'
      }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Apply pagination to combined results
    const messages = allMessages.slice(offset, offset + limit)

    // Mark inbound messages as read (only for TelnyxMessage table)
    const unreadTelnyxMessageIds = messages
      .filter(msg => msg.direction === 'inbound' && !msg.readAt && msg.source === 'telnyx')
      .map(msg => msg.id)

    if (unreadTelnyxMessageIds.length > 0) {
      await prisma.telnyxMessage.updateMany({
        where: { id: { in: unreadTelnyxMessageIds } },
        data: { readAt: new Date() }
      })

      // Update conversation unread count
      await prisma.conversation.updateMany({
        where: { contact_id: params.contactId },
        data: { unread_count: 0 }
      })
    }

    // Find the most recent outbound message to suggest default sender number
    const mostRecentOutboundMessage = messages
      .filter(msg => msg.direction === 'outbound')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    return NextResponse.json({
      messages,
      total: messages.length,
      hasMore: messages.length === limit,
      suggestedSenderNumber: mostRecentOutboundMessage?.fromNumber || null
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const body = await request.json()
    const { message, fromNumber } = body

    if (!message || !fromNumber) {
      return NextResponse.json(
        { error: 'Message and fromNumber are required' },
        { status: 400 }
      )
    }

    // Get contact phone number
    const contact = await prisma.contact.findUnique({
      where: { id: params.contactId },
      select: {
        phone1: true,
        phone2: true,
        phone3: true,
      }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const toNumber = contact.phone1 || contact.phone2 || contact.phone3
    if (!toNumber) {
      return NextResponse.json(
        { error: 'Contact has no phone number' },
        { status: 400 }
      )
    }

    // Send message via Telnyx
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/telnyx/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromNumber,
        toNumber,
        message,
        contactId: params.contactId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()

    // Update or create conversation
    await prisma.conversation.upsert({
      where: {
        contact_id_phone_number: {
          contact_id: params.contactId,
          phone_number: toNumber,
        }
      },
      update: {
        last_message_content: message,
        last_message_at: new Date(),
        last_message_direction: 'outbound',
        last_sender_number: fromNumber,
        message_count: { increment: 1 },
        updated_at: new Date(),
      },
      create: {
        contact_id: params.contactId,
        phone_number: toNumber,
        channel: 'sms',
        last_message_content: message,
        last_message_at: new Date(),
        last_message_direction: 'outbound',
        last_sender_number: fromNumber,
        message_count: 1,
        status: 'active',
        priority: 'normal',
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
