import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET - Get current or recent sessions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // Get specific session
      const powerDialerSession = await prisma.powerDialerSession.findUnique({
        where: { id: sessionId },
        include: {
          queueItems: {
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
              }
            }
          },
          calls: {
            orderBy: { initiatedAt: 'desc' },
            take: 100,
          }
        }
      })

      if (!powerDialerSession || powerDialerSession.userId !== session.user.id) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      return NextResponse.json(powerDialerSession)
    }

    // Get all sessions for user
    const sessions = await prisma.powerDialerSession.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: {
          select: {
            queueItems: true,
            calls: true,
          }
        }
      }
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching power dialer sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// POST - Create new session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contactIds, selectedNumbers, concurrentLines } = body

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    if (!selectedNumbers || !Array.isArray(selectedNumbers) || selectedNumbers.length === 0) {
      return NextResponse.json(
        { error: 'At least one phone number must be selected' },
        { status: 400 }
      )
    }

    // Create session
    const powerDialerSession = await prisma.powerDialerSession.create({
      data: {
        userId: session.user.id,
        concurrentLines: concurrentLines || Math.ceil(selectedNumbers.length / 2),
        selectedNumbers,
        status: 'IDLE',
      }
    })

    // Add contacts to queue
    const queueItems = await prisma.powerDialerQueue.createMany({
      data: contactIds.map((contactId: string, index: number) => ({
        sessionId: powerDialerSession.id,
        contactId,
        priority: contactIds.length - index, // Higher priority for earlier contacts
        status: 'PENDING',
      }))
    })

    return NextResponse.json({
      session: powerDialerSession,
      queuedCount: queueItems.count,
    })
  } catch (error) {
    console.error('Error creating power dialer session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// PATCH - Update session (start, pause, stop)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, action, stats } = body

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Session ID and action are required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existingSession = await prisma.powerDialerSession.findUnique({
      where: { id: sessionId }
    })

    if (!existingSession || existingSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    let updateData: any = {}

    switch (action) {
      case 'start':
        updateData = {
          status: 'RUNNING',
          startedAt: existingSession.startedAt || new Date(),
          pausedAt: null,
        }
        break
      case 'pause':
        updateData = {
          status: 'PAUSED',
          pausedAt: new Date(),
        }
        break
      case 'resume':
        updateData = {
          status: 'RUNNING',
          pausedAt: null,
        }
        break
      case 'stop':
        updateData = {
          status: 'STOPPED',
          completedAt: new Date(),
        }
        break
      case 'complete':
        updateData = {
          status: 'COMPLETED',
          completedAt: new Date(),
        }
        break
      case 'update_stats':
        if (stats) {
          updateData = {
            totalCalls: stats.totalCalls ?? existingSession.totalCalls,
            totalContacted: stats.totalContacted ?? existingSession.totalContacted,
            totalAnswered: stats.totalAnswered ?? existingSession.totalAnswered,
            totalNoAnswer: stats.totalNoAnswer ?? existingSession.totalNoAnswer,
            totalTalkTime: stats.totalTalkTime ?? existingSession.totalTalkTime,
          }
        }
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    const updatedSession = await prisma.powerDialerSession.update({
      where: { id: sessionId },
      data: updateData,
    })

    return NextResponse.json(updatedSession)
  } catch (error) {
    console.error('Error updating power dialer session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

// DELETE - Delete session
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existingSession = await prisma.powerDialerSession.findUnique({
      where: { id: sessionId }
    })

    if (!existingSession || existingSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.powerDialerSession.delete({
      where: { id: sessionId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting power dialer session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}

