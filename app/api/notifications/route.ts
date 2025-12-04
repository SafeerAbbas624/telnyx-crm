import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where = {
      userId: session.user.id,
      ...(unreadOnly && { read: false }),
    }

    const [notifications, total] = await Promise.all([
      prisma.taskNotification.findMany({
        where,
        include: {
          activity: {
            include: {
              contact: true,
              createdBy: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.taskNotification.count({ where }),
    ])

    const unreadCount = await prisma.taskNotification.count({
      where: {
        userId: session.user.id,
        read: false,
      },
    })

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('[NOTIFICATIONS GET]', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        details: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications/:id - Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId, read } = body

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 })
    }

    const notification = await prisma.taskNotification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updated = await prisma.taskNotification.update({
      where: { id: notificationId },
      data: { read: read !== undefined ? read : !notification.read },
      include: {
        activity: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[NOTIFICATIONS PATCH]', error)
    return NextResponse.json(
      {
        error: 'Failed to update notification',
        details: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications/:id - Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 })
    }

    const notification = await prisma.taskNotification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.taskNotification.delete({
      where: { id: notificationId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[NOTIFICATIONS DELETE]', error)
    return NextResponse.json(
      {
        error: 'Failed to delete notification',
        details: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

