import { NextRequest, NextResponse } from 'next/server'
import { processCallCostFetchJobs } from '@/lib/jobs/fetch-call-cost'

/**
 * Cron endpoint to process pending call cost fetch jobs
 * 
 * This should be called periodically (e.g., every minute) by a cron service
 * 
 * GET /api/cron/process-call-costs
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication for cron endpoint
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[CRON] Processing call cost fetch jobs...')

    const result = await processCallCostFetchJobs()

    console.log('[CRON] Call cost fetch jobs processed:', result)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[CRON] Error processing call cost fetch jobs:', error)
    return NextResponse.json(
      { error: 'Failed to process jobs' },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}

