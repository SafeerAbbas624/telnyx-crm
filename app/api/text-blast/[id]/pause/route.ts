import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Parse request body for force/stop option
    let forceStop = false
    try {
      const body = await request.json()
      forceStop = body?.force === true || body?.stop === true
    } catch {
      // No body or invalid JSON, use defaults
    }

    const blast = await prisma.textBlast.findUnique({
      where: { id: params.id },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Text blast not found' },
        { status: 404 }
      )
    }

    // If force/stop mode, allow pausing from any active state (running, paused, pending)
    // This helps when frontend is out of sync with backend
    const activeStatuses = ['running', 'paused', 'pending']

    if (!forceStop && blast.status !== 'running') {
      // If already paused, just return success with current state
      if (blast.status === 'paused') {
        return NextResponse.json({ blast, alreadyPaused: true })
      }

      // Only error if truly not in an active state
      if (!activeStatuses.includes(blast.status)) {
        return NextResponse.json(
          { error: `Text blast is ${blast.status}, cannot pause` },
          { status: 400 }
        )
      }
    }

    // Determine target status based on whether this is a stop or pause
    const targetStatus = forceStop ? 'cancelled' : 'paused'

    const updatedBlast = await prisma.textBlast.update({
      where: { id: params.id },
      data: {
        status: targetStatus,
        isPaused: true,
        pausedAt: new Date(),
        ...(forceStop && { completedAt: new Date() }),
      },
    })

    console.log(`[TextBlast ${params.id}] ${forceStop ? 'Stopped' : 'Paused'} (was: ${blast.status})`)

    return NextResponse.json({ blast: updatedBlast })
  } catch (error) {
    console.error('Error pausing text blast:', error)
    return NextResponse.json(
      { error: 'Failed to pause text blast' },
      { status: 500 }
    )
  }
}
