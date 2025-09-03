import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    // For team members, only show conversations for assigned contacts
    let whereClause: any = {}
    
    if (!isAdmin) {
      // Get assigned contact IDs for team member
      const assignments = await prisma.contactAssignment.findMany({
        where: { userId },
        select: { contactId: true }
      })
      
      const assignedContactIds = assignments.map(a => a.contactId)
      
      if (assignedContactIds.length === 0) {
        return NextResponse.json({ 
          conversations: [],
          total: 0,
          hasMore: false
        })
      }
      
      whereClause.contact_id = {
        in: assignedContactIds
      }
    }

    // Add search filter if provided
    if (search) {
      whereClause.OR = [
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
