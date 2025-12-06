import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for updating a scheduled message
const updateScheduledMessageSchema = z.object({
  // Cancel the message
  status: z.enum(['CANCELED']).optional(),
  // Reschedule to a new time
  scheduledAt: z.string().datetime().optional(),
}).refine((data) => {
  return data.status || data.scheduledAt;
}, {
  message: 'Either status (CANCELED) or scheduledAt must be provided',
});

// GET /api/scheduled-messages/:id - Get a specific scheduled message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const scheduledMessage = await prisma.scheduledMessage.findUnique({
      where: { id },
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
    });

    if (!scheduledMessage) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: scheduledMessage,
    });
  } catch (error) {
    console.error('Error fetching scheduled message:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled message' },
      { status: 500 }
    );
  }
}

// PATCH /api/scheduled-messages/:id - Update (cancel or reschedule) a scheduled message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateScheduledMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Check if the message exists and is still PENDING
    const existingMessage = await prisma.scheduledMessage.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 });
    }

    if (existingMessage.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot modify a message with status: ${existingMessage.status}` },
        { status: 400 }
      );
    }

    const data = validation.data;
    const updateData: any = {};

    // Handle cancellation
    if (data.status === 'CANCELED') {
      updateData.status = 'CANCELED';
    }

    // Handle rescheduling
    if (data.scheduledAt) {
      const newScheduledAt = new Date(data.scheduledAt);
      const minScheduleTime = new Date(Date.now() + 60 * 1000); // 1 minute buffer

      if (newScheduledAt < minScheduleTime) {
        return NextResponse.json(
          { error: 'Scheduled time must be at least 1 minute in the future' },
          { status: 400 }
        );
      }

      updateData.scheduledAt = newScheduledAt;
    }

    const updatedMessage = await prisma.scheduledMessage.update({
      where: { id },
      data: updateData,
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
      message: data.status === 'CANCELED' ? 'Message canceled' : 'Message rescheduled',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('Error updating scheduled message:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled message' },
      { status: 500 }
    );
  }
}

// DELETE /api/scheduled-messages/:id - Delete a scheduled message (only if PENDING or CANCELED)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingMessage = await prisma.scheduledMessage.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 });
    }

    // Only allow deletion of PENDING or CANCELED messages
    if (!['PENDING', 'CANCELED'].includes(existingMessage.status)) {
      return NextResponse.json(
        { error: `Cannot delete a message with status: ${existingMessage.status}` },
        { status: 400 }
      );
    }

    await prisma.scheduledMessage.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled message deleted',
    });
  } catch (error) {
    console.error('Error deleting scheduled message:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled message' },
      { status: 500 }
    );
  }
}

