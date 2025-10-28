import { NextRequest, NextResponse } from 'next/server'
import { fetchAndUpdateCallCost } from '@/lib/jobs/fetch-call-cost'

/**
 * API endpoint to manually fetch call cost from Telnyx Detail Records API
 * 
 * POST /api/billing/fetch-call-cost
 * Body: { callControlId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { callControlId } = body

    if (!callControlId) {
      return NextResponse.json(
        { error: 'Missing callControlId' },
        { status: 400 }
      )
    }

    console.log('[API] Fetching call cost for:', callControlId)

    const result = await fetchAndUpdateCallCost(callControlId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        callId: result.callId,
        cost: result.cost,
        message: 'Call cost updated successfully',
      })
    } else {
      return NextResponse.json({
        success: false,
        callId: result.callId,
        error: result.error,
        shouldRetry: result.shouldRetry,
      }, { status: result.shouldRetry ? 202 : 500 })
    }

  } catch (error) {
    console.error('[API] Error fetching call cost:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call cost' },
      { status: 500 }
    )
  }
}

