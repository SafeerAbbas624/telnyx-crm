import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET /api/tasks/reminders - Get pending reminders for user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    // Get tasks due soon (within 1 hour)
    const dueSoonTasks = await prisma.activity.findMany({
      where: {
        assigned_to: session.user.id,
        status: { in: ['planned', 'in_progress'] },
        due_date: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        contact: true,
        createdBy: true,
      },
    })

    // Get overdue tasks
    const overdueTasks = await prisma.activity.findMany({
      where: {
        assigned_to: session.user.id,
        status: { in: ['planned', 'in_progress'] },
        due_date: {
          lt: now,
        },
      },
      include: {
        contact: true,
      },
    })

    // Get tasks due today
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const dueTodayTasks = await prisma.activity.findMany({
      where: {
        assigned_to: session.user.id,
        status: { in: ['planned', 'in_progress'] },
        due_date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        contact: true,
      },
    })

    return NextResponse.json({
      dueSoon: dueSoonTasks,
      overdue: overdueTasks,
      dueToday: dueTodayTasks,
      count: dueSoonTasks.length + overdueTasks.length,
    })
  } catch (error) {
    console.error('[REMINDERS]', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

// POST /api/tasks/reminders - Send reminders
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId, type } = body

    if (!taskId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get task
    const task = await prisma.activity.findUnique({
      where: { id: taskId },
      include: {
        contact: true,
        createdBy: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get assigned user
    const assignedUser = await prisma.user.findUnique({
      where: { id: task.assigned_to || session.user.id },
    })

    if (!assignedUser?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Create notification
    const notification = await prisma.taskNotification.create({
      data: {
        userId: assignedUser.id,
        activityId: taskId,
        type,
        read: false,
      },
    })

    // Note: Email sending can be integrated with services like SendGrid, Mailgun, etc.
    // For now, we're just creating the notification in the database

    return NextResponse.json({ notification, success: true })
  } catch (error) {
    console.error('[REMINDERS POST]', error)
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 })
  }
}

