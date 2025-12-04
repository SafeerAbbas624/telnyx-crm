import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET /api/task-templates - Get user's task templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.taskTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('[TEMPLATES GET]', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/task-templates - Create template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, type, priority, durationMinutes, reminderMinutes, tags } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const template = await prisma.taskTemplate.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        type,
        priority: priority || 'medium',
        durationMinutes: durationMinutes || null,
        reminderMinutes: reminderMinutes || null,
        tags: tags || [],
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('[TEMPLATES POST]', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

// PUT /api/task-templates/:id - Update template
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, name, description, type, priority, durationMinutes, reminderMinutes, tags } = body

    if (!templateId) {
      return NextResponse.json({ error: 'Missing templateId' }, { status: 400 })
    }

    const template = await prisma.taskTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updated = await prisma.taskTemplate.update({
      where: { id: templateId },
      data: {
        name: name || template.name,
        description: description !== undefined ? description : template.description,
        type: type || template.type,
        priority: priority || template.priority,
        durationMinutes: durationMinutes !== undefined ? durationMinutes : template.durationMinutes,
        reminderMinutes: reminderMinutes !== undefined ? reminderMinutes : template.reminderMinutes,
        tags: tags || template.tags,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[TEMPLATES PUT]', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE /api/task-templates/:id - Delete template
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId } = body

    if (!templateId) {
      return NextResponse.json({ error: 'Missing templateId' }, { status: 400 })
    }

    const template = await prisma.taskTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.taskTemplate.delete({
      where: { id: templateId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[TEMPLATES DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}

