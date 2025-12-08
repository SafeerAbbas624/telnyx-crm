/**
 * Multi-Line Power Dialer Run Control API
 * 
 * GET /api/dialer/runs/[runId] - Get run state
 * POST /api/dialer/runs/[runId] - Control run (pause, resume, stop)
 * DELETE /api/dialer/runs/[runId] - Stop and delete run
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  getDialerRunState,
  pauseDialerRun,
  resumeDialerRun,
  stopDialerRun,
} from '@/lib/dialer/engine'

interface RouteParams {
  params: Promise<{ runId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { runId } = await params

    // First check in-memory state
    const memoryState = getDialerRunState(runId)
    if (memoryState) {
      return NextResponse.json({ state: memoryState })
    }

    // Fall back to database
    const dbRun = await prisma.powerDialerRun.findUnique({
      where: { id: runId },
      include: {
        list: { select: { name: true } },
        legs: {
          orderBy: { startedAt: 'desc' },
          take: 50,
          include: {
            listContact: {
              include: {
                contact: { select: { id: true, fullName: true, firstName: true, lastName: true, phone1: true } }
              }
            }
          }
        }
      }
    })

    if (!dbRun) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      state: {
        runId: dbRun.id,
        listId: dbRun.listId,
        listName: dbRun.list.name,
        status: dbRun.status,
        maxLines: dbRun.maxLines,
        stats: {
          totalAttempted: dbRun.totalAttempted,
          totalAnswered: dbRun.totalAnswered,
          totalNoAnswer: dbRun.totalNoAnswer,
          totalVoicemail: dbRun.totalVoicemail,
          totalBusy: dbRun.totalBusy,
          totalFailed: dbRun.totalFailed,
          totalCanceled: dbRun.totalCanceled,
          totalTalkTimeSeconds: dbRun.totalTalkTime
        },
        startedAt: dbRun.startedAt?.toISOString(),
        completedAt: dbRun.completedAt?.toISOString()
      }
    })

  } catch (error) {
    console.error('[DIALER API] Error getting run:', error)
    return NextResponse.json({ error: 'Failed to get run' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { runId } = await params
    const body = await request.json()
    const { action } = body as { action: 'pause' | 'resume' | 'stop' }

    if (!['pause', 'resume', 'stop'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    let state = null
    switch (action) {
      case 'pause':
        state = await pauseDialerRun(runId)
        break
      case 'resume':
        state = await resumeDialerRun(runId)
        break
      case 'stop':
        state = await stopDialerRun(runId)
        break
    }

    if (!state) {
      return NextResponse.json({ error: 'Run not found or invalid state' }, { status: 404 })
    }

    return NextResponse.json({ success: true, state })

  } catch (error) {
    console.error('[DIALER API] Error controlling run:', error)
    return NextResponse.json({ error: 'Failed to control run' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { runId } = await params

    // Stop the run first
    await stopDialerRun(runId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[DIALER API] Error deleting run:', error)
    return NextResponse.json({ error: 'Failed to delete run' }, { status: 500 })
  }
}

