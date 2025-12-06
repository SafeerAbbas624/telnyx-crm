import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Fetch user's phone number permissions
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { userId } = params

      // Verify the user belongs to this admin's team (or is the admin themselves)
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          OR: [
            { adminId: adminId },
            { id: adminId, role: 'ADMIN' }
          ]
        },
        include: {
          defaultPhoneNumber: true,
          allowedPhoneNumbers: {
            include: {
              phoneNumber: true
            }
          }
        }
      })

      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found or not in your team' },
          { status: 404 }
        )
      }

      // Get all available phone numbers
      const allNumbers = await prisma.telnyxPhoneNumber.findMany({
        where: { isActive: true },
        orderBy: { phoneNumber: 'asc' }
      })

      return NextResponse.json({
        userId: targetUser.id,
        defaultPhoneNumberId: targetUser.defaultPhoneNumberId,
        defaultPhoneNumber: targetUser.defaultPhoneNumber,
        allowedPhoneNumbers: targetUser.allowedPhoneNumbers.map(ap => ap.phoneNumber),
        allAvailableNumbers: allNumbers
      })
    } catch (error) {
      console.error('Error fetching phone permissions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch phone permissions' },
        { status: 500 }
      )
    }
  })
}

// PUT - Update user's phone number permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { userId } = params
      const body = await request.json()
      const { allowedPhoneNumberIds, defaultPhoneNumberId, grantAll, revokeAll } = body

      // Verify the user belongs to this admin's team (or is the admin themselves)
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          OR: [
            { adminId: adminId },
            { id: adminId, role: 'ADMIN' }
          ]
        }
      })

      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found or not in your team' },
          { status: 404 }
        )
      }

      // Handle "Grant All" - assign all active phone numbers
      if (grantAll) {
        const allNumbers = await prisma.telnyxPhoneNumber.findMany({
          where: { isActive: true },
          select: { id: true }
        })

        // Delete existing permissions and add all
        await prisma.$transaction([
          prisma.userAllowedPhoneNumber.deleteMany({
            where: { userId }
          }),
          prisma.userAllowedPhoneNumber.createMany({
            data: allNumbers.map(n => ({
              userId,
              phoneNumberId: n.id
            }))
          })
        ])

        // Set default if not set and we have numbers
        if (!targetUser.defaultPhoneNumberId && allNumbers.length > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: { defaultPhoneNumberId: allNumbers[0].id }
          })
        }

        return NextResponse.json({ success: true, message: 'All numbers granted' })
      }

      // Handle "Revoke All" - remove all phone number permissions
      if (revokeAll) {
        await prisma.$transaction([
          prisma.userAllowedPhoneNumber.deleteMany({
            where: { userId }
          }),
          prisma.user.update({
            where: { id: userId },
            data: { defaultPhoneNumberId: null }
          })
        ])

        return NextResponse.json({ success: true, message: 'All numbers revoked' })
      }

      // Validate that defaultPhoneNumberId is in allowedPhoneNumberIds
      if (defaultPhoneNumberId && allowedPhoneNumberIds) {
        if (!allowedPhoneNumberIds.includes(defaultPhoneNumberId)) {
          return NextResponse.json(
            { error: 'Default phone number must be one of the allowed numbers' },
            { status: 400 }
          )
        }
      }

      // Update allowed phone numbers
      if (Array.isArray(allowedPhoneNumberIds)) {
        // Verify all phone numbers exist
        const validNumbers = await prisma.telnyxPhoneNumber.findMany({
          where: { id: { in: allowedPhoneNumberIds } },
          select: { id: true }
        })

        const validIds = validNumbers.map(n => n.id)

        // Delete existing and create new permissions
        await prisma.$transaction([
          prisma.userAllowedPhoneNumber.deleteMany({
            where: { userId }
          }),
          prisma.userAllowedPhoneNumber.createMany({
            data: validIds.map(phoneNumberId => ({
              userId,
              phoneNumberId
            })),
            skipDuplicates: true
          })
        ])
      }

      // Update default phone number
      if (defaultPhoneNumberId !== undefined) {
        // If setting a default, verify it's in the allowed list
        if (defaultPhoneNumberId) {
          const isAllowed = await prisma.userAllowedPhoneNumber.findFirst({
            where: { userId, phoneNumberId: defaultPhoneNumberId }
          })

          if (!isAllowed) {
            // Auto-add the default to allowed list
            await prisma.userAllowedPhoneNumber.create({
              data: { userId, phoneNumberId: defaultPhoneNumberId }
            })
          }
        }

        await prisma.user.update({
          where: { id: userId },
          data: { defaultPhoneNumberId: defaultPhoneNumberId || null }
        })
      }

      // Fetch updated permissions
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          defaultPhoneNumber: true,
          allowedPhoneNumbers: {
            include: { phoneNumber: true }
          }
        }
      })

      return NextResponse.json({
        success: true,
        userId: updatedUser!.id,
        defaultPhoneNumberId: updatedUser!.defaultPhoneNumberId,
        defaultPhoneNumber: updatedUser!.defaultPhoneNumber,
        allowedPhoneNumbers: updatedUser!.allowedPhoneNumbers.map(ap => ap.phoneNumber)
      })
    } catch (error) {
      console.error('Error updating phone permissions:', error)
      return NextResponse.json(
        { error: 'Failed to update phone permissions' },
        { status: 500 }
      )
    }
  })
}

