import { NextRequest, NextResponse } from 'next/server'
import { withTeamAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  return withTeamAuth(request, async (req, user) => {
    try {
      const userId = user.sub
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')

      // Get assigned contacts for this team user
      const assignedContacts = await prisma.contactAssignment.findMany({
        where: { userId },
        select: { contactId: true }
      })

      const assignedContactIds = assignedContacts.map(assignment => assignment.contactId)

      const activities = await prisma.activity.findMany({
        where: {
          contact_id: {
            in: assignedContactIds
          }
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email1: true,
              phone1: true
            }
          }
        },
        orderBy: [
          { completed_at: 'asc' }, // Incomplete tasks first
          { due_date: 'asc' },
          { created_at: 'desc' }
        ],
        take: limit,
        skip: offset
      })

      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        status: activity.completed_at ? 'completed' : 'pending',
        priority: activity.priority || 'medium',
        dueDate: activity.due_date?.toISOString(),
        completedAt: activity.completed_at?.toISOString(),
        contact: activity.contact,
        createdAt: activity.created_at.toISOString()
      }))

      return NextResponse.json({
        activities: formattedActivities,
        total: activities.length
      })
    } catch (error) {
      console.error('Error fetching team activities:', error)
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  return withTeamAuth(request, async (req, user) => {
    try {
      const userId = user.sub
      const body = await request.json()
      const { type, title, description, contactId, priority, dueDate } = body

      // Validate required fields
      if (!type || !title || !contactId) {
        return NextResponse.json(
          { error: 'Type, title, and contact are required' },
          { status: 400 }
        )
      }

      // Check if contact is assigned to this user
      const assignment = await prisma.contactAssignment.findUnique({
        where: {
          userId_contactId: {
            userId,
            contactId
          }
        }
      })

      if (!assignment) {
        return NextResponse.json(
          { error: 'Contact is not assigned to you' },
          { status: 403 }
        )
      }

      const activity = await prisma.activity.create({
        data: {
          type,
          title,
          description: description || null,
          contact_id: contactId,
          created_by: userId,
          priority: priority || 'medium',
          due_date: dueDate ? new Date(dueDate) : null,
          status: 'planned'
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email1: true,
              phone1: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        activity: {
          id: activity.id,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          status: 'pending',
          priority: activity.priority,
          dueDate: activity.due_date?.toISOString(),
          contact: activity.contact,
          createdAt: activity.created_at.toISOString()
        }
      })
    } catch (error) {
      console.error('Error creating team activity:', error)
      return NextResponse.json(
        { error: 'Failed to create activity' },
        { status: 500 }
      )
    }
  })
}
