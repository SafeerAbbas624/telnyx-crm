import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      )
    }

    // Build the query based on user role
    let whereClause: any = { id: contactId }

    // If user is a team member, only allow access to assigned contacts
    if (session.user.role === 'TEAM_MEMBER') {
      whereClause = {
        id: contactId,
        assignedUsers: {
          some: {
            userId: session.user.id
          }
        }
      }
    }

    // Get contact to find phone numbers
    const contact = await prisma.contact.findUnique({
      where: whereClause,
      select: {
        id: true,
        phone1: true,
        phone2: true,
        phone3: true,
      }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const phoneNumbers = [contact.phone1, contact.phone2, contact.phone3].filter(Boolean)

    // Get calls for this contact from TelnyxCall table
    const calls = await prisma.telnyxCall.findMany({
      where: {
        OR: [
          // Calls linked directly to contact
          { contactId: contactId },
          // Outbound calls to contact's phone numbers
          {
            AND: [
              { direction: 'outbound' },
              { toNumber: { in: phoneNumbers } }
            ]
          },
          // Inbound calls from contact's phone numbers
          {
            AND: [
              { direction: 'inbound' },
              { fromNumber: { in: phoneNumbers } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        direction: true,
        status: true,
        duration: true,
        fromNumber: true,
        toNumber: true,
        createdAt: true,
        answeredAt: true,
        endedAt: true,
        hangupCause: true,
        recordingUrl: true,
      }
    })

    // Transform to match timeline format
    const transformedCalls = calls.map(call => ({
      id: call.id,
      direction: call.direction,
      status: call.status,
      duration: call.duration,
      timestamp: call.createdAt,
      createdAt: call.createdAt,
      startTime: call.answeredAt || call.createdAt,
      notes: call.hangupCause ? `Call ended: ${call.hangupCause}` : null,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      recordingUrl: call.recordingUrl,
    }))

    return NextResponse.json(transformedCalls)
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}
