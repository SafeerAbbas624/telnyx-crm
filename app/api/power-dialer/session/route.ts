import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
    const { contactIds, selectedNumbers, concurrentLines, listId } = body

    console.log('[POWER DIALER SESSION] Creating session:', { listId, selectedNumbers: selectedNumbers?.length, contactIds: contactIds?.length })

    if (!selectedNumbers || !Array.isArray(selectedNumbers) || selectedNumbers.length === 0) {
      return NextResponse.json(
        { error: 'At least one phone number must be selected' },
        { status: 400 }
      )
    }

    let queueContactIds = contactIds

    // If creating from a list, get pending contacts from the list
    if (listId) {
      console.log('[POWER DIALER SESSION] Fetching list:', listId)
      const list = await prisma.powerDialerList.findUnique({
        where: { id: listId }
      })

      if (!list || list.userId !== session.user.id) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 })
      }

      console.log('[POWER DIALER SESSION] Fetching pending contacts from list')
      // Get all PENDING contacts from the list
      const pendingContacts = await prisma.powerDialerListContact.findMany({
        where: {
          listId,
          status: 'PENDING'
        },
        select: { contactId: true }
      })

      queueContactIds = pendingContacts.map(pc => pc.contactId)

      if (queueContactIds.length === 0) {
        return NextResponse.json(
          { error: 'No pending contacts in this list' },
          { status: 400 }
        )
      }
    } else if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs or list ID are required' },
        { status: 400 }
      )
    }

    console.log('[POWER DIALER SESSION] Creating session in database')
    // Create session
    const powerDialerSession = await prisma.powerDialerSession.create({
      data: {
        userId: session.user.id,
        listId: listId || undefined,
        concurrentLines: concurrentLines || Math.ceil(selectedNumbers.length / 2),
        selectedNumbers,
        status: 'IDLE',
      }
    })

    console.log('[POWER DIALER SESSION] Session created:', { sessionId: powerDialerSession.id })

    console.log('[POWER DIALER SESSION] Adding contacts to queue')
    // Add contacts to queue
    const queueItems = await prisma.powerDialerQueue.createMany({
      data: queueContactIds.map((contactId: string, index: number) => ({
        sessionId: powerDialerSession.id,
        contactId,
        priority: queueContactIds.length - index, // Higher priority for earlier contacts
        status: 'PENDING',
      }))
    })

    console.log('[POWER DIALER SESSION] Queue items created:', { count: queueItems.count })

    return NextResponse.json({
      session: powerDialerSession,
      queuedCount: queueItems.count,
    })
  } catch (error) {
    console.error('[POWER DIALER SESSION] Error creating session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create session: ${errorMessage}` },
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
      case 'end_for_today':
        // Save progress to list and close session
        updateData = {
          status: 'PAUSED',
          completedAt: new Date(),
        }

        // If session is linked to a list, update list progress
        if (existingSession.listId && stats) {
          // Get all completed queue items for this session
          const completedItems = await prisma.powerDialerQueue.findMany({
            where: {
              sessionId: existingSession.id,
              status: { in: ['COMPLETED', 'FAILED'] }
            },
            include: { calls: true }
          })

          const answeredCount = completedItems.filter(item =>
            item.calls.some(call => call.answered)
          ).length

          const noAnswerCount = completedItems.filter(item =>
            item.calls.every(call => !call.answered)
          ).length

          // Update list progress
          await prisma.powerDialerList.update({
            where: { id: existingSession.listId },
            data: {
              contactsCalled: {
                increment: completedItems.length
              },
              contactsAnswered: {
                increment: answeredCount
              },
              contactsNoAnswer: {
                increment: noAnswerCount
              },
              totalTalkTime: {
                increment: stats.totalTalkTime ?? 0
              },
              lastWorkedOn: new Date(),
            }
          })

          // Update list contact statuses
          for (const item of completedItems) {
            const callOutcome = item.callOutcome || 'CALLED'
            let contactStatus = 'CALLED'

            if (callOutcome === 'ANSWERED') contactStatus = 'ANSWERED'
            else if (callOutcome === 'NO_ANSWER') contactStatus = 'NO_ANSWER'
            else if (callOutcome === 'BUSY') contactStatus = 'CALLED'

            await prisma.powerDialerListContact.update({
              where: {
                listId_contactId: {
                  listId: existingSession.listId,
                  contactId: item.contactId
                }
              },
              data: {
                status: contactStatus,
                lastCalledAt: new Date(),
              }
            })
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

