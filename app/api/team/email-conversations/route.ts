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

    // Check if EmailMessage model exists
    if (!prisma.emailMessage) {
      console.warn('EmailMessage model not available in Prisma client. Returning empty data.')
      return NextResponse.json({
        conversations: [],
      })
    }

    // Get unique contact IDs that have messages with this account
    const contactIds = await prisma.emailMessage.findMany({
      where: {
        emailAccountId: accountId,
        contactId: {
          in: assignedContactIds,
          not: null
        }
      },
      select: { contactId: true },
      distinct: ['contactId']
    });

    if (contactIds.length === 0) {
      return NextResponse.json({
        conversations: [],
        total: 0
      });
    }

    const uniqueContactIds = contactIds.map(m => m.contactId).filter((id): id is string => id !== null);

    // Build where clause for contacts
    const contactWhere: any = {
      id: { in: uniqueContactIds }
    };

    if (search) {
      contactWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email1: { contains: search, mode: 'insensitive' } },
        { email2: { contains: search, mode: 'insensitive' } },
        { email3: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get contacts
    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email1: true,
        email2: true,
        email3: true
      },
      take: limit,
      skip: offset,
    });

    // For each contact, get their last message and stats
    const conversations = await Promise.all(
      contacts.map(async (contact) => {
        // Get last message for this contact
        const lastMessage = await prisma.emailMessage.findFirst({
          where: {
            emailAccountId: accountId,
            contactId: contact.id
          },
          orderBy: { deliveredAt: 'desc' },
          select: {
            id: true,
            subject: true,
            content: true,
            direction: true,
            deliveredAt: true,
            openedAt: true
          }
        });

        // Count messages
        const messageCount = await prisma.emailMessage.count({
          where: {
            emailAccountId: accountId,
            contactId: contact.id
          }
        });

        // Count unread messages
        const unreadCount = await prisma.emailMessage.count({
          where: {
            emailAccountId: accountId,
            contactId: contact.id,
            direction: 'inbound',
            openedAt: null
          }
        });

        const emailAddress = contact.email1 || contact.email2 || contact.email3 || '';

        return {
          id: `${contact.id}-${accountId}`,
          contact,
          emailAddress,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            subject: lastMessage.subject || 'No Subject',
            content: lastMessage.content,
            direction: lastMessage.direction,
            createdAt: lastMessage.deliveredAt?.toISOString() || new Date().toISOString()
          } : undefined,
          messageCount,
          unreadCount,
          hasUnread: unreadCount > 0
        };
      })
    );

    // Sort by unread and last message time
    conversations.sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      conversations,
      total: conversations.length
    })

  } catch (error) {
    console.error('Error fetching team email conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
