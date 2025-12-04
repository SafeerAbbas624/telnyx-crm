import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeParam = searchParams.get('userId');

    // Build where clause
    const whereClause: any = {
      type: 'task',
    };

    // Determine which user's tasks to show
    if (user.role === 'ADMIN' && assigneeParam) {
      if (assigneeParam === 'all') {
        // All assigned tasks for this admin's org
        whereClause.assigned_to = { not: null };
      } else {
        // Specific team member
        whereClause.assigned_to = assigneeParam;
      }
    } else {
      // Default: current user's tasks
      whereClause.assigned_to = user.id;
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (priority && priority !== 'all') {
      whereClause.priority = priority;
    }

    // Fetch assigned tasks
    const tasks = await prisma.activity.findMany({
      where: whereClause,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            phone1: true,
            avatarUrl: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: [
        { due_date: 'asc' },
        { created_at: 'desc' }
      ]
    });

    // Transform to camelCase
    const transformedTasks = tasks.map((task: any) => ({
      id: task.id,
      contactId: task.contact_id,
      type: task.type,
      title: task.title,
      description: task.description,
      dueDate: task.due_date?.toISOString(),
      status: task.status,
      priority: task.priority,
      assignedTo: task.assigned_to,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
      contact: task.contact,
      assignedUser: task.assignedUser,
      replies: task.replies.map((r: any) => ({
        id: r.id,
        content: r.content,
        status: r.status,
        attachments: r.attachments,
        createdAt: r.createdAt.toISOString(),
        user: r.user
      }))
    }));

    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

