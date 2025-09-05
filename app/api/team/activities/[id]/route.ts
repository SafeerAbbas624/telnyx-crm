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

    // Only allow team members to update their own activities
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activityId = params.id
    const body = await request.json()

    // For team members, verify they can only update activities for their assigned contacts
    if (session.user.role === 'TEAM') {
      // Get user's assigned contacts
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { assignedContacts: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const assignedContactIds = user.assignedContacts.map(contact => contact.id)

      // Check if the activity belongs to an assigned contact
      const existingActivity = await prisma.activity.findUnique({
        where: { id: activityId }
      })

      if (!existingActivity || !assignedContactIds.includes(existingActivity.contact_id)) {
        return NextResponse.json({ error: 'Activity not found or not accessible' }, { status: 404 })
      }

      // Also check if the new contact (if changed) is assigned to the user
      if (body.contactId && !assignedContactIds.includes(body.contactId)) {
        return NextResponse.json({ error: 'Cannot assign activity to unassigned contact' }, { status: 403 })
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
        due_date: body.scheduledFor ? new Date(body.scheduledFor) : null,
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

    // Only allow team members to delete their own activities
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const activityId = params.id

    // For team members, verify they can only delete activities for their assigned contacts
    if (session.user.role === 'TEAM') {
      // Get user's assigned contacts
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { assignedContacts: true }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const assignedContactIds = user.assignedContacts.map(contact => contact.id)

      // Check if the activity belongs to an assigned contact
      const existingActivity = await prisma.activity.findUnique({
        where: { id: activityId }
      })

      if (!existingActivity || !assignedContactIds.includes(existingActivity.contact_id)) {
        return NextResponse.json({ error: 'Activity not found or not accessible' }, { status: 404 })
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
