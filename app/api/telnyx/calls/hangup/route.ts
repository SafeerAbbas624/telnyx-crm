import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const TELNYX_API_KEY = process.env.TELNYX_API_KEY
const TELNYX_CALLS_API_URL = 'https://api.telnyx.com/v2/calls'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telnyxCallId } = body

    console.log('[TELNYX CALLS][HANGUP][INIT]', { telnyxCallId, ts: new Date().toISOString() })

    if (!TELNYX_API_KEY) {
      return NextResponse.json(
        { error: 'Telnyx API key not configured' },
        { status: 500 }
      )
    }

    if (!telnyxCallId) {
      return NextResponse.json(
        { error: 'telnyxCallId is required' },
        { status: 400 }
      )
    }

    const url = `${TELNYX_CALLS_API_URL}/${encodeURIComponent(telnyxCallId)}/actions/hangup`

    const telnyxResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    })

    const telnyxData = await telnyxResponse.json().catch(() => ({}))

    console.log('[TELNYX CALLS][HANGUP][RESPONSE]', {
      status: telnyxResponse.status,
      telnyxRequestId: telnyxResponse.headers.get('x-telnyx-request-id') || undefined,
      telnyxCallId,
    })

    if (!telnyxResponse.ok) {
      const firstError = Array.isArray((telnyxData as any)?.errors) ? (telnyxData as any).errors[0] : undefined
      const errorMessage = firstError?.detail || firstError?.title || 'Failed to hang up call via Telnyx'
      return NextResponse.json(
        { error: errorMessage, telnyx: telnyxData, status: telnyxResponse.status },
        { status: telnyxResponse.status }
      )
    }

    // Optimistically update DB (webhook will finalize)
    try {
      if (prisma.telnyxCall) {
        const result = await prisma.telnyxCall.updateMany({
          where: { telnyxCallId },
          data: { status: 'hangup', endedAt: new Date() }
        })
        console.log('[TELNYX CALLS][HANGUP][DB]', { updatedCount: result.count, telnyxCallId })
      }
    } catch (e) {
      console.warn('Warning: failed to update call status after hangup:', e)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error hanging up call:', error)
    return NextResponse.json(
      { error: 'Failed to hang up call' },
      { status: 500 }
    )
  }
}

