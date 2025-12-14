import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Schema for validating bulk activity creation
const bulkCreateSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1).max(500),
  type: z.string().default('Call'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

// POST /api/activities/bulk-create - Create activities for multiple contacts
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
    const validatedData = bulkCreateSchema.parse(body)

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
          { error: 'No valid user found to create activities' },
          { status: 400 }
        )
      }
    }

    // If user is a team member, filter to only assigned contacts
    let contactIds = validatedData.contactIds
    if (session.user.role === 'TEAM_USER') {
      const assignedContacts = await prisma.contactAssignment.findMany({
        where: {
          contactId: { in: contactIds },
          userId: session.user.id
        },
        select: { contactId: true }
      })
      contactIds = assignedContacts.map(ac => ac.contactId)

      if (contactIds.length === 0) {
        return NextResponse.json(
          { error: 'No assigned contacts found in selection' },
          { status: 403 }
        )
      }
    }

    // Map the type to lowercase for database
    const typeMap: Record<string, string> = {
      'Call': 'call',
      'Email': 'email',
      'Meeting': 'meeting',
      'Follow-up': 'task',
      'Task': 'task',
      'Note': 'note',
    }
    const dbType = typeMap[validatedData.type] || 'task'

    // Create activities for all contacts
    const activities = await prisma.activity.createMany({
      data: contactIds.map(contactId => ({
        contact_id: contactId,
        type: dbType,
        task_type: validatedData.type,
        title: validatedData.title,
        description: validatedData.notes || null,
        due_date: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        status: 'planned',
        priority: 'medium',
        created_by: creatorId,
      })),
    })

    return NextResponse.json({
      success: true,
      count: activities.count,
      message: `Created ${activities.count} tasks`
    })
  } catch (error) {
    console.error('Bulk activity creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create activities' },
      { status: 500 }
    )
  }
}

