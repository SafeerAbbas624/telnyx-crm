import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for validating activity updates
const updateActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['planned', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().uuid().optional(),
  location: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reminderMinutes: z.number().int().positive().optional(),
  isAllDay: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  result: z.string().optional(),
  nextAction: z.string().optional(),
})

// GET /api/activities/[id] - Get a specific activity
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: params.id },
    })

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      )
    }

    // Transform database fields to match frontend types
    const transformedActivity = {
      id: activity.id,
      contactId: activity.contact_id,
      dealId: activity.deal_id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      dueDate: activity.due_date?.toISOString(),
      status: activity.status,
      priority: activity.priority,
      assignedTo: activity.assigned_to,
      location: activity.location,
      durationMinutes: activity.duration_minutes,
      reminderMinutes: activity.reminder_minutes,
      isAllDay: activity.is_all_day,
      isPinned: activity.is_pinned,
      completedAt: activity.completed_at?.toISOString(),
      completedBy: activity.completed_by,
      result: activity.result,
      nextAction: activity.next_action,
      createdAt: activity.created_at.toISOString(),
      updatedAt: activity.updated_at.toISOString(),
    }

    return NextResponse.json(transformedActivity)
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}

// PUT /api/activities/[id] - Update a specific activity
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate the request body
    const validatedData = updateActivitySchema.parse(body)

    // Prepare update data
    const updateData: any = {}
    
    if (validatedData.type !== undefined) updateData.type = validatedData.type
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.dueDate !== undefined) {
      updateData.due_date = validatedData.dueDate ? new Date(validatedData.dueDate) : null
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
      // If marking as completed, set completed_at timestamp
      if (validatedData.status === 'completed') {
        updateData.completed_at = new Date()
      } else if (validatedData.status === 'planned') {
        updateData.completed_at = null
      }
    }
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority
    if (validatedData.assignedTo !== undefined) updateData.assigned_to = validatedData.assignedTo
    if (validatedData.location !== undefined) updateData.location = validatedData.location
    if (validatedData.durationMinutes !== undefined) updateData.duration_minutes = validatedData.durationMinutes
    if (validatedData.reminderMinutes !== undefined) updateData.reminder_minutes = validatedData.reminderMinutes
    if (validatedData.isAllDay !== undefined) updateData.is_all_day = validatedData.isAllDay
    if (validatedData.isPinned !== undefined) updateData.is_pinned = validatedData.isPinned
    if (validatedData.result !== undefined) updateData.result = validatedData.result
    if (validatedData.nextAction !== undefined) updateData.next_action = validatedData.nextAction

    // Update the activity in the database
    const activity = await prisma.activity.update({
      where: { id: params.id },
      data: updateData,
    })

    // Transform database fields to match frontend types
    const transformedActivity = {
      id: activity.id,
      contactId: activity.contact_id,
      dealId: activity.deal_id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      dueDate: activity.due_date?.toISOString(),
      status: activity.status,
      priority: activity.priority,
      assignedTo: activity.assigned_to,
      location: activity.location,
      durationMinutes: activity.duration_minutes,
      reminderMinutes: activity.reminder_minutes,
      isAllDay: activity.is_all_day,
      isPinned: activity.is_pinned,
      completedAt: activity.completed_at?.toISOString(),
      completedBy: activity.completed_by,
      result: activity.result,
      nextAction: activity.next_action,
      createdAt: activity.created_at.toISOString(),
      updatedAt: activity.updated_at.toISOString(),
    }

    return NextResponse.json(transformedActivity)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}

// PATCH /api/activities/[id] - Partially update a specific activity
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    // Prepare update data with snake_case field names
    const updateData: any = {}

    if (body.status !== undefined) {
      updateData.status = body.status
      // If marking as completed, set completed_at timestamp
      if (body.status === 'completed') {
        updateData.completed_at = new Date()
      }
    }
    if (body.completedAt !== undefined) {
      updateData.completed_at = body.completedAt ? new Date(body.completedAt) : null
    }
    if (body.isPinned !== undefined) {
      updateData.is_pinned = body.isPinned
    }

    // Update the activity in the database
    const activity = await prisma.activity.update({
      where: { id: params.id },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(activity)
  } catch (error) {
    console.error('Error updating activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}

// DELETE /api/activities/[id] - Delete a specific activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.activity.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting activity:', error)
    return NextResponse.json(
      { error: 'Failed to delete activity' },
      { status: 500 }
    )
  }
}