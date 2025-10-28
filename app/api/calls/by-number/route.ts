import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { formatPhoneNumberForTelnyx, last10Digits, stripBidiAndZeroWidth } from '@/lib/phone-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('number')?.trim() || ''
    const limit = parseInt(searchParams.get('limit') || '200')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!raw) {
      return NextResponse.json({ error: 'number is required' }, { status: 400 })
    }

    const cleaned = stripBidiAndZeroWidth(raw)
    const e164 = formatPhoneNumberForTelnyx(cleaned) || cleaned
    const last10 = last10Digits(cleaned)

    console.log('[CALLS BY NUMBER] Query params:', { raw, cleaned, e164, last10, role: session.user.role })

    // Role-based access: team users may only fetch logs for their assigned number
    const role = session.user.role
    if (role === 'TEAM_USER' || role === 'TEAM_MEMBER') {
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { assignedPhoneNumber: true } })
      const assigned = user?.assignedPhoneNumber || ''
      const assignedLast10 = last10Digits(assigned)
      if (!assignedLast10 || assignedLast10 !== last10) {
        return NextResponse.json({ error: 'Forbidden: not your assigned number' }, { status: 403 })
      }
    }

    // Fetch calls where either side matches the number (robust matching: exact, endsWith, or contains last 10 digits)
    const orConditions: any[] = [
      { fromNumber: e164 },
      { toNumber: e164 },
    ]
    if (last10) {
      orConditions.push(
        { fromNumber: { endsWith: last10 } },
        { toNumber: { endsWith: last10 } },
        { fromNumber: { contains: last10 } },
        { toNumber: { contains: last10 } },
      )
    }

    console.log('[CALLS BY NUMBER] OR conditions:', JSON.stringify(orConditions, null, 2))

    const calls = await prisma.telnyxCall.findMany({
      where: {
        OR: orConditions
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        telnyxCallId: true,
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
        contactId: true,
      }
    })

    console.log('[CALLS BY NUMBER] Found calls:', calls.length)

    // Transform shape to match other calls endpoints
    const transformed = calls.map(call => ({
      id: call.id,
      telnyxCallId: call.telnyxCallId,
      direction: call.direction,
      status: call.status,
      duration: call.duration,
      timestamp: call.createdAt,
      createdAt: call.createdAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      startTime: call.answeredAt || call.createdAt,
      notes: call.hangupCause ? `Call ended: ${call.hangupCause}` : null,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      recordingUrl: call.recordingUrl,
      contactId: call.contactId,
    }))

    return NextResponse.json({ calls: transformed })
  } catch (error) {
    console.error('Error fetching calls by number:', error)
    return NextResponse.json({ error: 'Failed to fetch calls by number' }, { status: 500 })
  }
}

