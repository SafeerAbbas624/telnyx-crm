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
    const reportType = searchParams.get('type') || 'summary'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const userId = searchParams.get('userId')

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
    if (userId) {
      whereClause.initiatedBy = userId
    }

    if (reportType === 'summary') {
      // Get summary statistics
      const [telnyxCalls, vapiCalls, powerDialerCalls] = await Promise.all([
        prisma.telnyxCall.findMany({
          where: whereClause,
          select: {
            id: true,
            status: true,
            callOutcome: true,
            sentiment: true,
            duration: true,
            createdAt: true,
          },
        }),
        prisma.vapiCall.findMany({
          where: whereClause,
          select: {
            id: true,
            status: true,
            callOutcome: true,
            sentiment: true,
            duration: true,
            created_at: true,
          },
        }),
        prisma.powerDialerCall.findMany({
          where: whereClause,
          select: {
            id: true,
            status: true,
            callOutcome: true,
            sentiment: true,
            duration: true,
            initiatedAt: true,
          },
        }),
      ])

      const allCalls = [
        ...telnyxCalls.map((c) => ({ ...c, type: 'telnyx' })),
        ...vapiCalls.map((c) => ({ ...c, type: 'vapi', createdAt: c.created_at })),
        ...powerDialerCalls.map((c) => ({ ...c, type: 'power_dialer', createdAt: c.initiatedAt })),
      ]

      // Calculate statistics
      const outcomeStats: Record<string, number> = {}
      const sentimentStats: Record<string, number> = {}
      let totalDuration = 0
      let answeredCount = 0

      allCalls.forEach((call) => {
        if (call.callOutcome) {
          outcomeStats[call.callOutcome] = (outcomeStats[call.callOutcome] || 0) + 1
        }
        if (call.sentiment) {
          sentimentStats[call.sentiment] = (sentimentStats[call.sentiment] || 0) + 1
        }
        totalDuration += call.duration || 0
        if (call.status === 'answered' || call.status === 'completed') {
          answeredCount++
        }
      })

      return NextResponse.json({
        reportType: 'summary',
        period: { from: dateFrom, to: dateTo },
        totalCalls: allCalls.length,
        answeredCalls: answeredCount,
        answerRate: allCalls.length > 0 ? Math.round((answeredCount / allCalls.length) * 100) : 0,
        totalDuration,
        avgDuration: allCalls.length > 0 ? Math.round(totalDuration / allCalls.length) : 0,
        outcomes: outcomeStats,
        sentiments: sentimentStats,
        callsByType: {
          telnyx: telnyxCalls.length,
          vapi: vapiCalls.length,
          powerDialer: powerDialerCalls.length,
        },
      })
    } else if (reportType === 'outcomes') {
      // Get detailed outcome report
      const [telnyxCalls, vapiCalls, powerDialerCalls] = await Promise.all([
        prisma.telnyxCall.findMany({
          where: whereClause,
          select: {
            id: true,
            callOutcome: true,
            duration: true,
            createdAt: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.vapiCall.findMany({
          where: whereClause,
          select: {
            id: true,
            callOutcome: true,
            duration: true,
            created_at: true,
          },
        }),
        prisma.powerDialerCall.findMany({
          where: whereClause,
          select: {
            id: true,
            callOutcome: true,
            duration: true,
            initiatedAt: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        }),
      ])

      const outcomes: Record<string, any> = {}

      telnyxCalls.forEach((call) => {
        const outcome = call.callOutcome || 'unset'
        if (!outcomes[outcome]) {
          outcomes[outcome] = { count: 0, totalDuration: 0, calls: [] }
        }
        outcomes[outcome].count++
        outcomes[outcome].totalDuration += call.duration || 0
        outcomes[outcome].calls.push({
          id: call.id,
          type: 'telnyx',
          contact: call.contact,
          duration: call.duration,
          date: call.createdAt,
        })
      })

      return NextResponse.json({
        reportType: 'outcomes',
        period: { from: dateFrom, to: dateTo },
        outcomes,
      })
    } else if (reportType === 'sentiment') {
      // Get sentiment report
      const [telnyxCalls, vapiCalls, powerDialerCalls] = await Promise.all([
        prisma.telnyxCall.findMany({
          where: whereClause,
          select: {
            id: true,
            sentiment: true,
            sentimentScore: true,
            duration: true,
            createdAt: true,
          },
        }),
        prisma.vapiCall.findMany({
          where: whereClause,
          select: {
            id: true,
            sentiment: true,
            sentimentScore: true,
            duration: true,
            created_at: true,
          },
        }),
        prisma.powerDialerCall.findMany({
          where: whereClause,
          select: {
            id: true,
            sentiment: true,
            sentimentScore: true,
            duration: true,
            initiatedAt: true,
          },
        }),
      ])

      const sentiments: Record<string, any> = {}

      telnyxCalls.forEach((call) => {
        const sentiment = call.sentiment || 'unset'
        if (!sentiments[sentiment]) {
          sentiments[sentiment] = { count: 0, avgScore: 0, calls: [] }
        }
        sentiments[sentiment].count++
        sentiments[sentiment].calls.push({
          id: call.id,
          score: call.sentimentScore,
        })
      })

      // Calculate average scores
      Object.keys(sentiments).forEach((sentiment) => {
        const scores = sentiments[sentiment].calls.map((c: any) => c.score || 0)
        sentiments[sentiment].avgScore =
          scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
      })

      return NextResponse.json({
        reportType: 'sentiment',
        period: { from: dateFrom, to: dateTo },
        sentiments,
      })
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

