/**
 * Telnyx Webhook Handler for Multi-Line Power Dialer
 * 
 * Handles call events from Telnyx for dialer runs:
 * - call.initiated
 * - call.ringing
 * - call.answered
 * - call.machine.detection.ended
 * - call.hangup
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getRunIdFromCallControlId,
  getLegByCallControlId,
  handleCallAnswered,
  handleAnsweredCallEnded,
  handleNonAnsweredCallEnded,
  handleAMDResult,
  updateLegStatus,
  cleanupCallControlId,
  handleWebRTCCallAnswered,
  cleanupWebRTCBridgeMapping,
} from '@/lib/dialer/engine'
import type { AMDResult } from '@/lib/dialer/types'

interface TelnyxWebhookPayload {
  data: {
    event_type: string
    id: string
    occurred_at: string
    payload: {
      call_control_id: string
      call_leg_id?: string
      call_session_id?: string
      client_state?: string
      connection_id?: string
      from?: string
      to?: string
      direction?: string
      state?: string
      hangup_cause?: string
      hangup_source?: string
      sip_hangup_cause?: string
      result?: string // AMD result
    }
  }
}

interface ClientState {
  runId: string
  legId: string
  listEntryId: string
}

interface WebRTCBridgeClientState {
  type: 'webrtc_bridge'
  pstnCallControlId: string
  runId: string
  legId: string
}

interface WebRTCConferenceClientState {
  type: 'webrtc_conference'
  conferenceId: string
  pstnCallControlId: string
  runId: string
  legId: string
}

type AnyClientState = ClientState | WebRTCBridgeClientState | WebRTCConferenceClientState

function parseClientState(clientStateBase64?: string): AnyClientState | null {
  if (!clientStateBase64) return null
  try {
    const decoded = Buffer.from(clientStateBase64, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function isWebRTCBridgeClientState(state: AnyClientState | null): state is WebRTCBridgeClientState {
  return state !== null && 'type' in state && state.type === 'webrtc_bridge'
}

function isWebRTCConferenceClientState(state: AnyClientState | null): state is WebRTCConferenceClientState {
  return state !== null && 'type' in state && state.type === 'webrtc_conference'
}

export async function POST(request: NextRequest) {
  try {
    const body: TelnyxWebhookPayload = await request.json()
    const { event_type, payload } = body.data

    console.log(`[DIALER WEBHOOK] Received: ${event_type}`, {
      call_control_id: payload.call_control_id,
      from: payload.from,
      to: payload.to
    })

    const callControlId = payload.call_control_id
    if (!callControlId) {
      return NextResponse.json({ received: true })
    }

    // Parse client state to determine call type
    const clientState = parseClientState(payload.client_state)

    // Handle WebRTC bridge calls separately (legacy bridge approach)
    if (isWebRTCBridgeClientState(clientState)) {
      console.log(`[DIALER WEBHOOK] WebRTC bridge call event: ${event_type}`)

      if (event_type === 'call.answered') {
        // WebRTC call answered - bridge it to the PSTN call
        const bridged = await handleWebRTCCallAnswered(callControlId)
        if (bridged) {
          console.log(`[DIALER WEBHOOK] WebRTC call bridged successfully`)
        } else {
          console.error(`[DIALER WEBHOOK] Failed to bridge WebRTC call`)
        }
      } else if (event_type === 'call.hangup') {
        // WebRTC call ended - clean up mapping
        cleanupWebRTCBridgeMapping(callControlId)
      }

      return NextResponse.json({ received: true })
    }

    // Handle WebRTC conference calls (new conference approach)
    if (isWebRTCConferenceClientState(clientState)) {
      console.log(`[DIALER WEBHOOK] WebRTC conference call event: ${event_type}`, {
        conferenceId: clientState.conferenceId
      })

      if (event_type === 'call.answered') {
        // WebRTC call answered - join it to the conference
        const joined = await handleWebRTCCallAnswered(callControlId)
        if (joined) {
          console.log(`[DIALER WEBHOOK] WebRTC call joined conference successfully`)
        } else {
          console.error(`[DIALER WEBHOOK] Failed to join WebRTC call to conference`)
        }
      } else if (event_type === 'call.hangup') {
        // WebRTC call ended - clean up mapping
        cleanupWebRTCBridgeMapping(callControlId)
      }

      return NextResponse.json({ received: true })
    }

    // Regular PSTN call handling
    const runId = clientState?.runId || getRunIdFromCallControlId(callControlId)

    if (!runId) {
      console.log(`[DIALER WEBHOOK] No run found for call ${callControlId}`)
      return NextResponse.json({ received: true })
    }

    const leg = getLegByCallControlId(runId, callControlId)
    const legId = (clientState && 'legId' in clientState ? clientState.legId : undefined) || leg?.legId

    if (!legId) {
      console.log(`[DIALER WEBHOOK] No leg found for call ${callControlId}`)
      return NextResponse.json({ received: true })
    }

    switch (event_type) {
      case 'call.initiated':
        // Call has been initiated
        await updateLegStatus(runId, legId, 'dialing')
        break

      case 'call.ringing':
        // Remote party's phone is ringing
        await updateLegStatus(runId, legId, 'ringing')
        break

      case 'call.answered':
        // Call was answered - this triggers first-answer-wins logic
        await handleCallAnswered(runId, legId)
        break

      case 'call.machine.detection.ended':
        // AMD result received
        const amdResult = mapTelnyxAMDResult(payload.result)
        await handleAMDResult(runId, legId, amdResult)
        break

      case 'call.hangup':
        // Call ended
        const hangupCause = payload.hangup_cause || payload.sip_hangup_cause

        if (leg?.status === 'answered') {
          // Answered call ended - calculate talk duration
          const duration = leg?.answeredAt
            ? Math.floor((Date.now() - new Date(leg.answeredAt).getTime()) / 1000)
            : 0
          await handleAnsweredCallEnded(runId, legId, duration)
        } else {
          // Non-answered call ended (busy, no_answer, failed, etc.)
          await handleNonAnsweredCallEnded(runId, legId, hangupCause)
        }

        // Clean up mappings
        cleanupCallControlId(callControlId)
        cleanupWebRTCBridgeMapping(callControlId)
        break

      default:
        console.log(`[DIALER WEBHOOK] Unhandled event: ${event_type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[DIALER WEBHOOK] Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

function mapTelnyxAMDResult(result?: string): AMDResult {
  switch (result?.toLowerCase()) {
    case 'human':
    case 'human_residence':
    case 'human_business':
      return 'human'
    case 'machine':
    case 'machine_start':
    case 'machine_end_beep':
    case 'machine_end_silence':
    case 'machine_end_other':
      return 'machine'
    case 'fax':
      return 'fax'
    default:
      return 'unknown'
  }
}

