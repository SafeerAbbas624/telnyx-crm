import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET /api/tasks/dependencies?taskId=xxx - Get task dependencies
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

    const dependencies = await prisma.taskDependency.findMany({
      where: {
        OR: [
          { dependsOnId: taskId },
          { dependentId: taskId },
        ],
      },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
        dependent: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    })

    return NextResponse.json(dependencies)
  } catch (error) {
    console.error('[DEPENDENCIES GET]', error)
    return NextResponse.json({ error: 'Failed to fetch dependencies' }, { status: 500 })
  }
}

// POST /api/tasks/dependencies - Create dependency
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dependsOnId, dependentId, dependencyType } = body

    if (!dependsOnId || !dependentId || !dependencyType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (dependsOnId === dependentId) {
      return NextResponse.json({ error: 'Cannot create self-dependency' }, { status: 400 })
    }

    // Verify both tasks exist
    const [task1, task2] = await Promise.all([
      prisma.activity.findUnique({ where: { id: dependsOnId } }),
      prisma.activity.findUnique({ where: { id: dependentId } }),
    ])

    if (!task1 || !task2) {
      return NextResponse.json({ error: 'One or both tasks not found' }, { status: 404 })
    }

    // Check for existing dependency
    const existing = await prisma.taskDependency.findUnique({
      where: {
        dependsOnId_dependentId: {
          dependsOnId,
          dependentId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 400 })
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        dependsOnId,
        dependentId,
        dependencyType,
      },
      include: {
        dependsOn: true,
        dependent: true,
      },
    })

    return NextResponse.json(dependency)
  } catch (error) {
    console.error('[DEPENDENCIES POST]', error)
    return NextResponse.json({ error: 'Failed to create dependency' }, { status: 500 })
  }
}

// DELETE /api/tasks/dependencies/:id - Delete dependency
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dependencyId } = body

    if (!dependencyId) {
      return NextResponse.json({ error: 'Missing dependencyId' }, { status: 400 })
    }

    const dependency = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
    })

    if (!dependency) {
      return NextResponse.json({ error: 'Dependency not found' }, { status: 404 })
    }

    await prisma.taskDependency.delete({
      where: { id: dependencyId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DEPENDENCIES DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete dependency' }, { status: 500 })
  }
}

