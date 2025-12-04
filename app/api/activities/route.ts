import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Schema for validating activity creation
const createActivitySchema = z.object({
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  taskType: z.string().optional(),
  subject: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['planned', 'completed', 'cancelled']).default('planned'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedTo: z.string().uuid().optional(),
  location: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reminderMinutes: z.number().int().positive().optional(),
  isAllDay: z.boolean().default(false),
  tags: z.array(z.union([
    z.string(),
    z.object({
      id: z.string().optional(),
      name: z.string(),
      color: z.string().optional()
    })
  ])).optional(),
})

// GET /api/activities - Get all activities or filter by contactId
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    let whereClause: any = contactId ? { contact_id: contactId } : {}

    // If user is a team member, only show activities for assigned contacts
    if (session.user.role === 'TEAM_USER') {
      if (contactId) {
        // Check if the contact is assigned to this team member
        const assignedContact = await prisma.contactAssignment.findFirst({
          where: {
            contactId: contactId,
            userId: session.user.id
          }
        })

        if (!assignedContact) {
          return NextResponse.json(
            { error: 'Forbidden - Contact not assigned to you' },
            { status: 403 }
          )
        }
      } else {
        // Get activities only for assigned contacts
        const assignedContacts = await prisma.contactAssignment.findMany({
          where: { userId: session.user.id },
          select: { contactId: true }
        })

        const assignedContactIds = assignedContacts.map(ac => ac.contactId)
        whereClause = {
          contact_id: {
            in: assignedContactIds
          }
        }
      }
    }

    const take = limit ? parseInt(limit) : undefined
    const skip = offset ? parseInt(offset) : undefined

    const activities = await prisma.activity.findMany({
      where: whereClause,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            phone1: true,
            avatarUrl: true
          }
        },
        activity_tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      },
      orderBy: [
        { due_date: 'asc' },
        { created_at: 'desc' }
      ],
      take,
      skip,
    })

    // Transform database fields to match frontend types
    const transformedActivities = activities.map((activity: any) => ({
      id: activity.id,
      contactId: activity.contact_id,
      dealId: activity.deal_id,
      type: activity.type,
      taskType: activity.task_type,
      title: activity.title,
      subject: activity.title,
      description: activity.description,
      dueDate: activity.due_date?.toISOString(),
      status: activity.status,
      priority: activity.priority,
      assignedTo: activity.assigned_to,
      location: activity.location,
      durationMinutes: activity.duration_minutes,
      reminderMinutes: activity.reminder_minutes,
      isAllDay: activity.is_all_day,
      completedAt: activity.completed_at?.toISOString(),
      completedBy: activity.completed_by,
      result: activity.result,
      nextAction: activity.next_action,
      createdAt: activity.created_at.toISOString(),
      updatedAt: activity.updated_at.toISOString(),
      tags: activity.activity_tags?.map((at: any) => at.tag) || [],
      contact: activity.contact
        ? {
            id: activity.contact.id,
            firstName: activity.contact.firstName,
            lastName: activity.contact.lastName,
            email: activity.contact.email1,
            phone: activity.contact.phone1,
            avatar: activity.contact.avatarUrl ?? null,
          }
        : null,
    }))

    return NextResponse.json(transformedActivities)
  } catch (error: any) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch activities',
        details: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate the request body
    const validatedData = createActivitySchema.parse(body)

    // Use subject as title if title is not provided
    const finalTitle = validatedData.title || validatedData.subject || 'Untitled Task'

    // Verify user exists in database
    let creatorId = session.user.id
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!userExists) {
      // Fallback to first admin user if session user doesn't exist
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      })
      if (adminUser) {
        creatorId = adminUser.id
      } else {
        return NextResponse.json(
          { error: 'No valid user found to create activity' },
          { status: 400 }
        )
      }
    }

    // If user is a team member, check if they have access to this contact
    if (session.user.role === 'TEAM_USER' && validatedData.contactId) {
      const assignedContact = await prisma.contactAssignment.findFirst({
        where: {
          contactId: validatedData.contactId,
          userId: session.user.id
        }
      })

      if (!assignedContact) {
        return NextResponse.json(
          { error: 'Forbidden - Contact not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Create the activity in the database
    const activity = await prisma.activity.create({
      data: {
        contact_id: validatedData.contactId || null,
        deal_id: validatedData.dealId,
        type: validatedData.type,
        task_type: validatedData.taskType,
        title: finalTitle,
        description: validatedData.description,
        due_date: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        status: validatedData.status,
        priority: validatedData.priority,
        assigned_to: validatedData.assignedTo,
        created_by: creatorId,
        location: validatedData.location,
        duration_minutes: validatedData.durationMinutes,
        reminder_minutes: validatedData.reminderMinutes,
        is_all_day: validatedData.isAllDay,
      },
    })

    // Handle tags if provided
    if (Array.isArray(validatedData.tags) && validatedData.tags.length > 0) {
      const desiredTagIds = new Set<string>()
      const candidatesToCreate = new Map<string, string | undefined>()

      for (const item of validatedData.tags) {
        if (typeof item === 'string') {
          const name = item.trim()
          if (name) candidatesToCreate.set(name, undefined)
          continue
        }
        if (item && item.id) {
          desiredTagIds.add(item.id)
        } else if (item && item.name) {
          const name = item.name.trim()
          if (name) candidatesToCreate.set(name, item.color)
        }
      }

      // Create or fetch tags for names
      for (const [name, color] of candidatesToCreate.entries()) {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: color ? { color } : {},
          create: { name, ...(color ? { color } : {}) },
        })
        desiredTagIds.add(tag.id)
      }

      // Create activity-tag associations
      if (desiredTagIds.size > 0) {
        await prisma.activityTag.createMany({
          data: [...desiredTagIds].map((tid) => ({
            activity_id: activity.id,
            tag_id: tid,
            created_by: session.user.id
          })),
          skipDuplicates: true,
        })
      }
    }

    // Fetch the created activity with tags
    const activityWithTags = await prisma.activity.findUnique({
      where: { id: activity.id },
      include: {
        activity_tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true }
            }
          }
        }
      }
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
      completedAt: activity.completed_at?.toISOString(),
      completedBy: activity.completed_by,
      result: activity.result,
      nextAction: activity.next_action,
      createdAt: activity.created_at.toISOString(),
      updatedAt: activity.updated_at.toISOString(),
      tags: activityWithTags?.activity_tags?.map((at: any) => at.tag) || [],
    }

    return NextResponse.json(transformedActivity, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating activity:', error)
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}