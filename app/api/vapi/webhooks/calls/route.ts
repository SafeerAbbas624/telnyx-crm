import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// Webhook health check
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Vapi webhook endpoint is ready' })
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}

// Verify webhook signature
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')
    return hash === signature
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Signature verification error:', error)
    return false
  }
}

// POST - Handle Vapi webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-vapi-signature')

    console.log('[VAPI][WEBHOOK] Received webhook event')

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET
    if (webhookSecret && signature) {
      if (!verifyWebhookSignature(body, signature, webhookSecret)) {
        console.warn('[VAPI][WEBHOOK] Invalid signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    const data = JSON.parse(body)
    const { message, data: callData } = data

    console.log('[VAPI][WEBHOOK] Event:', message, 'Call ID:', callData?.id)

    if (!callData?.id) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    // Find the call in our database
    const call = await prisma.vapiCall.findUnique({
      where: { vapi_call_id: callData.id }
    })

    if (!call) {
      console.warn('[VAPI][WEBHOOK] Call not found in database:', callData.id)
      return NextResponse.json({ success: true, message: 'Call not found, ignoring' })
    }

    // Handle different event types
    switch (message) {
      case 'call.queued':
        await handleCallQueued(call.id, callData)
        break

      case 'call.ringing':
        await handleCallRinging(call.id, callData)
        break

      case 'call.started':
        await handleCallStarted(call.id, callData)
        break

      case 'call.ended':
        await handleCallEnded(call.id, callData)
        break

      case 'call.error':
        await handleCallError(call.id, callData)
        break

      case 'call.recording.ready':
        await handleRecordingReady(call.id, callData)
        break

      case 'call.transcript.ready':
        await handleTranscriptReady(call.id, callData)
        break

      case 'call.summary.ready':
        await handleSummaryReady(call.id, callData)
        break

      default:
        console.log('[VAPI][WEBHOOK] Unknown event type:', message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

async function handleCallQueued(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: { status: 'queued' }
    })
    console.log('[VAPI][WEBHOOK] Call queued:', callId)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.queued:', error)
  }
}

async function handleCallRinging(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: { status: 'ringing' }
    })
    console.log('[VAPI][WEBHOOK] Call ringing:', callId)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.ringing:', error)
  }
}

async function handleCallStarted(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: {
        status: 'in_progress',
        started_at: data.startedAt ? new Date(data.startedAt) : new Date(),
      }
    })
    console.log('[VAPI][WEBHOOK] Call started:', callId)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.started:', error)
  }
}

async function handleCallEnded(callId: string, data: any) {
  try {
    const duration = data.endedAt && data.startedAt
      ? Math.floor((new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) / 1000)
      : undefined

    await prisma.vapiCall.update({
      where: { id: callId },
      data: {
        status: 'ended',
        ended_at: data.endedAt ? new Date(data.endedAt) : new Date(),
        ended_reason: data.endedReason,
        duration,
        cost: data.cost ? parseFloat(data.cost) : undefined,
        cost_breakdown: data.costBreakdown || {},
      }
    })
    console.log('[VAPI][WEBHOOK] Call ended:', callId, 'Duration:', duration, 'Cost:', data.cost)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.ended:', error)
  }
}

async function handleCallError(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: {
        status: 'ended',
        ended_reason: data.error || data.message || 'Call error',
        ended_at: new Date(),
      }
    })
    console.error('[VAPI][WEBHOOK] Call error:', callId, data.error || data.message)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.error:', error)
  }
}

async function handleRecordingReady(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: {
        recording_url: data.recordingUrl,
        stereo_recording_url: data.stereoRecordingUrl,
        mono_recording_url: data.monoRecordingUrl,
      }
    })
    console.log('[VAPI][WEBHOOK] Recording ready:', callId)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.recording.ready:', error)
  }
}

async function handleTranscriptReady(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: {
        transcript: data.transcript,
        messages: data.messages || [],
        messages_openai_formatted: data.messagesOpenaiFormatted || [],
      }
    })
    console.log('[VAPI][WEBHOOK] Transcript ready:', callId)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.transcript.ready:', error)
  }
}

async function handleSummaryReady(callId: string, data: any) {
  try {
    await prisma.vapiCall.update({
      where: { id: callId },
      data: {
        summary: data.summary,
        analysis: data.analysis || {},
      }
    })
    console.log('[VAPI][WEBHOOK] Summary ready:', callId)
  } catch (error) {
    console.error('[VAPI][WEBHOOK] Error handling call.summary.ready:', error)
  }
}

