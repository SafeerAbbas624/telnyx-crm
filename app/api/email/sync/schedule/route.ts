import { NextRequest, NextResponse } from 'next/server'
import { queueEmailSync } from '@/lib/queues/email-sync-queue'

// Schedule automatic email sync every 30 seconds
export async function POST(request: NextRequest) {
  try {
    // Queue auto sync job
    const job = await queueEmailSync({
      type: 'auto',
    })

    return NextResponse.json({
      success: true,
      message: 'Auto sync scheduled',
      jobId: job.id,
    })
  } catch (error) {
    console.error('Error scheduling auto sync:', error)
    return NextResponse.json(
      { error: 'Failed to schedule auto sync' },
      { status: 500 }
    )
  }
}

