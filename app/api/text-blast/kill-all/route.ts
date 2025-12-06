import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/text-blast/kill-all - Stop all running text blasts
export async function POST(request: NextRequest) {
  try {
    // Update all running/pending blasts to cancelled
    const result = await prisma.textBlast.updateMany({
      where: {
        status: {
          in: ['running', 'pending', 'paused']
        }
      },
      data: {
        status: 'cancelled',
        isPaused: true,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Stopped ${result.count} text blast(s)`,
      count: result.count,
      cancelledCount: result.count,
    })
  } catch (error) {
    console.error('Error killing all text blasts:', error)
    return NextResponse.json(
      { error: 'Failed to stop text blasts' },
      { status: 500 }
    )
  }
}

// GET /api/text-blast/kill-all - Get count of running blasts (for status check)
export async function GET() {
  try {
    const [running, pending, paused] = await Promise.all([
      prisma.textBlast.count({ where: { status: 'running' } }),
      prisma.textBlast.count({ where: { status: 'pending' } }),
      prisma.textBlast.count({ where: { status: 'paused' } }),
    ])

    return NextResponse.json({
      running,
      pending,
      paused,
      total: running + pending + paused,
      hasActiveBlasts: running + pending + paused > 0,
    })
  } catch (error) {
    console.error('Error checking active blasts:', error)
    return NextResponse.json(
      { error: 'Failed to check active blasts' },
      { status: 500 }
    )
  }
}

