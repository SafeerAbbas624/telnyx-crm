import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET /api/tasks/workflows - Get user's workflows
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workflows = await prisma.taskWorkflow.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(workflows)
  } catch (error) {
    console.error('[WORKFLOWS GET]', error)
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
  }
}

// POST /api/tasks/workflows - Create workflow
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, trigger, condition, action, enabled } = body

    if (!name || !trigger || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const workflow = await prisma.taskWorkflow.create({
      data: {
        userId: session.user.id,
        name,
        trigger,
        condition: condition || null,
        action,
        enabled: enabled !== undefined ? enabled : true,
      },
    })

    return NextResponse.json(workflow)
  } catch (error) {
    console.error('[WORKFLOWS POST]', error)
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
  }
}

// PUT /api/tasks/workflows/:id - Update workflow
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workflowId, name, trigger, condition, action, enabled } = body

    if (!workflowId) {
      return NextResponse.json({ error: 'Missing workflowId' }, { status: 400 })
    }

    const workflow = await prisma.taskWorkflow.findUnique({
      where: { id: workflowId },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (workflow.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updated = await prisma.taskWorkflow.update({
      where: { id: workflowId },
      data: {
        name: name || workflow.name,
        trigger: trigger || workflow.trigger,
        condition: condition !== undefined ? condition : workflow.condition,
        action: action || workflow.action,
        enabled: enabled !== undefined ? enabled : workflow.enabled,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[WORKFLOWS PUT]', error)
    return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
  }
}

// DELETE /api/tasks/workflows/:id - Delete workflow
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workflowId } = body

    if (!workflowId) {
      return NextResponse.json({ error: 'Missing workflowId' }, { status: 400 })
    }

    const workflow = await prisma.taskWorkflow.findUnique({
      where: { id: workflowId },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (workflow.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.taskWorkflow.delete({
      where: { id: workflowId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WORKFLOWS DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 })
  }
}

