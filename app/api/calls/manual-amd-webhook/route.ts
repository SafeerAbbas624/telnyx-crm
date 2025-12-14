/**
 * Webhook handler for manual multi-call AMD events
 * 
 * Handles AMD detection results for manual multi-line calls.
 * When human detected: transfers to WebRTC
 * When voicemail detected: hangs up
 */

import { NextRequest, NextResponse } from 'next/server'
import { pendingAMDCalls } from '@/lib/dialer/amd-calls-store'

export const dynamic = 'force-dynamic'

const TELNYX_API_KEY = process.env.TELNYX_API_V2_KEY || process.env.TELNYX_API_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eventType = body.data?.event_type
    const callControlId = body.data?.payload?.call_control_id
    const clientStateBase64 = body.data?.payload?.client_state

    console.log(`[Manual AMD Webhook] Event: ${eventType}, CallControlId: ${callControlId}`)

    // Decode client state
    let clientState: any = {}
    if (clientStateBase64) {
      try {
        clientState = JSON.parse(Buffer.from(clientStateBase64, 'base64').toString())
      } catch (e) {
        console.error('[Manual AMD Webhook] Failed to decode client_state')
      }
    }

    // Only process manual multi-call events
    if (clientState.type !== 'manual_multi_call') {
      return NextResponse.json({ received: true })
    }

    const pendingCall = pendingAMDCalls.get(callControlId)

    switch (eventType) {
      case 'call.initiated':
        if (pendingCall) {
          pendingCall.status = 'initiated'
        }
        break

      case 'call.answered':
        if (pendingCall) {
          pendingCall.status = 'answered'
        }
        console.log(`[Manual AMD Webhook] Call answered, waiting for AMD result`)
        break

      case 'call.machine.premium.detection.ended':
      case 'call.machine.detection.ended': {
        const result = body.data?.payload?.result
        console.log(`[Manual AMD Webhook] AMD Result: ${result}`)

        if (result === 'human' || result === 'human_detected') {
          // Human detected - transfer to WebRTC
          console.log(`[Manual AMD Webhook] Human detected, transferring to WebRTC`)
          
          if (pendingCall) {
            pendingCall.status = 'human_detected'
          }

          // Transfer to WebRTC SIP endpoint
          const rtcLogin = process.env.TELNYX_RTC_LOGIN
          const sipDomain = process.env.TELNYX_RTC_SIP_DOMAIN || 'sip.telnyx.com'
          
          if (rtcLogin) {
            const sipUri = `sip:${rtcLogin}@${sipDomain}`
            await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${TELNYX_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: sipUri,
                from: pendingCall?.fromNumber,
              }),
            })
          }
        } else {
          // Voicemail/machine detected - hang up
          console.log(`[Manual AMD Webhook] Machine detected (${result}), hanging up`)
          
          if (pendingCall) {
            pendingCall.status = 'machine_detected'
          }

          await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${TELNYX_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          })
        }
        break
      }

      case 'call.hangup':
        console.log(`[Manual AMD Webhook] Call hung up`)
        pendingAMDCalls.delete(callControlId)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Manual AMD Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

