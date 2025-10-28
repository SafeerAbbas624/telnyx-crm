import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { userId } = params
      const body = await request.json()
      const { assignedPhoneNumber, assignedEmailId } = body

      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      }

      // Verify the user belongs to this admin's team
      const teamUser = await prisma.user.findUnique({
        where: {
          id: userId,
          adminId: adminId,
          role: 'TEAM_USER'
        }
      })

      if (!teamUser) {
        return NextResponse.json(
          { error: 'Team user not found' },
          { status: 404 }
        )
      }

      // Validate that resources are not already assigned to another active user
      if (assignedPhoneNumber || assignedEmailId) {
        const existingAssignments = await prisma.user.findFirst({
          where: {
            id: { not: userId }, // Exclude current user
            adminId: adminId,
            status: 'active',
            OR: [
              ...(assignedPhoneNumber ? [{ assignedPhoneNumber }] : []),
              ...(assignedEmailId ? [{ assignedEmailId }] : [])
            ]
          }
        })

        if (existingAssignments) {
          return NextResponse.json(
            { error: 'Phone number or email account is already assigned to another user' },
            { status: 409 }
          )
        }
      }

      // Update the team user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(assignedPhoneNumber !== undefined && { assignedPhoneNumber }),
          ...(assignedEmailId !== undefined && { assignedEmailId })
        },
        include: {
          assignedEmail: {
            select: {
              id: true,
              emailAddress: true,
              displayName: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          assignedPhoneNumber: updatedUser.assignedPhoneNumber,
          assignedEmailId: updatedUser.assignedEmailId,
          assignedEmail: updatedUser.assignedEmail
        }
      })
    } catch (error) {
      console.error('Error updating team user:', error)
      return NextResponse.json(
        { error: 'Failed to update team user' },
        { status: 500 }
      )
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { userId } = params

      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      }

      // Verify the user belongs to this admin's team
      const teamUser = await prisma.user.findUnique({
        where: {
          id: userId,
          adminId: adminId,
          role: 'TEAM_USER'
        }
      })

      if (!teamUser) {
        return NextResponse.json(
          { error: 'Team user not found' },
          { status: 404 }
        )
      }

      // Delete the team user (cascade will handle related records)
      await prisma.user.delete({
        where: { id: userId }
      })

      return NextResponse.json({
        success: true,
        message: 'Team member deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting team user:', error)
      return NextResponse.json(
        { error: 'Failed to delete team user' },
        { status: 500 }
      )
    }
  })
}

