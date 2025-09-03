import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Allow both team users and admins to access this endpoint
    if (session.user.role !== 'TEAM_USER' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: `Forbidden - Only team users and admins can access assigned phone numbers. Your role: ${session.user.role}` },
        { status: 403 }
      )
    }

    let phoneNumbers: any[] = []

    if (session.user.role === 'TEAM_USER') {
      // Get assigned phone number for the team member (single phone number as string)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          assignedPhoneNumber: true
        }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // If user has an assigned phone number, find it in the PhoneNumber table
      if (user.assignedPhoneNumber) {
        const phoneNumber = await prisma.phoneNumber.findFirst({
          where: {
            number: user.assignedPhoneNumber
          },
          select: {
            id: true,
            number: true,
            is_active: true,
            capabilities: true,
            usage_count: true
          }
        })

        if (phoneNumber) {
          phoneNumbers = [phoneNumber]
        } else {
          // If phone number doesn't exist in PhoneNumber table, create a virtual one
          phoneNumbers = [{
            id: `virtual-${user.assignedPhoneNumber}`,
            number: user.assignedPhoneNumber,
            is_active: true,
            capabilities: ['voice', 'sms'],
            usage_count: 0
          }]
        }
      }
    } else if (session.user.role === 'ADMIN') {
      // For admins, get all phone numbers
      const allPhoneNumbers = await prisma.phoneNumber.findMany({
        select: {
          id: true,
          number: true,
          is_active: true,
          capabilities: true,
          usage_count: true
        }
      })
      phoneNumbers = allPhoneNumbers
    }

    return NextResponse.json({
      phoneNumbers,
      total: phoneNumbers.length
    })

  } catch (error) {
    console.error('Error fetching assigned phone numbers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
