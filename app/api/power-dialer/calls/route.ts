import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Get calls for a session
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Verify session ownership
    const powerDialerSession = await prisma.powerDialerSession.findUnique({
      where: { id: sessionId }
    })

    if (!powerDialerSession || powerDialerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get calls
    const calls = await prisma.powerDialerCall.findMany({
      where: { sessionId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            phone2: true,
            phone3: true,
          }
        },
        queueItem: {
          select: {
            id: true,
            status: true,
            attemptCount: true,
          }
        }
      },
      orderBy: { initiatedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(calls)
  } catch (error) {
    console.error('Error fetching power dialer calls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}

// POST - Create new call record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      sessionId,
      queueItemId,
      contactId,
      fromNumber,
      toNumber,
      webrtcSessionId,
      telnyxCallId,
    } = body

    if (!sessionId || !queueItemId || !contactId || !fromNumber || !toNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify session ownership
    const powerDialerSession = await prisma.powerDialerSession.findUnique({
      where: { id: sessionId }
    })

    if (!powerDialerSession || powerDialerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create call record
    const call = await prisma.powerDialerCall.create({
      data: {
        sessionId,
        queueItemId,
        contactId,
        fromNumber,
        toNumber,
        webrtcSessionId,
        telnyxCallId,
        status: 'INITIATED',
      }
    })

    return NextResponse.json(call)
  } catch (error) {
    console.error('Error creating power dialer call:', error)
    return NextResponse.json(
      { error: 'Failed to create call record' },
      { status: 500 }
    )
  }
}

// PATCH - Update call status
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      callId,
      status,
      answered,
      droppedBusy,
      duration,
      answeredAt,
      endedAt,
    } = body

    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership through session
    const call = await prisma.powerDialerCall.findUnique({
      where: { id: callId },
      include: { session: true }
    })

    if (!call || call.session.userId !== session.user.id) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const updateData: any = {}
    
    if (status) updateData.status = status
    if (answered !== undefined) updateData.answered = answered
    if (droppedBusy !== undefined) updateData.droppedBusy = droppedBusy
    if (duration !== undefined) updateData.duration = duration
    if (answeredAt) updateData.answeredAt = new Date(answeredAt)
    if (endedAt) updateData.endedAt = new Date(endedAt)

    const updatedCall = await prisma.powerDialerCall.update({
      where: { id: callId },
      data: updateData,
    })

    return NextResponse.json(updatedCall)
  } catch (error) {
    console.error('Error updating power dialer call:', error)
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    )
  }
}

