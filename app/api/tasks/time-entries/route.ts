import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET /api/tasks/time-entries?taskId=xxx - Get time entries for task
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }

    const timeEntries = await prisma.taskTimeEntry.findMany({
      where: { activityId: taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.minutes, 0)

    return NextResponse.json({
      timeEntries,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
    })
  } catch (error) {
    console.error('[TIME ENTRIES GET]', error)
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }
}

// POST /api/tasks/time-entries - Create time entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId, minutes, description } = body

    if (!taskId || !minutes) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (minutes <= 0) {
      return NextResponse.json({ error: 'Minutes must be greater than 0' }, { status: 400 })
    }

    // Verify task exists
    const task = await prisma.activity.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const timeEntry = await prisma.taskTimeEntry.create({
      data: {
        activityId: taskId,
        userId: session.user.id,
        minutes: parseInt(minutes),
        description: description || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(timeEntry)
  } catch (error) {
    console.error('[TIME ENTRIES POST]', error)
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
  }
}

// DELETE /api/tasks/time-entries/:id - Delete time entry
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { entryId } = body

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const entry = await prisma.taskTimeEntry.findUnique({
      where: { id: entryId },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.taskTimeEntry.delete({
      where: { id: entryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[TIME ENTRIES DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }
}

