import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { callIds, outcome } = await req.json()

    if (!callIds || !Array.isArray(callIds) || callIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid callIds array' },
        { status: 400 }
      )
    }

    if (!outcome) {
      return NextResponse.json(
        { error: 'Missing outcome' },
        { status: 400 }
      )
    }

    const validOutcomes = ['interested', 'not_interested', 'callback', 'voicemail', 'wrong_number', 'no_answer', 'busy']
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` },
        { status: 400 }
      )
    }

    // Update TelnyxCalls
    const telnyxResult = await prisma.telnyxCall.updateMany({
      where: { id: { in: callIds } },
      data: {
        callOutcome: outcome,
        dispositionSetAt: new Date(),
        dispositionSetBy: session.user.id,
      },
    })

    // Update VapiCalls
    const vapiResult = await prisma.vapiCall.updateMany({
      where: { id: { in: callIds } },
      data: {
        callOutcome: outcome,
        dispositionSetAt: new Date(),
        dispositionSetBy: session.user.id,
      },
    })

    // Update PowerDialerCalls
    const powerDialerResult = await prisma.powerDialerCall.updateMany({
      where: { id: { in: callIds } },
      data: {
        callOutcome: outcome,
        dispositionSetAt: new Date(),
      },
    })

    const totalUpdated =
      (telnyxResult.count || 0) +
      (vapiResult.count || 0) +
      (powerDialerResult.count || 0)

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      message: `Updated ${totalUpdated} calls to ${outcome}`,
    })
  } catch (error) {
    console.error('Error in bulk disposition:', error)
    return NextResponse.json(
      { error: 'Failed to update calls' },
      { status: 500 }
    )
  }
}

