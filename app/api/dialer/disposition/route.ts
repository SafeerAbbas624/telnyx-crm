import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeDispositionActions } from '@/lib/dispositions/execute-actions'

/**
 * POST /api/dialer/disposition
 * Save call disposition for a power dialer call and execute automation actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { legId, contactId, dispositionId, notes, listId, dialerRunId } = body

    if (!contactId || !dispositionId) {
      return NextResponse.json(
        { error: 'contactId and dispositionId are required' },
        { status: 400 }
      )
    }

    // Get disposition with actions
    const disposition = await prisma.callDisposition.findUnique({
      where: { id: dispositionId },
      include: {
        actions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!disposition) {
      return NextResponse.json(
        { error: 'Disposition not found' },
        { status: 404 }
      )
    }

    // Execute all disposition actions
    const actionResults = await executeDispositionActions(
      disposition.actions,
      contactId,
      { listId, dialerRunId, legId }
    )

    // Log the disposition
    await prisma.callDispositionLog.create({
      data: {
        dispositionId,
        contactId,
        dialerRunId,
        listId,
        notes,
        actionsExecuted: actionResults
      }
    })

    // Update contact notes
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { notes: true }
    })
    const dispositionNote = `[${new Date().toISOString()}] Disposition: ${disposition.name}${notes ? ` - ${notes}` : ''}`
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        notes: contact?.notes
          ? `${contact.notes}\n${dispositionNote}`
          : dispositionNote
      }
    })

    // Update power dialer list contact status if listId provided
    if (listId) {
      const dispName = disposition.name.toLowerCase()
      // Determine final status based on disposition
      let finalStatus = 'COMPLETED' // Default: mark as done

      // Requeue if callback or no answer type
      if (dispName.includes('callback') || dispName.includes('no answer') ||
          dispName.includes('no contact') || dispName.includes('voicemail')) {
        finalStatus = 'PENDING' // Put back in queue for retry
      }

      // Remove if explicitly marked as DNC, bad number, or not interested
      if (dispName.includes('dnc') || dispName.includes('do not call') ||
          dispName.includes('bad number') || dispName.includes('wrong number')) {
        finalStatus = 'REMOVED'
      }

      await prisma.powerDialerListContact.updateMany({
        where: { listId, contactId },
        data: {
          status: finalStatus,
          disposition: disposition.name,
          lastCalledAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      disposition: disposition.name,
      actionsExecuted: actionResults.length
    })
  } catch (error) {
    console.error('[Disposition API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save disposition' },
      { status: 500 }
    )
  }
}

