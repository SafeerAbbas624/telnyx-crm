import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      // Get all active Telnyx phone numbers
      const phoneNumbers = await prisma.telnyxPhoneNumber.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          phoneNumber: true,
          state: true,
          city: true,
          capabilities: true
        },
        orderBy: {
          phoneNumber: 'asc'
        }
      })

      // Format the response to match expected structure
      const formattedNumbers = phoneNumbers.map(phone => ({
        id: phone.id,
        number: phone.phoneNumber
      }))

      return NextResponse.json({
        phoneNumbers: formattedNumbers
      })
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch phone numbers' },
        { status: 500 }
      )
    }
  })
}

