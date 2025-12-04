import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const contactIds = searchParams.get('contactIds')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user's assigned contacts
    const assignments = await prisma.contactAssignment.findMany({
      where: { userId },
      select: { contactId: true }
    })

    const assignedContactIds = assignments.map(a => a.contactId)

    // If no contacts assigned, return empty array
    if (assignedContactIds.length === 0) {
      return NextResponse.json({ calls: [] })
    }

    // Filter by specific contact IDs if provided
    let targetContactIds = assignedContactIds
    if (contactIds) {
      const requestedIds = contactIds.split(',').filter(Boolean)
      targetContactIds = assignedContactIds.filter(id => requestedIds.includes(id))
    }

    if (targetContactIds.length === 0) {
      return NextResponse.json({ calls: [] })
    }

    // Get contacts to find phone numbers
    const contacts = await prisma.contact.findMany({
      where: { id: { in: targetContactIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        phone2: true,
        phone3: true,
      }
    })

    // Collect all phone numbers from assigned contacts
    const phoneNumbers: string[] = []
    const contactPhoneMap: Record<string, string> = {}

    contacts.forEach(contact => {
      [contact.phone1, contact.phone2, contact.phone3].forEach(phone => {
        if (phone) {
          phoneNumbers.push(phone)
          contactPhoneMap[phone] = contact.id
        }
      })
    })

    if (phoneNumbers.length === 0) {
      return NextResponse.json({ calls: [] })
    }

    // Get calls for assigned contacts from TelnyxCall table
    const calls = await prisma.telnyxCall.findMany({
      where: {
        OR: [
          // Calls linked directly to assigned contacts
          { contactId: { in: targetContactIds } },
          // Outbound calls to assigned contacts' phone numbers
          {
            AND: [
              { direction: 'outbound' },
              { toNumber: { in: phoneNumbers } }
            ]
          },
          // Inbound calls from assigned contacts' phone numbers
          {
            AND: [
              { direction: 'inbound' },
              { fromNumber: { in: phoneNumbers } }
            ]
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Transform calls and add contact information
    const transformedCalls = calls.map(call => {
      // Determine which contact this call is associated with
      let associatedContact = null
      
      if (call.contactId && targetContactIds.includes(call.contactId)) {
        associatedContact = contacts.find(c => c.id === call.contactId)
      } else {
        // Find contact by phone number
        const phoneToCheck = call.direction === 'outbound' ? call.toNumber : call.fromNumber
        const contactId = contactPhoneMap[phoneToCheck]
        if (contactId) {
          associatedContact = contacts.find(c => c.id === contactId)
        }
      }

      // Derive duration if missing using timestamps (answeredAt/endedAt)
      let duration = (typeof call.duration === 'number') ? call.duration : 0
      if (!duration || duration <= 0) {
        const answered = call.answeredAt ? new Date(call.answeredAt).getTime() : null
        const ended = call.endedAt ? new Date(call.endedAt).getTime() : null
        if (answered && ended && ended >= answered) {
          duration = Math.round((ended - answered) / 1000)
        } else if (call.createdAt && ended && ended >= new Date(call.createdAt).getTime()) {
          duration = Math.round((ended - new Date(call.createdAt).getTime()) / 1000)
        }
      }

      return {
        id: call.id,
        telnyxCallId: call.telnyxCallId,
        direction: call.direction,
        status: call.status,
        duration,
        timestamp: call.createdAt,
        createdAt: call.createdAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        startTime: call.answeredAt || call.createdAt,
        notes: call.hangupCause ? `Call ended: ${call.hangupCause}` : null,
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        recordingUrl: call.recordingUrl,
        contact: associatedContact ? {
          id: associatedContact.id,
          name: `${associatedContact.firstName || ''} ${associatedContact.lastName || ''}`.trim(),
          firstName: associatedContact.firstName,
          lastName: associatedContact.lastName
        } : null
      }
    })

    return NextResponse.json({ calls: transformedCalls })
  } catch (error) {
    console.error('Error fetching team calls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}
