import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const VAPI_API_URL = 'https://api.vapi.ai'

// POST - Control a Vapi call (pause, resume, stop)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (!action || !['pause', 'resume', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be pause, resume, or stop' },
        { status: 400 }
      )
    }

    // Get the call
    const call = await prisma.vapiCall.findUnique({
      where: { id: params.id }
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!call.vapi_call_id) {
      return NextResponse.json(
        { error: 'Call does not have a Vapi call ID' },
        { status: 400 }
      )
    }

    // Get the default API key
    const apiKeyRecord = await prisma.vapiApiKey.findFirst({
      where: { isActive: true }
    })

    if (!apiKeyRecord) {
      return NextResponse.json(
        { error: 'No Vapi API key configured' },
        { status: 400 }
      )
    }

    const decryptedApiKey = decrypt(apiKeyRecord.apiKey)

    // Make the control request to Vapi
    const controlUrl = `${VAPI_API_URL}/call/${call.vapi_call_id}/${action}`

    let vapiResponse: Response
    try {
      vapiResponse = await fetch(controlUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })
    } catch (fetchError) {
      console.error(`[VAPI][CONTROL] Network error:`, fetchError)
      return NextResponse.json(
        { error: 'Network error while controlling call' },
        { status: 503 }
      )
    }

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error(`[VAPI][CONTROL] Failed to ${action} call:`, vapiResponse.status, errorText)

      // Handle specific error codes
      if (vapiResponse.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        )
      } else if (vapiResponse.status === 404) {
        return NextResponse.json(
          { error: 'Call not found on Vapi' },
          { status: 404 }
        )
      } else if (vapiResponse.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited. Please try again later.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: `Failed to ${action} call: ${vapiResponse.statusText}` },
        { status: vapiResponse.status }
      )
    }

    // Update call status in database
    let newStatus = call.status
    if (action === 'pause') {
      newStatus = 'paused'
    } else if (action === 'resume') {
      newStatus = 'in_progress'
    } else if (action === 'stop') {
      newStatus = 'ended'
    }

    await prisma.vapiCall.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        ended_at: action === 'stop' ? new Date() : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      message: `Call ${action}ed successfully`,
      callId: params.id,
      action,
      newStatus
    })
  } catch (error) {
    console.error('[VAPI][CONTROL] Error:', error)
    return NextResponse.json(
      { error: 'Failed to control call' },
      { status: 500 }
    )
  }
}

