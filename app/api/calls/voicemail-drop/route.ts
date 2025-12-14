import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST - Initiate voicemail drop on an active call
// This plays a pre-recorded voicemail message after detecting the beep
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { callControlId, voicemailMessageId } = await req.json()

    if (!callControlId) {
      return NextResponse.json({ error: 'callControlId is required' }, { status: 400 })
    }

    if (!voicemailMessageId) {
      return NextResponse.json({ error: 'voicemailMessageId is required' }, { status: 400 })
    }

    // Get the voicemail message
    const voicemail = await prisma.voicemailMessage.findUnique({
      where: { id: voicemailMessageId },
    })

    if (!voicemail) {
      return NextResponse.json({ error: 'Voicemail message not found' }, { status: 404 })
    }

    // Get the audio URL - we need to serve it publicly for Telnyx to access
    const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const audioUrl = `${baseUrl}/api/voicemail-messages/${voicemailMessageId}/audio`

    // Use Telnyx Call Control API to play the audio
    const telnyxApiKey = process.env.TELNYX_V2_KEY || process.env.TELNYX_API_KEY
    if (!telnyxApiKey) {
      return NextResponse.json({ error: 'Telnyx API key not configured' }, { status: 500 })
    }

    // Start playback on the call
    const playbackRes = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        overlay: false, // Don't overlay, replace the audio
        loop: 1, // Play once
        client_state: Buffer.from(JSON.stringify({
          action: 'voicemail_drop',
          voicemailMessageId,
          userId: session.user.id,
        })).toString('base64'),
      }),
    })

    if (!playbackRes.ok) {
      const errorData = await playbackRes.json().catch(() => ({}))
      console.error('[VoicemailDrop] Telnyx playback error:', errorData)
      return NextResponse.json({ error: 'Failed to start voicemail playback' }, { status: 500 })
    }

    // Increment usage count
    await prisma.voicemailMessage.update({
      where: { id: voicemailMessageId },
      data: { usageCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      message: 'Voicemail drop initiated',
      voicemailName: voicemail.name,
    })
  } catch (error) {
    console.error('[VoicemailDrop] Error:', error)
    return NextResponse.json({ error: 'Failed to initiate voicemail drop' }, { status: 500 })
  }
}

