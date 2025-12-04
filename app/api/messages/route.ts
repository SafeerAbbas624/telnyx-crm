import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
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

    // Get contact to find phone numbers
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
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

    // Get messages for this contact from TelnyxMessage table
    const messages = await prisma.telnyxMessage.findMany({
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
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
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
        cost: true,
        segments: true,
      }
    })

    // Transform to match timeline format
    const transformedMessages = messages.map(message => ({
      id: message.id,
      direction: message.direction,
      content: message.content,
      body: message.content, // alias for compatibility
      status: message.status,
      timestamp: message.createdAt,
      createdAt: message.createdAt,
      sentAt: message.createdAt,
      fromNumber: message.fromNumber,
      toNumber: message.toNumber,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      cost: message.cost,
      segments: message.segments,
    }))

    return NextResponse.json(transformedMessages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
