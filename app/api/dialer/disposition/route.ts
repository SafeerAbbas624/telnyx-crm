import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { executeDispositionActions } from '@/lib/dispositions/execute-actions'

/**
 * POST /api/dialer/disposition
 * Save call disposition for a power dialer call and execute automation actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { legId, contactId, dispositionId, notes, listId, dialerRunId, callerIdNumber, isUpdate, previousDispositionId } = body

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

    // If this is an update (disposition change), first REMOVE tags from the previous disposition
    if (isUpdate && previousDispositionId && previousDispositionId !== dispositionId) {
      const previousDisposition = await prisma.callDisposition.findUnique({
        where: { id: previousDispositionId },
        include: {
          actions: {
            where: { isActive: true, actionType: 'ADD_TAG' }
          }
        }
      })

      if (previousDisposition?.actions) {
        console.log(`[Disposition API] Removing ${previousDisposition.actions.length} tags from previous disposition "${previousDisposition.name}"`)
        for (const action of previousDisposition.actions) {
          const config = action.config as any
          if (config?.tagId) {
            await prisma.contactTag.deleteMany({
              where: { contact_id: contactId, tag_id: config.tagId }
            })
            console.log(`[Disposition API] Removed tag ${config.tagId} from contact ${contactId}`)
          } else if (config?.tagName) {
            const tag = await prisma.tag.findUnique({ where: { name: config.tagName } })
            if (tag) {
              await prisma.contactTag.deleteMany({
                where: { contact_id: contactId, tag_id: tag.id }
              })
              console.log(`[Disposition API] Removed tag "${config.tagName}" from contact ${contactId}`)
            }
          }
        }
      }
    }

    // Execute all disposition actions (pass callerIdNumber for SMS sending from same number)
    const actionResults = await executeDispositionActions(
      disposition.actions,
      contactId,
      { listId, dialerRunId, legId, callerIdNumber }
    )

    // Log the disposition
    await prisma.callDispositionLog.create({
      data: {
        dispositionId,
        contactId,
        dialerRunId,
        listId,
        notes,
        actionsExecuted: actionResults as any // JSON field
      }
    })

    // Update contact notes and customFields (dialAttempts counter - only for new calls, not updates)
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { notes: true, customFields: true, noAnswerCount: true }
    })

    const currentCustomFields = (contact?.customFields as Record<string, any>) || {}
    const dispName = disposition.name.toLowerCase()

    // Check if this is a "no answer" type disposition
    const isNoAnswerDisposition = dispName.includes('no answer') ||
                                   dispName.includes('no contact') ||
                                   dispName.includes('voicemail') ||
                                   dispName.includes('busy')

    // Only add note and increment dial attempts for new dispositions, not updates
    if (!isUpdate) {
      const dispositionNote = `[${new Date().toISOString()}] Disposition: ${disposition.name}${notes ? ` - ${notes}` : ''}`
      const currentDialAttempts = currentCustomFields.dialAttempts || 0

      await prisma.contact.update({
        where: { id: contactId },
        data: {
          notes: contact?.notes
            ? `${contact.notes}\n${dispositionNote}`
            : dispositionNote,
          // Increment noAnswerCount if this is a no answer disposition
          noAnswerCount: isNoAnswerDisposition ? (contact?.noAnswerCount || 0) + 1 : undefined,
          customFields: {
            ...currentCustomFields,
            dialAttempts: currentDialAttempts + 1,
            lastDialedAt: new Date().toISOString(),
            lastDisposition: disposition.name
          }
        }
      })
    } else {
      // Just update the lastDisposition for updates
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          customFields: {
            ...currentCustomFields,
            lastDisposition: disposition.name
          }
        }
      })
    }

    // Create Activity record for contact timeline (different message for updates)
    await prisma.activity.create({
      data: {
        contact_id: contactId,
        type: 'call',
        title: isUpdate
          ? `Disposition Changed to ${disposition.name}`
          : `Power Dialer Call - ${disposition.name}`,
        description: notes ? `Notes: ${notes}` : `Disposition: ${disposition.name}`,
        status: 'completed',
        priority: 'medium'
      }
    })

    // Update power dialer list contact status if listId provided
    if (listId) {
      // Determine final status based on disposition (use already-defined dispName)
      let finalStatus: 'PENDING' | 'CALLED' | 'COMPLETED' | 'SKIPPED' | 'REMOVED' = 'COMPLETED' // Default: mark as done

      // Requeue if callback or no answer type
      if (dispName.includes('callback') || isNoAnswerDisposition) {
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

