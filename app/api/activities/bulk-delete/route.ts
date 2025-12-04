import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth/next';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskIds } = await request.json();

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid taskIds' },
        { status: 400 }
      );
    }

    // Delete all tasks
    const deleted = await prisma.activity.deleteMany({
      where: {
        id: { in: taskIds }
      }
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      message: `Deleted ${deleted.count} tasks`
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { error: 'Failed to delete tasks' },
      { status: 500 }
    );
  }
}

