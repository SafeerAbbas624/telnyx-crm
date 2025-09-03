import { NextRequest, NextResponse } from 'next/server'
import { withTeamAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  return withTeamAuth(request, async (req, user) => {
    try {
      const userId = user.sub

      // Get assigned contacts count
      const assignedContactsCount = await prisma.contactAssignment.count({
        where: { userId }
      })

      // Get total activities created by this user
      const totalActivities = await prisma.activity.count({
        where: { created_by: userId }
      })

      // Get pending tasks (activities not completed)
      const pendingTasks = await prisma.activity.count({
        where: {
          created_by: userId,
          completed_at: null
        }
      })

      // Get completed tasks
      const completedTasks = await prisma.activity.count({
        where: {
          created_by: userId,
          completed_at: { not: null }
        }
      })

      // Get total messages sent by this user
      const totalMessages = await prisma.message.count({
        where: { sent_by: userId }
      })

      // Get total emails sent by this user
      const totalEmails = await prisma.emailMessage.count({
        where: { sentBy: userId }
      })

      // Get total calls made by this user
      const totalCalls = await prisma.telnyxCall.count({
        where: { initiatedBy: userId }
      })

      // Get this week's activities
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const thisWeekActivities = await prisma.activity.count({
        where: {
          created_by: userId,
          created_at: {
            gte: oneWeekAgo
          }
        }
      })

      const stats = {
        assignedContacts: assignedContactsCount,
        totalActivities,
        pendingTasks,
        completedTasks,
        totalMessages,
        totalEmails,
        totalCalls,
        thisWeekActivities
      }

      return NextResponse.json({ stats })
    } catch (error) {
      console.error('Error fetching team dashboard stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch dashboard stats' },
        { status: 500 }
      )
    }
  })
}
