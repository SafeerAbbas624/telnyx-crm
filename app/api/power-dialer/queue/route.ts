import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET - Get queue items for a session
export async function GET(request: NextRequest) {
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

    // Verify session ownership
    const powerDialerSession = await prisma.powerDialerSession.findUnique({
      where: { id: sessionId }
    })

    if (!powerDialerSession || powerDialerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get queue items
    const queueItems = await prisma.powerDialerQueue.findMany({
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
        calls: {
          orderBy: { initiatedAt: 'desc' },
        }
      },
      orderBy: [
        { priority: 'desc' },
        { addedAt: 'asc' }
      ]
    })

    return NextResponse.json(queueItems)
  } catch (error) {
    console.error('Error fetching queue items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue items' },
      { status: 500 }
    )
  }
}

// POST - Add contacts to queue
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, contactIds } = body

    if (!sessionId || !contactIds || !Array.isArray(contactIds)) {
      return NextResponse.json(
        { error: 'Session ID and contact IDs are required' },
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

    // Get current max priority
    const maxPriorityItem = await prisma.powerDialerQueue.findFirst({
      where: { sessionId },
      orderBy: { priority: 'desc' }
    })

    const startPriority = (maxPriorityItem?.priority || 0) + 1

    // Add contacts to queue
    const queueItems = await prisma.powerDialerQueue.createMany({
      data: contactIds.map((contactId: string, index: number) => ({
        sessionId,
        contactId,
        priority: startPriority + (contactIds.length - index),
        status: 'PENDING',
      }))
    })

    return NextResponse.json({
      success: true,
      addedCount: queueItems.count,
    })
  } catch (error) {
    console.error('Error adding to queue:', error)
    return NextResponse.json(
      { error: 'Failed to add contacts to queue' },
      { status: 500 }
    )
  }
}

// PATCH - Update queue item
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { queueItemId, status, attemptCount, wasContacted, wasAnswered } = body

    if (!queueItemId) {
      return NextResponse.json(
        { error: 'Queue item ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership through session
    const queueItem = await prisma.powerDialerQueue.findUnique({
      where: { id: queueItemId },
      include: { session: true }
    })

    if (!queueItem || queueItem.session.userId !== session.user.id) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    const updateData: any = {}
    
    if (status) updateData.status = status
    if (attemptCount !== undefined) {
      updateData.attemptCount = attemptCount
      updateData.lastAttemptAt = new Date()
    }
    if (wasContacted !== undefined) updateData.wasContacted = wasContacted
    if (wasAnswered !== undefined) updateData.wasAnswered = wasAnswered
    
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'SKIPPED') {
      updateData.completedAt = new Date()
    }

    const updatedItem = await prisma.powerDialerQueue.update({
      where: { id: queueItemId },
      data: updateData,
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Error updating queue item:', error)
    return NextResponse.json(
      { error: 'Failed to update queue item' },
      { status: 500 }
    )
  }
}

// DELETE - Remove contact from queue
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queueItemId = searchParams.get('queueItemId')

    if (!queueItemId) {
      return NextResponse.json(
        { error: 'Queue item ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership through session
    const queueItem = await prisma.powerDialerQueue.findUnique({
      where: { id: queueItemId },
      include: { session: true }
    })

    if (!queueItem || queueItem.session.userId !== session.user.id) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    await prisma.powerDialerQueue.delete({
      where: { id: queueItemId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting queue item:', error)
    return NextResponse.json(
      { error: 'Failed to delete queue item' },
      { status: 500 }
    )
  }
}

