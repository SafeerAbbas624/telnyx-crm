import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, subDays, format } from "date-fns"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const days = 7

    // Fetch all messages and calls for the last 7 days in one query each
    const startDate = startOfDay(subDays(now, days - 1))
    const endDate = endOfDay(now)

    // Fetch all messages in one query
    const messages = await prisma.telnyxMessage.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        direction: true,
        createdAt: true,
      },
    })

    // Fetch all calls in one query
    const calls = await prisma.telnyxCall.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
      },
    })

    console.log(`Found ${messages.length} messages and ${calls.length} calls in the last ${days} days`)

    // Group messages by day
    const messagesData = []
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)
      const dateStr = format(date, 'MMM d')

      const dayMessages = messages.filter((m) => {
        const msgDate = new Date(m.createdAt)
        return msgDate >= dayStart && msgDate <= dayEnd
      })

      const sentCount = dayMessages.filter((m) => m.direction === 'outbound').length
      const receivedCount = dayMessages.filter((m) => m.direction === 'inbound').length

      messagesData.push({
        date: dateStr,
        sent: sentCount,
        received: receivedCount,
      })
    }

    // Group calls by day
    const callsData = []
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)
      const dateStr = format(date, 'MMM d')

      const dayCalls = calls.filter((c) => {
        const callDate = new Date(c.createdAt)
        return callDate >= dayStart && callDate <= dayEnd
      })

      callsData.push({
        date: dateStr,
        calls: dayCalls.length,
      })
    }

    console.log('Chart data prepared:', { messagesData, callsData })

    return NextResponse.json({
      messagesData,
      callsData,
    })
  } catch (error) {
    console.error("Error fetching chart data:", error)
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    )
  }
}

