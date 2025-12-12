import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { userId } = await params
      const body = await request.json()
      const {
        firstName,
        lastName,
        email,
        role,
        allowedSections = [],
        allowedPhoneNumbers = [],
        assignedPhoneNumber,
        assignedEmailId
      } = body

      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      }

      // Verify the user belongs to this admin's team
      const teamUser = await prisma.user.findFirst({
        where: {
          id: userId,
          adminId: adminId
        }
      })

      if (!teamUser) {
        return NextResponse.json(
          { error: 'Team user not found' },
          { status: 404 }
        )
      }

      // Validate role if provided
      if (role && !['ADMIN', 'PROCESSOR', 'ORIGINATOR'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be ADMIN, PROCESSOR, or ORIGINATOR' },
          { status: 400 }
        )
      }

      // For non-admin roles, require at least one section
      if (role && role !== 'ADMIN' && (!allowedSections || allowedSections.length === 0)) {
        return NextResponse.json(
          { error: 'At least one section must be selected for non-admin users' },
          { status: 400 }
        )
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== teamUser.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email }
        })
        if (emailTaken) {
          return NextResponse.json(
            { error: 'Email is already in use' },
            { status: 409 }
          )
        }
      }

      // Update the team user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: firstName || teamUser.firstName,
          lastName: lastName || teamUser.lastName,
          email: email || teamUser.email,
          role: role || teamUser.role,
          allowedSections: role === 'ADMIN' ? [] : (allowedSections || teamUser.allowedSections),
          assignedPhoneNumber: assignedPhoneNumber ?? teamUser.assignedPhoneNumber,
          assignedEmailId: assignedEmailId ?? teamUser.assignedEmailId
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

      // Update allowed phone numbers if provided
      if (role !== 'ADMIN' && allowedPhoneNumbers) {
        // Delete existing allowed phone numbers
        await prisma.userAllowedPhoneNumber.deleteMany({
          where: { userId }
        })

        // Add new allowed phone numbers
        if (allowedPhoneNumbers.length > 0) {
          const phoneRecords = await prisma.telnyxPhoneNumber.findMany({
            where: {
              phoneNumber: { in: allowedPhoneNumbers }
            }
          })

          await prisma.userAllowedPhoneNumber.createMany({
            data: phoneRecords.map((phone: { id: string }) => ({
              userId,
              phoneNumberId: phone.id
            }))
          })
        }
      }

      return NextResponse.json({
        success: true,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          role: updatedUser.role,
          allowedSections: updatedUser.allowedSections,
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
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { userId } = await params

      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      }

      // Verify the user belongs to this admin's team
      const teamUser = await prisma.user.findFirst({
        where: {
          id: userId,
          adminId: adminId
        }
      })

      if (!teamUser) {
        return NextResponse.json(
          { error: 'Team user not found' },
          { status: 404 }
        )
      }

      // Delete allowed phone numbers first
      await prisma.userAllowedPhoneNumber.deleteMany({
        where: { userId }
      })

      // Delete the team user
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
