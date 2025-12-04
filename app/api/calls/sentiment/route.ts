import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

/**
 * Simple sentiment analysis using keyword matching
 * In production, you'd use a service like AWS Comprehend, Google NLP, or OpenAI
 */
function analyzeSentiment(text: string): {
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
  summary: string
} {
  if (!text) {
    return { sentiment: 'neutral', score: 50, summary: 'No text to analyze' }
  }

  const lowerText = text.toLowerCase()

  // Positive keywords
  const positiveKeywords = [
    'interested',
    'yes',
    'great',
    'excellent',
    'perfect',
    'love',
    'amazing',
    'wonderful',
    'fantastic',
    'good',
    'happy',
    'excited',
    'definitely',
    'absolutely',
    'sure',
    'okay',
    'ok',
    'sounds good',
    'perfect timing',
    'exactly what',
  ]

  // Negative keywords
  const negativeKeywords = [
    'not interested',
    'no',
    'never',
    'hate',
    'terrible',
    'awful',
    'bad',
    'worst',
    'angry',
    'frustrated',
    'disappointed',
    'upset',
    'wrong',
    'problem',
    'issue',
    'complaint',
    'not now',
    'call back later',
    'do not call',
  ]

  let positiveCount = 0
  let negativeCount = 0

  positiveKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) positiveCount++
  })

  negativeKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) negativeCount++
  })

  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'
  let score = 50

  if (positiveCount > negativeCount) {
    sentiment = 'positive'
    score = Math.min(100, 50 + positiveCount * 10)
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative'
    score = Math.max(0, 50 - negativeCount * 10)
  }

  const summary =
    sentiment === 'positive'
      ? 'Caller expressed positive interest'
      : sentiment === 'negative'
        ? 'Caller expressed negative sentiment'
        : 'Neutral sentiment detected'

  return { sentiment, score, summary }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { callId, callType, transcript } = await req.json()

    if (!callId || !callType || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: callId, callType, transcript' },
        { status: 400 }
      )
    }

    const { sentiment, score, summary } = analyzeSentiment(transcript)

    // Update the call with sentiment analysis
    if (callType === 'telnyx') {
      await prisma.telnyxCall.update({
        where: { id: callId },
        data: {
          sentiment,
          sentimentScore: score,
          sentimentSummary: summary,
        },
      })
    } else if (callType === 'vapi') {
      await prisma.vapiCall.update({
        where: { id: callId },
        data: {
          sentiment,
          sentimentScore: score,
          sentimentSummary: summary,
        },
      })
    } else if (callType === 'power_dialer') {
      await prisma.powerDialerCall.update({
        where: { id: callId },
        data: {
          sentiment,
          sentimentScore: score,
          sentimentSummary: summary,
        },
      })
    }

    return NextResponse.json({
      success: true,
      sentiment,
      score,
      summary,
    })
  } catch (error) {
    console.error('Error analyzing sentiment:', error)
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const callId = searchParams.get('callId')
    const callType = searchParams.get('callType')

    if (!callId || !callType) {
      return NextResponse.json(
        { error: 'Missing required query params: callId, callType' },
        { status: 400 }
      )
    }

    let call: any = null

    if (callType === 'telnyx') {
      call = await prisma.telnyxCall.findUnique({
        where: { id: callId },
        select: {
          sentiment: true,
          sentimentScore: true,
          sentimentSummary: true,
        },
      })
    } else if (callType === 'vapi') {
      call = await prisma.vapiCall.findUnique({
        where: { id: callId },
        select: {
          sentiment: true,
          sentimentScore: true,
          sentimentSummary: true,
        },
      })
    } else if (callType === 'power_dialer') {
      call = await prisma.powerDialerCall.findUnique({
        where: { id: callId },
        select: {
          sentiment: true,
          sentimentScore: true,
          sentimentSummary: true,
        },
      })
    }

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json(call)
  } catch (error) {
    console.error('Error fetching sentiment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sentiment' },
      { status: 500 }
    )
  }
}

