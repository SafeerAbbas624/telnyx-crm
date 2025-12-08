import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/text-blast/kill-all - Stop all running text blasts
export async function POST(request: NextRequest) {
  try {
    console.log('[KILL-ALL API] Starting kill all text blasts...')

    // First, get the blasts that will be cancelled
    const blastsToCancel = await prisma.textBlast.findMany({
      where: {
        status: {
          in: ['running', 'pending', 'paused']
        }
      },
      select: { id: true, name: true, status: true }
    })

    console.log('[KILL-ALL API] Found blasts to cancel:', blastsToCancel)

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

    console.log('[KILL-ALL API] Successfully cancelled', result.count, 'blasts')

    return NextResponse.json({
      success: true,
      message: `Stopped ${result.count} text blast(s)`,
      count: result.count,
      cancelledCount: result.count,
      blasts: blastsToCancel,
    })
  } catch (error) {
    console.error('[KILL-ALL API] Error killing all text blasts:', error)
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

