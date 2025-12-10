import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * POST /api/call-history/note
 * Save a call note/disposition for a power dialer call
 * Creates an activity record linked to the contact
 * Also increments dialAttempts counter on the contact
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[call-history/note] JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { contactId, disposition, notes, calledAt, callerIdNumber, duration } = body || {}

    console.log('[call-history/note] Received:', { contactId, disposition, notes: notes?.slice(0, 50), callerIdNumber })

    if (!contactId) {
      console.error('[call-history/note] Missing contactId in body:', body)
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    // Verify contact exists and get current customFields
    let contact
    try {
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, firstName: true, lastName: true, phone1: true, customFields: true }
      })
    } catch (dbError) {
      console.error('[call-history/note] DB error finding contact:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!contact) {
      console.error('[call-history/note] Contact not found:', contactId)
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Build the activity description
    const noteParts: string[] = []
    if (disposition) {
      noteParts.push(`Disposition: ${disposition}`)
    }
    if (callerIdNumber) {
      noteParts.push(`Called from: ${callerIdNumber}`)
    }
    if (notes) {
      noteParts.push(`Notes: ${notes}`)
    }

    const activityDescription = noteParts.join('\n') || 'Power Dialer call'

    // Increment dialAttempts counter on the contact's customFields
    const currentCustomFields = (contact.customFields as Record<string, any>) || {}
    const currentDialAttempts = currentCustomFields.dialAttempts || 0
    const newDialAttempts = currentDialAttempts + 1

    try {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          customFields: {
            ...currentCustomFields,
            dialAttempts: newDialAttempts,
            lastDialedAt: new Date().toISOString(),
            lastDisposition: disposition || null,
          }
        }
      })
      console.log(`[call-history/note] Updated contact ${contactId} dialAttempts: ${newDialAttempts}`)
    } catch (updateError) {
      console.error('[call-history/note] Error updating contact customFields:', updateError)
      // Continue anyway - activity creation is more important
    }

    // Create activity record (this shows in contact timeline)
    let activity
    try {
      activity = await prisma.activity.create({
        data: {
          contact_id: contactId,
          type: 'call',
          title: `Power Dialer Call - ${disposition || 'Completed'}`,
          description: activityDescription,
          status: 'completed',
          priority: 'medium',
          created_by: session.user.id,
          duration_minutes: duration ? Math.ceil(duration / 60) : undefined,
        }
      })
    } catch (activityError) {
      console.error('[call-history/note] Error creating activity:', activityError)
      return NextResponse.json({ error: 'Failed to create activity record' }, { status: 500 })
    }

    // Also try to update the Call record if we have one (for WebRTC calls)
    // This is optional - won't fail if no call record exists
    try {
      if (calledAt) {
        const callTime = new Date(calledAt)
        // Find a recent call to this contact from around this time
        const existingCall = await prisma.call.findFirst({
          where: {
            contactId,
            createdAt: {
              gte: new Date(callTime.getTime() - 60000), // 1 min before
              lte: new Date(callTime.getTime() + 300000), // 5 min after
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        if (existingCall) {
          await prisma.call.update({
            where: { id: existingCall.id },
            data: {
              notes: notes || undefined,
              disposition: disposition || undefined,
            }
          })
        }
      }
    } catch (e) {
      // Ignore call update errors - activity was created successfully
      console.log('[call-history/note] Could not update Call record:', e)
    }

    console.log(`[call-history/note] Created activity for contact ${contactId}: ${disposition}`)

    return NextResponse.json({
      success: true,
      activityId: activity.id,
      message: 'Call note saved'
    })

  } catch (error) {
    console.error('[call-history/note] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save call note' },
      { status: 500 }
    )
  }
}

