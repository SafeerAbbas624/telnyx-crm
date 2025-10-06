import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow admins and team users
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TEAM_USER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activityId = params.id
    const body = await request.json()

    // For team users, verify they can only update activities for their assigned contacts
    if (session.user.role === 'TEAM_USER') {
      const userId = session.user.id as string

      // Check current activity's contact assignment
      const existingActivity = await prisma.activity.findUnique({
        where: { id: activityId },
        select: { contact_id: true }
      })

      if (!existingActivity) {
        return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
      }

      const currentAssignment = await prisma.contactAssignment.findUnique({
        where: { userId_contactId: { userId, contactId: existingActivity.contact_id } }
      })

      if (!currentAssignment) {
        return NextResponse.json({ error: 'Activity not accessible' }, { status: 403 })
      }

      // If changing the contact, ensure the new one is also assigned to the user
      if (body.contactId) {
        const newAssignment = await prisma.contactAssignment.findUnique({
          where: { userId_contactId: { userId, contactId: body.contactId } }
        })
        if (!newAssignment) {
          return NextResponse.json({ error: 'Cannot assign activity to unassigned contact' }, { status: 403 })
        }
      }
    }

    // Update the activity
    const updatedActivity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        type: body.type,
        title: body.title,
        description: body.description,
        contact_id: body.contactId,
        priority: body.priority,
        due_date: body.dueDate ? new Date(body.dueDate) : (body.scheduledFor ? new Date(body.scheduledFor) : null),
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

    return NextResponse.json(updatedActivity)
  } catch (error) {
    console.error('Error updating team activity:', error)
    return NextResponse.json(
      { error: 'Failed to update activity' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow admins and team users
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TEAM_USER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activityId = params.id

    // For team users, verify they can only delete activities for their assigned contacts
    if (session.user.role === 'TEAM_USER') {
      const userId = session.user.id as string

      const existingActivity = await prisma.activity.findUnique({
        where: { id: activityId },
        select: { contact_id: true }
      })

      if (!existingActivity) {
        return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
      }

      const assignment = await prisma.contactAssignment.findUnique({
        where: { userId_contactId: { userId, contactId: existingActivity.contact_id } }
      })

      if (!assignment) {
        return NextResponse.json({ error: 'Activity not accessible' }, { status: 403 })
      }
    }

    // Delete the activity
    await prisma.activity.delete({
      where: { id: activityId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting team activity:', error)
    return NextResponse.json(
      { error: 'Failed to delete activity' },
      { status: 500 }
    )
  }
}
