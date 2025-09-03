import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const emailAddress = searchParams.get('emailAddress');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    // Check if EmailMessage model exists
    if (!prisma.emailMessage) {
      console.warn('EmailMessage model not available in Prisma client. Returning empty data.');
      return NextResponse.json({
        messages: [],
        total: 0,
      });
    }

    // Build where clause
    const where: any = {
      contactId: contactId,
    };

    if (emailAddress) {
      where.OR = [
        { fromEmail: emailAddress },
        { toEmails: { has: emailAddress } },
      ];
    }

    // Get messages
    const messages = await prisma.emailMessage.findMany({
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
          }
        },
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          }
        }
      },
      orderBy: {
        deliveredAt: 'desc'
      },
      take: limit,
      skip: offset,
    });

    // Get total count
    const total = await prisma.emailMessage.count({ where });

    // Transform messages for frontend
    const transformedMessages = messages.map(message => ({
      id: message.id,
      messageId: message.messageId,
      subject: message.subject,
      content: message.content,
      textContent: message.textContent,
      fromEmail: message.fromEmail,
      fromName: message.fromName,
      toEmails: message.toEmails,
      ccEmails: message.ccEmails,
      bccEmails: message.bccEmails,
      direction: message.direction,
      status: message.status,
      isRead: !!message.openedAt, // If openedAt exists, it's read
      receivedAt: message.deliveredAt?.toISOString(), // For compatibility
      sentAt: message.sentAt?.toISOString(),
      deliveredAt: message.deliveredAt?.toISOString(),
      openedAt: message.openedAt?.toISOString(),
      contact: message.contact,
      emailAccount: message.emailAccount,
    }));

    return NextResponse.json({
      messages: transformedMessages,
      total,
    });
  } catch (error) {
    console.error('Error fetching email messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageIds, isRead } = body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return NextResponse.json(
        { error: 'Message IDs array is required' },
        { status: 400 }
      );
    }

    // Check if EmailMessage model exists
    if (!prisma.emailMessage) {
      return NextResponse.json(
        { error: 'Email messages not supported yet' },
        { status: 501 }
      );
    }

    // Update read status
    const updatedMessages = await prisma.emailMessage.updateMany({
      where: {
        id: { in: messageIds }
      },
      data: {
        openedAt: isRead !== false ? new Date() : null,
      }
    });

    // Update conversation unread count if marking as read
    if (isRead !== false) {
      // Get the conversations that need updating
      const messages = await prisma.emailMessage.findMany({
        where: { id: { in: messageIds } },
        select: { contactId: true, fromEmail: true }
      });

      // Update unread counts for affected conversations
      for (const message of messages) {
        await prisma.emailConversation?.updateMany({
          where: {
            contactId: message.contactId,
            emailAddress: message.fromEmail,
          },
          data: {
            unreadCount: {
              decrement: 1
            }
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedMessages.count,
    });
  } catch (error) {
    console.error('Error updating email messages:', error);
    return NextResponse.json(
      { error: 'Failed to update email messages' },
      { status: 500 }
    );
  }
}
