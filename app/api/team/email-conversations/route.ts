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

    // Allow both team users and admins to access this endpoint
    if (session.user.role !== 'TEAM_USER' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: `Forbidden - Only team users and admins can access team email conversations. Your role: ${session.user.role}` },
        { status: 403 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      )
    }

    let assignedContactIds: string[] = []

    if (session.user.role === 'TEAM_USER') {
      console.log('Team member requesting email conversations:', userId, 'accountId:', accountId)

      // For team members, verify the email account is assigned to them
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { assignedEmailId: true }
      })

      console.log('User assigned email ID:', user?.assignedEmailId)

      if (!user || user.assignedEmailId !== accountId) {
        console.log('Email account not assigned to team member')
        return NextResponse.json(
          { error: 'Forbidden - Email account not assigned to you' },
          { status: 403 }
        )
      }

      // Get user's assigned contacts
      const assignments = await prisma.contactAssignment.findMany({
        where: { userId },
        select: { contactId: true }
      })

      assignedContactIds = assignments.map(a => a.contactId)

      // If no contacts assigned, return empty array
      if (assignedContactIds.length === 0) {
        return NextResponse.json({ conversations: [] })
      }
    } else if (session.user.role === 'ADMIN') {
      // For admins, get all contacts (no restriction)
      const allContacts = await prisma.contact.findMany({
        select: { id: true }
      })
      assignedContactIds = allContacts.map(c => c.id)
    }

    // Check if EmailConversation model exists
    if (!prisma.emailConversation) {
      console.warn('EmailConversation model not available in Prisma client. Returning empty data.')
      return NextResponse.json({
        conversations: [],
      })
    }
    // Build where clause for assigned contacts and search
    const where: any = {
      contactId: {
        in: assignedContactIds
      }
    }

    if (search) {
      where.AND = [
        where,
        {
          OR: [
            {
              contact: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { email1: { contains: search, mode: 'insensitive' } },
                  { email2: { contains: search, mode: 'insensitive' } },
                  { email3: { contains: search, mode: 'insensitive' } }
                ]
              }
            }
          ]
        }
      ]
    }

    // Get email conversations for assigned contacts filtered by email account
    const conversations = await prisma.emailConversation.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            email2: true,
            email3: true
          }
        },

      },
      orderBy: {
        lastMessageAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Transform the data to match admin Gmail component format
    const transformedConversations = conversations.map(conv => ({
      id: conv.id,
      contact: {
        id: conv.contact?.id || '',
        firstName: conv.contact?.firstName || '',
        lastName: conv.contact?.lastName || '',
        email1: conv.contact?.email1 || ''
      },
      emailAddress: conv.emailAddress,
      lastMessage: conv.lastMessageContent ? {
        id: conv.lastMessageId || '',
        subject: conv.lastMessageSubject || 'No Subject',
        content: conv.lastMessageContent,
        direction: conv.lastMessageDirection || 'inbound',
        createdAt: conv.lastMessageAt?.toISOString() || new Date().toISOString()
      } : undefined,
      messageCount: conv.messageCount || 0,
      unreadCount: conv.unreadCount || 0,
      hasUnread: (conv.unreadCount || 0) > 0
    }))

    return NextResponse.json({
      conversations: transformedConversations,
      total: transformedConversations.length
    })

  } catch (error) {
    console.error('Error fetching team email conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
