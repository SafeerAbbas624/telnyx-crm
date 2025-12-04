import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/telnyx/recordings/[id] - Get a fresh signed URL for a recording
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    // First, fetch the call record to get the recording_id from webhook_data
    const call = await prisma.telnyxCall.findUnique({
      where: { id },
      select: { webhookData: true, recordingUrl: true }
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const webhookData = call.webhookData as any
    const recordingId = webhookData?.recording_id

    if (!recordingId) {
      // No recording_id stored, return the existing URL (may be expired)
      return NextResponse.json({ 
        url: call.recordingUrl,
        warning: 'No recording ID stored, URL may be expired'
      })
    }

    // Fetch fresh signed URL from Telnyx API
    const telnyxApiKey = process.env.TELNYX_API_KEY
    if (!telnyxApiKey) {
      return NextResponse.json({ error: 'Telnyx API key not configured' }, { status: 500 })
    }

    const response = await fetch(`https://api.telnyx.com/v2/recordings/${recordingId}`, {
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Telnyx API error:', response.status, await response.text())
      // Fall back to stored URL
      return NextResponse.json({ 
        url: call.recordingUrl,
        warning: 'Could not refresh URL from Telnyx'
      })
    }

    const data = await response.json()
    const freshUrl = data.data?.download_urls?.mp3 || data.data?.recording_urls?.mp3

    if (freshUrl) {
      // Update the stored URL with the fresh one
      await prisma.telnyxCall.update({
        where: { id },
        data: { recordingUrl: freshUrl, updatedAt: new Date() }
      })
      
      return NextResponse.json({ url: freshUrl })
    }

    // Fall back to stored URL
    return NextResponse.json({ 
      url: call.recordingUrl,
      warning: 'No fresh URL available from Telnyx'
    })

  } catch (error) {
    console.error('Error fetching recording:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    )
  }
}

