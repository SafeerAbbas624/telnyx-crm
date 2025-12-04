import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth/next';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskIds, updates } = await request.json();

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid taskIds' },
        { status: 400 }
      );
    }

    // Update all tasks
    const updated = await prisma.activity.updateMany({
      where: {
        id: { in: taskIds }
      },
      data: updates
    });

    return NextResponse.json({
      success: true,
      updated: updated.count,
      message: `Updated ${updated.count} tasks`
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: 'Failed to update tasks' },
      { status: 500 }
    );
  }
}

