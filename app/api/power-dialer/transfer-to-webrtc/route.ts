import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Transfer an active Call Control call to the WebRTC SIP endpoint.
 * This is used by the Power Dialer when AMD detects a human - instead of
 * starting a new call, we transfer the existing call to the WebRTC client.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { callControlId, callerIdNumber } = await req.json()

  if (!callControlId) {
    return NextResponse.json({ error: 'callControlId is required' }, { status: 400 })
  }

  // Get WebRTC SIP credentials
  const rtcLogin = process.env.TELNYX_RTC_LOGIN
  const sipDomain = process.env.TELNYX_RTC_SIP_DOMAIN || 'sip.telnyx.com'

  if (!rtcLogin) {
    return NextResponse.json({ error: 'WebRTC credentials not configured' }, { status: 500 })
  }

  // Build the SIP URI for the WebRTC client
  // Format: sip:username@domain
  const sipUri = `sip:${rtcLogin}@${sipDomain}`

  console.log(`[Transfer] Transferring call ${callControlId} to WebRTC SIP: ${sipUri}`)

  try {
    const apiKey = process.env.TELNYX_V2_KEY || process.env.TELNYX_API_KEY

    // Use Telnyx Transfer API to transfer the call to the WebRTC SIP endpoint
    const response = await fetch(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Transfer to the SIP URI of the WebRTC client
          to: sipUri,
          // Use the same caller ID
          from: callerIdNumber,
          // Optional: Add custom SIP headers if needed
          // sip_headers: [],
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Transfer] Telnyx transfer failed:', response.status, errorText)
      return NextResponse.json(
        { error: `Transfer failed: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('[Transfer] Transfer successful:', result)

    return NextResponse.json({
      success: true,
      callControlId,
      transferredTo: sipUri,
      result,
    })
  } catch (error) {
    console.error('[Transfer] Error transferring call:', error)
    return NextResponse.json(
      { error: 'Failed to transfer call', details: String(error) },
      { status: 500 }
    )
  }
}

