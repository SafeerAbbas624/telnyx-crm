import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all' // 'all', 'unread', 'read'
    const direction = searchParams.get('direction') || 'all' // 'all', 'inbound', 'outbound'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // For team members, only show conversations for assigned contacts
    let whereClause: any = {}
    let assignedContactIds: string[] = []

    if (!isAdmin) {
      // Get assigned contact IDs for team member
      const assignments = await prisma.contactAssignment.findMany({
        where: { userId },
        select: { contactId: true }
      })

      assignedContactIds = assignments.map(a => a.contactId)

      if (assignedContactIds.length === 0) {
        return NextResponse.json({
          conversations: [],
          total: 0,
          unread: 0,
          read: 0,
          hasMore: false
        })
      }

      whereClause.contact_id = {
        in: assignedContactIds
      }
    }

    // Add search filter if provided
    if (search) {
      whereClause.AND = [
        {
          OR: [
            {
              contact: {
                firstName: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              contact: {
                lastName: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              contact: {
                phone1: {
                  contains: search
                }
              }
            },
            {
              phone_number: {
                contains: search
              }
            }
          ]
        }
      ]

      // If team member, add the contact_id filter to the AND clause
      if (!isAdmin && assignedContactIds.length > 0) {
        whereClause.AND.push({
          contact_id: {
            in: assignedContactIds
          }
        })
        // Remove the top-level contact_id filter since it's now in AND
        delete whereClause.contact_id
      }
    }

    // Add conversation filter (read/unread)
    if (filter === 'unread') {
      whereClause.unread_count = { gt: 0 }
    } else if (filter === 'read') {
      whereClause.unread_count = 0
    }

    // Add direction filter
    if (direction !== 'all') {
      whereClause.last_message_direction = direction
    }

    // Add date filter
    if (startDate || endDate) {
      whereClause.last_message_at = {}
      if (startDate) {
        whereClause.last_message_at.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.last_message_at.lte = new Date(endDate)
      }
    }

    // Get conversations with contact details
    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            email1: true,
            llcName: true,
            propertyAddress: true,
            city: true,
            state: true
          }
        }
      },
      orderBy: [
        { last_message_at: 'desc' },
        { created_at: 'desc' }
      ],
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const total = await prisma.conversation.count({
      where: whereClause
    })

    // Get stats (unread and read counts) - build a stats where clause without the filter/direction filters
    let statsWhereClause: any = {}
    if (!isAdmin && assignedContactIds.length > 0) {
      statsWhereClause.contact_id = { in: assignedContactIds }
    }

    if (search) {
      statsWhereClause.AND = [
        {
          OR: [
            { contact: { firstName: { contains: search, mode: 'insensitive' } } },
            { contact: { lastName: { contains: search, mode: 'insensitive' } } },
            { contact: { phone1: { contains: search } } },
            { phone_number: { contains: search } }
          ]
        }
      ]

      // If team member, add the contact_id filter to the AND clause
      if (!isAdmin && assignedContactIds.length > 0) {
        statsWhereClause.AND.push({
          contact_id: {
            in: assignedContactIds
          }
        })
        // Remove the top-level contact_id filter since it's now in AND
        delete statsWhereClause.contact_id
      }
    }

    if (startDate || endDate) {
      if (!statsWhereClause.AND) {
        statsWhereClause.AND = []
      }
      statsWhereClause.AND.push({
        last_message_at: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) })
        }
      })
    }

    const unreadCount = await prisma.conversation.count({
      where: { ...statsWhereClause, unread_count: { gt: 0 } }
    })
    const readCount = await prisma.conversation.count({
      where: { ...statsWhereClause, unread_count: 0 }
    })

    // Transform the data to match expected format
    const transformedConversations = conversations.map(conv => ({
      id: conv.id,
      contactId: conv.contact_id,
      phoneNumber: conv.phone_number,
      channel: conv.channel,
      lastMessageContent: conv.last_message_content,
      lastMessageAt: conv.last_message_at?.toISOString(),
      lastMessageDirection: conv.last_message_direction,
      lastSenderNumber: conv.last_sender_number,
      messageCount: conv.message_count || 0,
      unreadCount: conv.unread_count || 0,
      isArchived: conv.is_archived || false,
      isStarred: conv.is_starred || false,
      contact: {
        id: conv.contact.id,
        firstName: conv.contact.firstName,
        lastName: conv.contact.lastName,
        phone1: conv.contact.phone1,
        email1: conv.contact.email1,
        llcName: conv.contact.llcName,
        propertyAddress: conv.contact.propertyAddress,
        city: conv.contact.city,
        state: conv.contact.state
      },
      createdAt: conv.created_at.toISOString(),
      updatedAt: conv.updated_at.toISOString()
    }))

    return NextResponse.json({
      conversations: transformedConversations,
      total,
      unread: unreadCount,
      read: readCount,
      hasMore: offset + limit < total,
      limit,
      offset
    })

  } catch (error) {
    console.error('Error fetching team conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
