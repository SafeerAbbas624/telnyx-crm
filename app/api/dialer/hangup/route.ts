/**
 * Hangup API for Power Dialer
 * POST /api/dialer/hangup - Hang up a specific call leg
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hangupLeg } from '@/lib/dialer/engine'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { runId, legId } = body as { runId: string; legId: string }

    if (!runId || !legId) {
      return NextResponse.json({ error: 'runId and legId are required' }, { status: 400 })
    }

    const success = await hangupLeg(runId, legId)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to hangup call - leg not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[DIALER API] Error hanging up call:', error)
    return NextResponse.json({ error: 'Failed to hangup call' }, { status: 500 })
  }
}

