import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check if EmailConversation model exists
    if (!prisma.emailConversation) {
      console.warn('EmailConversation model not available in Prisma client. Returning empty data.');
      return NextResponse.json({
        conversations: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause for search
    const where: any = {};
    
    if (search) {
      where.OR = [
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email1: { contains: search, mode: 'insensitive' } },
              { email2: { contains: search, mode: 'insensitive' } },
              { email3: { contains: search, mode: 'insensitive' } },
              { llcName: { contains: search, mode: 'insensitive' } },
            ]
          }
        },
        { emailAddress: { contains: search, mode: 'insensitive' } },
        { lastMessageContent: { contains: search, mode: 'insensitive' } },
      ];
    }

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
            email3: true,
            llcName: true,
          }
        }
      },
      orderBy: [
        { unreadCount: 'desc' },
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: limit,
      skip: offset,
    });

    // Transform data to match frontend expectations
    const transformedConversations = conversations.map(conv => ({
      id: conv.id,
      contact: conv.contact,
      emailAddress: conv.emailAddress,
      lastMessage: conv.lastMessageContent ? {
        id: conv.lastMessageId || '',
        subject: conv.lastMessageContent,
        content: conv.lastMessageContent,
        direction: conv.lastMessageDirection || 'outbound',
        createdAt: conv.lastMessageAt?.toISOString() || new Date().toISOString(),
      } : null,
      last_message_at: conv.lastMessageAt?.toISOString(),
      last_message_content: conv.lastMessageContent,
      last_message_direction: conv.lastMessageDirection,
      message_count: conv.messageCount,
      unread_count: conv.unreadCount,
      hasUnread: conv.unreadCount > 0,
      isNewMessage: conv.lastMessageAt && 
        new Date().getTime() - new Date(conv.lastMessageAt).getTime() < 5 * 60 * 1000, // 5 minutes
    }));

    return NextResponse.json({
      conversations: transformedConversations,
      total: conversations.length,
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
