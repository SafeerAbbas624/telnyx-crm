import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/user/phone-numbers
 * Returns the current user's allowed phone numbers and their default number.
 * For admins: returns all active phone numbers (they have access to everything).
 * For team users: returns only their explicitly allowed phone numbers.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userRole = session.user.role

    // Fetch user with phone permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        defaultPhoneNumber: true,
        allowedPhoneNumbers: {
          include: {
            phoneNumber: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let phoneNumbers: any[] = []
    let defaultPhoneNumber = user.defaultPhoneNumber

    // Admin users get access to all active phone numbers
    if (userRole === 'ADMIN') {
      const allNumbers = await prisma.telnyxPhoneNumber.findMany({
        where: { isActive: true },
        orderBy: { phoneNumber: 'asc' }
      })
      phoneNumbers = allNumbers

      // If admin has no allowed numbers set but there are numbers available,
      // use all numbers as allowed
      if (user.allowedPhoneNumbers.length === 0 && allNumbers.length > 0) {
        // Use default if set, otherwise use first available
        if (!defaultPhoneNumber && allNumbers.length > 0) {
          defaultPhoneNumber = allNumbers[0]
        }
      }
    } else {
      // Team users only get their explicitly allowed phone numbers
      phoneNumbers = user.allowedPhoneNumbers.map(ap => ap.phoneNumber)
    }

    // Filter to only active numbers
    phoneNumbers = phoneNumbers.filter(n => n.isActive)

    return NextResponse.json({
      phoneNumbers,
      defaultPhoneNumber,
      defaultPhoneNumberId: user.defaultPhoneNumberId,
      hasNoNumbers: phoneNumbers.length === 0
    })
  } catch (error) {
    console.error('Error fetching user phone numbers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch phone numbers' },
      { status: 500 }
    )
  }
}

