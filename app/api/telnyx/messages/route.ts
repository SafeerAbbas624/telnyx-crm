import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber'); // Contact's phone number
    const ourNumber = searchParams.get('ourNumber'); // Our Telnyx number (optional)
    const contactId = searchParams.get('contactId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!phoneNumber && !contactId) {
      return NextResponse.json(
        { error: 'Phone number or contact ID is required' },
        { status: 400 }
      );
    }

    // Build the where clause for finding messages
    let whereClause: any = {};

    if (phoneNumber) {
      // Get last 10 digits for matching
      const contactDigits = phoneNumber.replace(/\D/g, '').slice(-10);

      if (ourNumber) {
        // Filter for conversation between specific pair of numbers
        const ourDigits = ourNumber.replace(/\D/g, '').slice(-10);
        whereClause = {
          OR: [
            // Messages from us to contact
            {
              AND: [
                { fromNumber: { endsWith: ourDigits } },
                { toNumber: { endsWith: contactDigits } }
              ]
            },
            // Messages from contact to us
            {
              AND: [
                { fromNumber: { endsWith: contactDigits } },
                { toNumber: { endsWith: ourDigits } }
              ]
            }
          ],
        };
      } else {
        // Show all messages involving this contact
        whereClause = {
          OR: [
            { toNumber: { endsWith: contactDigits } },
            { fromNumber: { endsWith: contactDigits } },
          ],
        };
      }
    }

    if (contactId) {
      whereClause = {
        ...whereClause,
        contactId,
      };
    }

    // Fetch messages from database
    const messages = await prisma.telnyxMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        telnyxMessageId: true,
        content: true,
        direction: true,
        status: true,
        createdAt: true,
        fromNumber: true,
        toNumber: true,
        segments: true,
        contactId: true,
      },
    });

    // Return messages in chronological order (oldest first for display)
    const sortedMessages = messages.reverse();

    return NextResponse.json({
      messages: sortedMessages,
      total: messages.length,
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error?.message || error);
    console.error('Stack:', error?.stack);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

