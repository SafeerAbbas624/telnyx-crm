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
      const { searchParams } = new URL(request.url)
      const days = searchParams.get('days')

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

      // Calculate date filter if days parameter is provided
      let dateFilter = {}
      if (days) {
        const daysAgo = new Date()
        daysAgo.setDate(daysAgo.getDate() - parseInt(days))
        dateFilter = {
          gte: daysAgo
        }
      }

      // Get statistics for this team user based on assigned resources
      const [
        totalActivities,
        totalMessages,
        totalCalls,
        totalEmails
      ] = await Promise.all([
        // Count activities created by this user
        prisma.activity.count({
          where: {
            created_by: userId,
            ...(days ? { created_at: dateFilter } : {})
          }
        }),

        // Count messages sent from this user's assigned phone number
        prisma.message.count({
          where: {
            phoneNumber: teamUser.assignedPhoneNumber || undefined,
            direction: 'outbound',
            ...(days ? { timestamp: dateFilter } : {})
          }
        }).catch(() => 0),

        // Count calls made from this user's assigned phone number
        prisma.telnyxCall.count({
          where: {
            fromNumber: teamUser.assignedPhoneNumber || undefined,
            direction: 'outbound',
            ...(days ? { createdAt: dateFilter } : {})
          }
        }).catch(() => 0),

        // Count emails sent from this user's assigned email account
        prisma.emailMessage.count({
          where: {
            emailAccountId: teamUser.assignedEmailId || undefined,
            direction: 'outbound',
            ...(days ? { sentAt: dateFilter } : {})
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
