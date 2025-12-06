import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for creating a scheduled message
const createScheduledMessageSchema = z.object({
  channel: z.enum(['SMS', 'EMAIL']),
  contactId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  // SMS-specific
  fromNumber: z.string().optional(),
  toNumber: z.string().optional(),
  // Email-specific
  fromEmail: z.string().email().optional(),
  toEmail: z.string().email().optional(),
  subject: z.string().optional(),
  // Body (required for all)
  body: z.string().min(1, 'Message body is required'),
  // Optional metadata
  metadata: z.record(z.any()).optional(),
}).refine((data) => {
  // SMS requires fromNumber and toNumber
  if (data.channel === 'SMS') {
    return !!data.fromNumber && !!data.toNumber;
  }
  // Email requires fromEmail, toEmail, and subject
  if (data.channel === 'EMAIL') {
    return !!data.fromEmail && !!data.toEmail && !!data.subject;
  }
  return false;
}, {
  message: 'SMS requires fromNumber and toNumber. Email requires fromEmail, toEmail, and subject.',
});

// POST /api/scheduled-messages - Create a new scheduled message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createScheduledMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate scheduledAt is at least 1 minute in the future
    const scheduledAt = new Date(data.scheduledAt);
    const minScheduleTime = new Date(Date.now() + 60 * 1000); // 1 minute buffer

    if (scheduledAt < minScheduleTime) {
      return NextResponse.json(
        { error: 'Scheduled time must be at least 1 minute in the future' },
        { status: 400 }
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Create the scheduled message
    const scheduledMessage = await prisma.scheduledMessage.create({
      data: {
        channel: data.channel,
        contactId: data.contactId,
        createdById: session.user.id,
        scheduledAt,
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        fromEmail: data.fromEmail,
        toEmail: data.toEmail,
        subject: data.subject,
        body: data.body,
        metadata: data.metadata || {},
        status: 'PENDING',
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            email1: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Message scheduled successfully',
      data: scheduledMessage,
    });
  } catch (error) {
    console.error('Error creating scheduled message:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled message' },
      { status: 500 }
    );
  }
}

// GET /api/scheduled-messages - List scheduled messages (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (contactId) {
      where.contactId = contactId;
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    const [messages, total] = await Promise.all([
      prisma.scheduledMessage.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone1: true,
              email1: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.scheduledMessage.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + messages.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled messages' },
      { status: 500 }
    );
  }
}

