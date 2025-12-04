import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId, assignedToUserId } = await request.json();

    if (!taskId || !assignedToUserId) {
      return NextResponse.json(
        { error: 'Task ID and assigned user ID are required' },
        { status: 400 }
      );
    }

    // Verify task exists
    const task = await prisma.activity.findUnique({
      where: { id: taskId },
      include: { contact: true }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify assigned user exists
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToUserId }
    });

    if (!assignedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update task assignment
    const updatedTask = await prisma.activity.update({
      where: { id: taskId },
      data: { assigned_to: assignedToUserId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            phone1: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json(
      { error: 'Failed to assign task' },
      { status: 500 }
    );
  }
}

