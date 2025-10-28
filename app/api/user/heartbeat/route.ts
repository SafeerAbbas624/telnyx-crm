import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Update user's lastLoginAt to track active sessions
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const userId = user.sub

      // Update lastLoginAt to current time
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      })

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error updating user heartbeat:', error)
      return NextResponse.json(
        { error: 'Failed to update heartbeat' },
        { status: 500 }
      )
    }
  })
}

