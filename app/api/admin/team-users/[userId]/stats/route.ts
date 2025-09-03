import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function GET(
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

      // Get statistics for this team user
      const [
        totalActivities,
        totalMessages,
        totalCalls,
        totalEmails
      ] = await Promise.all([
        // Count activities created by this user
        prisma.activity.count({
          where: {
            created_by: userId
          }
        }),

        // Count messages sent by this user
        prisma.message.count({
          where: {
            sent_by: userId
          }
        }),

        // Count calls initiated by this user
        prisma.telnyxCall.count({
          where: {
            initiatedBy: userId
          }
        }).catch(() => 0),

        // Count emails sent by this user
        prisma.emailMessage.count({
          where: {
            sentBy: userId
          }
        }).catch(() => 0)
      ])

      const stats = {
        totalActivities,
        totalMessages,
        totalCalls,
        totalEmails
      }

      return NextResponse.json({
        stats
      })
    } catch (error) {
      console.error('Error fetching team user stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch team user statistics' },
        { status: 500 }
      )
    }
  })
}
