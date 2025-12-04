import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// This endpoint should be called by a cron job service (e.g., Vercel Cron, AWS Lambda, etc.)
// It sends reminders for tasks that are due soon

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a trusted cron service
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Find tasks due soon (within 1 hour)
    const dueSoonTasks = await prisma.activity.findMany({
      where: {
        type: 'task',
        status: { in: ['planned', 'in_progress'] },
        due_date: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        contact: true,
        createdBy: true,
        assignedToUser: true,
      },
    })

    // Find overdue tasks
    const overdueTasks = await prisma.activity.findMany({
      where: {
        type: 'task',
        status: { in: ['planned', 'in_progress'] },
        due_date: {
          lt: now,
        },
      },
      include: {
        contact: true,
        createdBy: true,
        assignedToUser: true,
      },
    })

    // Find tasks due today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dueTodayTasks = await prisma.activity.findMany({
      where: {
        type: 'task',
        status: { in: ['planned', 'in_progress'] },
        due_date: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        contact: true,
        createdBy: true,
        assignedToUser: true,
      },
    })

    // Create notifications for each task
    const notifications = []

    // Due soon notifications
    for (const task of dueSoonTasks) {
      if (task.assigned_to) {
        const notification = await prisma.taskNotification.create({
          data: {
            userId: task.assigned_to,
            activityId: task.id,
            type: 'due_soon',
            read: false,
          },
        }).catch(() => null)

        if (notification) notifications.push(notification)
      }
    }

    // Overdue notifications
    for (const task of overdueTasks) {
      if (task.assigned_to) {
        const notification = await prisma.taskNotification.create({
          data: {
            userId: task.assigned_to,
            activityId: task.id,
            type: 'overdue',
            read: false,
          },
        }).catch(() => null)

        if (notification) notifications.push(notification)
      }
    }

    // Due today notifications
    for (const task of dueTodayTasks) {
      if (task.assigned_to) {
        const notification = await prisma.taskNotification.create({
          data: {
            userId: task.assigned_to,
            activityId: task.id,
            type: 'due_today',
            read: false,
          },
        }).catch(() => null)

        if (notification) notifications.push(notification)
      }
    }

    return NextResponse.json({
      success: true,
      dueSoon: dueSoonTasks.length,
      overdue: overdueTasks.length,
      dueToday: dueTodayTasks.length,
      notificationsCreated: notifications.length,
    })
  } catch (error) {
    console.error('Error in task reminders cron:', error)
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    )
  }
}

