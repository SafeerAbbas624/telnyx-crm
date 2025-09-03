import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build search conditions
    const searchConditions = search.trim() ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email1: { contains: search, mode: 'insensitive' as const } },
        { email2: { contains: search, mode: 'insensitive' as const } },
        { email3: { contains: search, mode: 'insensitive' as const } },
        { phone1: { contains: search } },
        { phone2: { contains: search } },
        { phone3: { contains: search } },
        { llcName: { contains: search, mode: 'insensitive' as const } },
      ]
    } : {}

    // Get conversations with contact info and last message
    const conversations = await prisma.conversation.findMany({
      where: {
        contact: searchConditions,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            phone1: true,
            llcName: true,
            propertyAddress: true,
          }
        }
      },
      orderBy: [
        { unread_count: 'desc' }, // Unread conversations first
        { last_message_at: 'desc' }, // Then by most recent message
        { updated_at: 'desc' }
      ],
      take: limit,
    })

    // Get the latest messages for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conversation) => {
        // Get the latest message for this contact
        const latestMessage = await prisma.telnyxMessage.findFirst({
          where: {
            OR: [
              { contactId: conversation.contact_id },
              { 
                AND: [
                  { toNumber: conversation.contact.phone1 },
                  { direction: 'outbound' }
                ]
              },
              {
                AND: [
                  { fromNumber: conversation.contact.phone1 },
                  { direction: 'inbound' }
                ]
              }
            ]
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            direction: true,
            status: true,
            fromNumber: true,
            toNumber: true,
            createdAt: true,
          }
        })

        return {
          ...conversation,
          lastMessage: latestMessage,
          // Calculate unread status based on latest message
          hasUnread: conversation.unread_count > 0,
          // Show new message indicator if last message is inbound and recent
          isNewMessage: latestMessage?.direction === 'inbound' && 
                       latestMessage?.createdAt && 
                       new Date(latestMessage.createdAt).getTime() > Date.now() - (24 * 60 * 60 * 1000) // 24 hours
        }
      })
    )

    return NextResponse.json({ 
      conversations: conversationsWithMessages,
      total: conversationsWithMessages.length 
    })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactId, phoneNumber } = body

    if (!contactId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Contact ID and phone number are required' },
        { status: 400 }
      )
    }

    // Create or update conversation
    const conversation = await prisma.conversation.upsert({
      where: {
        contact_id_phone_number: {
          contact_id: contactId,
          phone_number: phoneNumber,
        }
      },
      update: {
        updated_at: new Date(),
      },
      create: {
        contact_id: contactId,
        phone_number: phoneNumber,
        channel: 'sms',
        status: 'active',
        priority: 'normal',
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            phone1: true,
            company: true,
            propertyAddress: true,
          }
        }
      }
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
