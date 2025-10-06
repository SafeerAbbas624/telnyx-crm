import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check if EmailMessage model exists
    if (!prisma.emailMessage) {
      console.warn('EmailMessage model not available in Prisma client. Returning empty data.');
      return NextResponse.json({
        conversations: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const view = searchParams.get('view') || 'inbox'; // inbox, starred, archived, trash
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    if (!accountId) {
      return NextResponse.json({
        conversations: [],
        total: 0,
      });
    }

    // Get all messages for this email account, grouped by contact
    const messageWhere: any = {
      emailAccountId: accountId,
      contactId: { not: null }
    };

    // Get unique contact IDs that have messages with this account
    const contactIds = await prisma.emailMessage.findMany({
      where: messageWhere,
      select: { contactId: true },
      distinct: ['contactId']
    });

    if (contactIds.length === 0) {
      return NextResponse.json({
        conversations: [],
        total: 0,
        page,
        totalPages: 0,
      });
    }

    const uniqueContactIds = contactIds.map(m => m.contactId).filter((id): id is string => id !== null);

    // Build contact where clause with search
    const contactWhere: any = {
      id: { in: uniqueContactIds }
    };

    if (search) {
      contactWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email1: { contains: search, mode: 'insensitive' } },
        { email2: { contains: search, mode: 'insensitive' } },
        { email3: { contains: search, mode: 'insensitive' } },
        { llcName: { contains: search, mode: 'insensitive' } },
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
        email3: true,
        llcName: true,
      },
    });

    // For each contact, get their last message and stats
    const conversations = await Promise.all(
      contacts.map(async (contact) => {
        // Determine the contact's email address (use email1 as primary)
        const emailAddress = contact.email1 || contact.email2 || contact.email3 || '';

        // Get or create EmailConversation record
        let emailConversation = await prisma.emailConversation.findFirst({
          where: {
            contactId: contact.id,
            emailAddress: emailAddress
          }
        });

        // Create if doesn't exist
        if (!emailConversation) {
          emailConversation = await prisma.emailConversation.create({
            data: {
              contactId: contact.id,
              emailAddress: emailAddress,
              messageCount: 0,
              unreadCount: 0,
              isArchived: false,
              isStarred: false,
            }
          });
        }

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

        // Count unread messages (inbound messages without openedAt)
        const unreadCount = await prisma.emailMessage.count({
          where: {
            emailAccountId: accountId,
            contactId: contact.id,
            direction: 'inbound',
            openedAt: null
          }
        });

        // Get preview text (strip HTML and truncate)
        const previewText = lastMessage?.content
          ? lastMessage.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 100)
          : '';

        return {
          id: emailConversation.id,
          contact,
          emailAddress,
          isStarred: emailConversation.isStarred,
          isArchived: emailConversation.isArchived,
          deletedAt: emailConversation.deletedAt,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            subject: lastMessage.subject || 'No Subject',
            preview: previewText,
            sentAt: lastMessage.deliveredAt?.toISOString() || new Date().toISOString(),
            isRead: lastMessage.direction === 'outbound' || !!lastMessage.openedAt,
            direction: lastMessage.direction,
          } : null,
          messageCount: messageCount,
          unreadCount: unreadCount,
          hasUnread: unreadCount > 0,
        };
      })
    );

    // Filter conversations based on view
    let filteredConversations = conversations;

    if (view === 'starred') {
      filteredConversations = conversations.filter(c => c.isStarred && !c.deletedAt);
    } else if (view === 'archived') {
      filteredConversations = conversations.filter(c => c.isArchived && !c.deletedAt);
    } else if (view === 'trash') {
      filteredConversations = conversations.filter(c => c.deletedAt !== null);
    } else {
      // inbox: not archived, not deleted
      filteredConversations = conversations.filter(c => !c.isArchived && !c.deletedAt);
    }

    // Sort by unread count and last message time
    filteredConversations.sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      const aTime = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const bTime = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0;
      return bTime - aTime;
    });

    // Apply pagination
    const totalCount = filteredConversations.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedConversations = filteredConversations.slice(offset, offset + limit);

    return NextResponse.json({
      conversations: paginatedConversations,
      total: totalCount,
      page,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (error) {
    console.error('Error fetching email conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!prisma.emailConversation) {
      return NextResponse.json(
        { error: 'Email conversations not supported yet' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const { contactId, emailAddress } = body;

    if (!contactId || !emailAddress) {
      return NextResponse.json(
        { error: 'Contact ID and email address are required' },
        { status: 400 }
      );
    }

    // Check if conversation already exists
    const existingConversation = await prisma.emailConversation.findUnique({
      where: {
        contactId_emailAddress: {
          contactId,
          emailAddress,
        }
      }
    });

    if (existingConversation) {
      return NextResponse.json({
        success: true,
        conversation: existingConversation,
        message: 'Conversation already exists',
      });
    }

    const conversation = await prisma.emailConversation.create({
      data: {
        contactId,
        emailAddress,
        messageCount: 0,
        unreadCount: 0,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            email2: true,
            email3: true,
            llcName: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Error creating email conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create email conversation' },
      { status: 500 }
    );
  }
}
