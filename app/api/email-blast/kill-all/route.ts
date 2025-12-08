import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Get counts of active email blasts
export async function GET(request: NextRequest) {
  try {
    const [running, paused, pending] = await Promise.all([
      prisma.emailBlast.count({ where: { status: 'running' } }),
      prisma.emailBlast.count({ where: { status: 'paused' } }),
      prisma.emailBlast.count({ where: { status: 'pending' } }),
    ])

    return NextResponse.json({
      running,
      paused,
      pending,
      total: running + paused + pending,
    })
  } catch (error) {
    console.error('Error fetching email blast counts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch counts', running: 0, paused: 0, pending: 0, total: 0 },
      { status: 500 }
    )
  }
}

// POST - Kill all active email blasts
export async function POST(request: NextRequest) {
  try {
    // Stop all running and paused email blasts
    const result = await prisma.emailBlast.updateMany({
      where: {
        status: { in: ['running', 'paused', 'pending'] }
      },
      data: {
        status: 'cancelled',
        isPaused: false,
        completedAt: new Date(),
      },
    })

    console.log(`[EmailBlast Kill-All] Stopped ${result.count} email blasts`)

    return NextResponse.json({
      success: true,
      message: `Stopped ${result.count} email blast(s)`,
      count: result.count,
    })
  } catch (error) {
    console.error('Error killing all email blasts:', error)
    return NextResponse.json(
      { error: 'Failed to stop email blasts' },
      { status: 500 }
    )
  }
}

