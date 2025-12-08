/**
 * Multi-Line Power Dialer Runs API
 * 
 * POST /api/dialer/runs - Start a new dialer run
 * GET /api/dialer/runs - Get active runs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  startDialerRun,
  getActiveRunForList,
  getAllActiveRuns,
} from '@/lib/dialer/engine'
import type { StartDialerRunRequest } from '@/lib/dialer/types'

export async function POST(request: NextRequest) {
  console.log('[DIALER API] POST /api/dialer/runs called')
  try {
    const session = await getServerSession(authOptions)
    console.log('[DIALER API] Session user:', session?.user?.id)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: StartDialerRunRequest = await request.json()
    console.log('[DIALER API] Request body:', JSON.stringify(body))
    const { listId, maxLines, selectedNumbers, callerIdStrategy, scriptId, resumeFromIndex } = body

    if (!listId) {
      console.log('[DIALER API] Missing listId')
      return NextResponse.json({ error: 'listId is required' }, { status: 400 })
    }

    // Verify user owns the list
    const list = await prisma.powerDialerList.findFirst({
      where: { id: listId, userId: session.user.id }
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Check for existing active run
    const existingRun = getActiveRunForList(listId)
    if (existingRun && existingRun.status === 'running') {
      return NextResponse.json({ 
        error: 'A dialer run is already active for this list',
        runId: existingRun.runId
      }, { status: 409 })
    }

    // Start the run
    const runState = await startDialerRun({
      listId,
      userId: session.user.id,
      maxLines,
      selectedNumbers,
      callerIdStrategy,
      scriptId,
      resumeFromIndex
    })

    return NextResponse.json({
      success: true,
      runId: runState.runId,
      state: runState
    })

  } catch (error) {
    console.error('[DIALER API] Error starting run:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to start dialer run' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const listId = searchParams.get('listId')

    if (listId) {
      // Get active run for specific list
      const run = getActiveRunForList(listId)
      return NextResponse.json({ run })
    }

    // Get all active runs (for admin/debugging)
    const runs = getAllActiveRuns()
    return NextResponse.json({ runs })

  } catch (error) {
    console.error('[DIALER API] Error getting runs:', error)
    return NextResponse.json({ error: 'Failed to get runs' }, { status: 500 })
  }
}

