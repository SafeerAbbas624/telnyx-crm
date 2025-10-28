import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { last10Digits, formatPhoneNumberForTelnyx } from '@/lib/phone-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

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

    // FIX: Get ALL conversations first (without pagination), then deduplicate, then apply pagination
    // This ensures we don't return duplicates due to deduplication logic
    const allConversations = await prisma.conversation.findMany({
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
    })

    // FIX: Deduplicate FIRST (before pagination)
    const dedupedMap = new Map<string, any>()
    for (const c of allConversations) {
      const normalized = formatPhoneNumberForTelnyx(c.phone_number) || c.phone_number
      const key = `${c.contact_id}-${last10Digits(normalized) || normalized}`
      const existing = dedupedMap.get(key)
      if (!existing) {
        dedupedMap.set(key, c)
      } else {
        // Keep the one with the most recent activity
        const a = existing.last_message_at || existing.updated_at
        const b = c.last_message_at || c.updated_at
        if ((b ? new Date(b).getTime() : 0) > (a ? new Date(a).getTime() : 0)) {
          dedupedMap.set(key, c)
        }
      }
    }
    const deduped = Array.from(dedupedMap.values())

    // Now apply pagination to deduplicated list
    const paginatedConversations = deduped.slice(offset, offset + limit)

    // Get the latest messages for each conversation in this page
    const conversationsWithMessages = await Promise.all(
      paginatedConversations.map(async (conversation) => {
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

        // Skip conversations with no messages
        if (!latestMessage) {
          console.log(`Skipping conversation ${conversation.id} for contact ${conversation.contact_id} - no messages found`)
          // Also reset unread count if it exists
          if (conversation.unread_count > 0) {
            try {
              await prisma.conversation.update({
                where: { id: conversation.id },
                data: { unread_count: 0 }
              })
            } catch (error) {
              console.error('Error resetting unread count for conversation:', conversation.id, error)
            }
          }
          return null
        }

        return {
          ...conversation,
          lastMessage: latestMessage,
          hasUnread: conversation.unread_count > 0,
          // Show new message indicator if last message is inbound and recent
          isNewMessage: latestMessage?.direction === 'inbound' &&
                       latestMessage?.createdAt &&
                       new Date(latestMessage.createdAt).getTime() > Date.now() - (24 * 60 * 60 * 1000) // 24 hours
        }
      })
    )

    // Filter out null entries (conversations with no messages)
    const validConversations = conversationsWithMessages.filter(c => c !== null)

    return NextResponse.json({
      conversations: validConversations,
      total: deduped.length, // Total after deduplication
      limit,
      offset,
      hasMore: offset + limit < deduped.length
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
