/**
 * Manual Call with AMD (Answering Machine Detection)
 * 
 * For multi-line manual calling - when user is calling 2+ numbers simultaneously,
 * we use AMD to detect voicemails and auto-hang up, only connecting to live humans.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pendingAMDCalls } from '@/lib/dialer/amd-calls-store'

export const dynamic = 'force-dynamic'

const TELNYX_API_KEY = process.env.TELNYX_API_V2_KEY || process.env.TELNYX_API_KEY
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || process.env.TELNYX_SIP_CONNECTION_ID
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contactId, contactName, fromNumber, toNumber } = body

    if (!fromNumber || !toNumber) {
      return NextResponse.json({ error: 'Missing required fields: fromNumber, toNumber' }, { status: 400 })
    }

    // Initiate call with AMD via Telnyx Call Control API
    const telnyxResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: TELNYX_CONNECTION_ID,
        to: toNumber,
        from: fromNumber,
        // Use 'premium' AMD for ML-based detection with high accuracy
        // Premium AMD uses speech recognition + ML to distinguish humans from machines
        answering_machine_detection: 'premium',
        answering_machine_detection_config: {
          // BALANCED AMD: Prioritize accuracy over speed to reduce false positives
          total_analysis_time_millis: 5000,      // 5 seconds max total analysis
          after_greeting_silence_millis: 1200,   // 1.2s silence after greeting
          between_words_silence_millis: 600,     // 0.6s between words
          greeting_duration_millis: 4000,        // 4s max greeting length
          initial_silence_millis: 2500,          // 2.5s initial silence before speech
          maximum_number_of_words: 8,            // 8 words max
          silence_threshold: 256,
          greeting_total_analysis_time_millis: 5000, // 5s total for greeting analysis
        },
        webhook_url: `${WEBHOOK_BASE_URL}/api/calls/manual-amd-webhook`,
        client_state: Buffer.from(JSON.stringify({
          type: 'manual_multi_call',
          contactId,
          contactName,
          userId: session.user.id,
        })).toString('base64'),
        timeout_secs: 30,
        time_limit_secs: 600,
      })
    })

    if (!telnyxResponse.ok) {
      const errorData = await telnyxResponse.json().catch(() => ({}))
      console.error('[Manual AMD Call] Telnyx API error:', errorData)
      return NextResponse.json({ 
        error: 'Failed to initiate call',
        details: errorData 
      }, { status: 500 })
    }

    const telnyxData = await telnyxResponse.json()
    const callControlId = telnyxData.data?.call_control_id
    const callLegId = telnyxData.data?.call_leg_id

    if (!callControlId) {
      return NextResponse.json({ error: 'No call control ID returned' }, { status: 500 })
    }

    // Store pending call metadata
    pendingAMDCalls.set(callControlId, {
      type: 'manual_multi_call',
      contactId,
      contactName,
      fromNumber,
      toNumber,
      userId: session.user.id,
      startedAt: Date.now(),
      status: 'initiated',
    })

    console.log(`[Manual AMD Call] Initiated call to ${toNumber} from ${fromNumber}, callControlId: ${callControlId}`)

    return NextResponse.json({
      success: true,
      callControlId,
      callLegId,
    })

  } catch (error) {
    console.error('[Manual AMD Call] Error:', error)
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 })
  }
}

