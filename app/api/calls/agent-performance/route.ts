import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build date filter
    const dateFilter: any = {}
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom)
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo)
    }

    const whereClause: any = {}
    if (Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter
    }

    // Fetch all calls with agent info
    const [telnyxCalls, vapiCalls, powerDialerCalls] = await Promise.all([
      prisma.telnyxCall.findMany({
        where: whereClause,
        select: {
          id: true,
          initiatedBy: true,
          status: true,
          callOutcome: true,
          sentiment: true,
          sentimentScore: true,
          duration: true,
          createdAt: true,
          initiatedByUser: { select: { id: true, name: true } },
        },
      }),
      prisma.vapiCall.findMany({
        where: whereClause,
        select: {
          id: true,
          created_at: true,
          status: true,
          callOutcome: true,
          sentiment: true,
          sentimentScore: true,
          duration: true,
        },
      }),
      prisma.powerDialerCall.findMany({
        where: whereClause,
        select: {
          id: true,
          session: { select: { userId: true, user: { select: { id: true, name: true } } } },
          status: true,
          callOutcome: true,
          sentiment: true,
          sentimentScore: true,
          duration: true,
          initiatedAt: true,
        },
      }),
    ])

    // Aggregate data by agent
    const agentStats: Record<string, any> = {}

    // Process Telnyx calls
    telnyxCalls.forEach((call) => {
      const agentId = call.initiatedBy || 'unknown'
      const agentName = call.initiatedByUser?.name || 'Unknown Agent'

      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          agentId,
          agentName,
          totalCalls: 0,
          answeredCalls: 0,
          interestedCount: 0,
          totalDuration: 0,
          sentimentScores: [],
        }
      }

      agentStats[agentId].totalCalls++
      if (call.status === 'answered' || call.status === 'completed') {
        agentStats[agentId].answeredCalls++
      }
      if (call.callOutcome === 'interested') {
        agentStats[agentId].interestedCount++
      }
      agentStats[agentId].totalDuration += call.duration || 0
      if (call.sentimentScore) {
        agentStats[agentId].sentimentScores.push(call.sentimentScore)
      }
    })

    // Process Power Dialer calls
    powerDialerCalls.forEach((call) => {
      const agentId = call.session?.userId || 'unknown'
      const agentName = call.session?.user?.name || 'Unknown Agent'

      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          agentId,
          agentName,
          totalCalls: 0,
          answeredCalls: 0,
          interestedCount: 0,
          totalDuration: 0,
          sentimentScores: [],
        }
      }

      agentStats[agentId].totalCalls++
      if (call.status === 'COMPLETED' || call.status === 'ANSWERED') {
        agentStats[agentId].answeredCalls++
      }
      if (call.callOutcome === 'interested') {
        agentStats[agentId].interestedCount++
      }
      agentStats[agentId].totalDuration += call.duration || 0
      if (call.sentimentScore) {
        agentStats[agentId].sentimentScores.push(call.sentimentScore)
      }
    })

    // Calculate metrics
    const agents = Object.values(agentStats).map((stats: any) => {
      const answerRate =
        stats.totalCalls > 0 ? Math.round((stats.answeredCalls / stats.totalCalls) * 100) : 0
      const conversionRate =
        stats.answeredCalls > 0 ? Math.round((stats.interestedCount / stats.answeredCalls) * 100) : 0
      const avgDuration = stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0
      const avgSentimentScore =
        stats.sentimentScores.length > 0
          ? Math.round(
              stats.sentimentScores.reduce((a: number, b: number) => a + b, 0) /
                stats.sentimentScores.length
            )
          : 0

      const sentiment =
        avgSentimentScore > 60 ? 'positive' : avgSentimentScore < 40 ? 'negative' : 'neutral'

      return {
        agentId: stats.agentId,
        agentName: stats.agentName,
        totalCalls: stats.totalCalls,
        answeredCalls: stats.answeredCalls,
        answerRate,
        avgDuration,
        interestedCount: stats.interestedCount,
        conversionRate,
        avgSentimentScore,
        sentiment,
      }
    })

    return NextResponse.json({
      period: { from: dateFrom, to: dateTo },
      agents: agents.sort((a, b) => b.conversionRate - a.conversionRate),
    })
  } catch (error) {
    console.error('Error fetching agent performance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent performance' },
      { status: 500 }
    )
  }
}

