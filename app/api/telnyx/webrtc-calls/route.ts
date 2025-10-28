import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * POST /api/telnyx/webrtc-calls
 * Create a TelnyxCall record for WebRTC calls
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      webrtcSessionId,
      contactId,
      fromNumber,
      toNumber,
    } = body

    if (!fromNumber || !toNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: fromNumber, toNumber' },
        { status: 400 }
      )
    }

    console.log('[WEBRTC CALLS][CREATE]', {
      webrtcSessionId,
      contactId,
      fromNumber,
      toNumber,
      userId: session.user.id
    })

    // Check if a record already exists for this session
    if (webrtcSessionId) {
      const existing = await prisma.telnyxCall.findFirst({
        where: { telnyxSessionId: webrtcSessionId }
      })
      
      if (existing) {
        console.log('[WEBRTC CALLS][CREATE] Record already exists', { id: existing.id })
        return NextResponse.json({
          success: true,
          callId: existing.id,
          telnyxCallId: existing.telnyxCallId,
          message: 'Call record already exists'
        })
      }
    }

    // Create new call record
    const call = await prisma.telnyxCall.create({
      data: {
        telnyxSessionId: webrtcSessionId || null,
        contactId: contactId || null,
        initiatedBy: session.user.id,
        fromNumber,
        toNumber,
        direction: 'outbound',
        status: 'initiated',
      }
    })

    console.log('[WEBRTC CALLS][CREATE] ✅ Created call record', {
      id: call.id,
      telnyxSessionId: call.telnyxSessionId,
      contactId: call.contactId,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber
    })

    // Update phone number usage stats
    if (prisma.telnyxPhoneNumber) {
      try {
        await prisma.telnyxPhoneNumber.update({
          where: { phoneNumber: fromNumber },
          data: {
            totalCallCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        })
      } catch (err) {
        console.warn('[WEBRTC CALLS][CREATE] Could not update phone number stats:', err)
      }
    }

    return NextResponse.json({
      success: true,
      callId: call.id,
      telnyxCallId: call.telnyxCallId,
    })
  } catch (error) {
    console.error('[WEBRTC CALLS][CREATE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create call record' },
      { status: 500 }
    )
  }
}

