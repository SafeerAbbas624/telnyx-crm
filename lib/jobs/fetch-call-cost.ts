/**
 * Background Job: Fetch Call Cost from Telnyx Detail Records API
 * 
 * This job runs after a call ends to fetch the exact cost from Telnyx's Detail Records API.
 * It's more reliable than waiting for webhook cost data which may not always be sent.
 */

import { prisma } from '@/lib/db'
import { fetchCallDetailRecord } from '@/lib/telnyx-detail-records'

interface FetchCallCostResult {
  success: boolean
  callId: string
  cost: number | null
  shouldRetry: boolean
  error?: string
}

/**
 * Fetch call cost from Telnyx Detail Records API and update database
 * 
 * @param callControlId - Telnyx call_control_id (call_leg_id)
 * @param maxRetries - Maximum number of retries if cost not found (default: 3)
 * @param retryDelaySeconds - Delay between retries in seconds (default: 60)
 */
export async function fetchAndUpdateCallCost(
  callControlId: string,
  maxRetries: number = 3,
  retryDelaySeconds: number = 60
): Promise<FetchCallCostResult> {
  try {
    console.log('[FETCH CALL COST] Starting for call:', callControlId)

    // Find the call in database
    const call = await prisma.telnyxCall?.findFirst({
      where: { telnyxCallId: callControlId },
    })

    if (!call) {
      console.error('[FETCH CALL COST] Call not found in database:', callControlId)
      return {
        success: false,
        callId: callControlId,
        cost: null,
        shouldRetry: false,
        error: 'Call not found in database',
      }
    }

    // Check if call already has accurate cost (not estimated)
    const existingBilling = await prisma.telnyxBilling?.findFirst({
      where: {
        recordId: callControlId,
        recordType: 'call',
      },
    })

    if (existingBilling && existingBilling.metadata) {
      const metadata = existingBilling.metadata as any
      // If cost is not estimated, skip fetching
      if (!metadata.estimated && existingBilling.cost && existingBilling.cost > 0) {
        console.log('[FETCH CALL COST] Call already has accurate cost:', {
          callControlId,
          cost: existingBilling.cost,
        })
        return {
          success: true,
          callId: callControlId,
          cost: parseFloat(existingBilling.cost.toString()),
          shouldRetry: false,
        }
      }
    }

    // Fetch cost from Telnyx Detail Records API
    const detailRecord = await fetchCallDetailRecord(callControlId)

    if (!detailRecord.found || detailRecord.cost === null) {
      console.log('[FETCH CALL COST] Cost not found in detail records:', {
        callControlId,
        found: detailRecord.found,
      })
      
      // Retry if cost not found (Telnyx may take time to process)
      return {
        success: false,
        callId: callControlId,
        cost: null,
        shouldRetry: true,
        error: 'Cost not found in detail records',
      }
    }

    console.log('[FETCH CALL COST] Found cost in detail records:', {
      callControlId,
      cost: detailRecord.cost,
      currency: detailRecord.currency,
      billedSeconds: detailRecord.billedSeconds,
    })

    // Update call record with accurate cost
    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: callControlId },
      data: {
        cost: detailRecord.cost,
        updatedAt: new Date(),
      },
    })

    // Update or create billing record
    if (prisma.telnyxBilling) {
      if (existingBilling) {
        // Update existing billing record
        const oldCost = parseFloat(existingBilling.cost?.toString() || '0')
        const costDiff = detailRecord.cost - oldCost

        await prisma.telnyxBilling.update({
          where: { id: existingBilling.id },
          data: {
            cost: detailRecord.cost,
            currency: detailRecord.currency,
            description: `Call to ${call.toNumber} (${detailRecord.billedSeconds || call.duration || 0}s)`,
            metadata: {
              source: 'detail_records_api',
              rate: detailRecord.rate,
              billedSeconds: detailRecord.billedSeconds,
              callSeconds: detailRecord.callSeconds,
              fetchedAt: new Date().toISOString(),
            },
          },
        })

        // Update phone number total cost (adjust for difference)
        if (prisma.telnyxPhoneNumber && costDiff !== 0) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: call.fromNumber },
            data: { totalCost: { increment: costDiff } },
          })
        }

        console.log('[FETCH CALL COST] Updated existing billing record:', {
          callControlId,
          oldCost,
          newCost: detailRecord.cost,
          costDiff,
        })
      } else {
        // Create new billing record
        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: call.fromNumber,
            recordType: 'call',
            recordId: callControlId,
            cost: detailRecord.cost,
            currency: detailRecord.currency,
            billingDate: call.endedAt || call.createdAt,
            description: `Call to ${call.toNumber} (${detailRecord.billedSeconds || call.duration || 0}s)`,
            metadata: {
              source: 'detail_records_api',
              rate: detailRecord.rate,
              billedSeconds: detailRecord.billedSeconds,
              callSeconds: detailRecord.callSeconds,
              fetchedAt: new Date().toISOString(),
            },
          },
        })

        // Update phone number total cost
        if (prisma.telnyxPhoneNumber) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: call.fromNumber },
            data: { totalCost: { increment: detailRecord.cost } },
          })
        }

        console.log('[FETCH CALL COST] Created new billing record:', {
          callControlId,
          cost: detailRecord.cost,
        })
      }
    }

    return {
      success: true,
      callId: callControlId,
      cost: detailRecord.cost,
      shouldRetry: false,
    }

  } catch (error) {
    console.error('[FETCH CALL COST] Error:', error)
    return {
      success: false,
      callId: callControlId,
      cost: null,
      shouldRetry: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process pending call cost fetch jobs
 * This should be called periodically (e.g., every minute) by a cron job
 */
export async function processCallCostFetchJobs() {
  try {
    // Find pending jobs that are ready to run
    const jobs = await prisma.telnyxCdrReconcileJob?.findMany({
      where: {
        status: 'pending',
        nextRunAt: {
          lte: new Date(),
        },
      },
      take: 10, // Process 10 jobs at a time
      orderBy: {
        nextRunAt: 'asc',
      },
    })

    if (!jobs || jobs.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, retried: 0 }
    }

    console.log(`[FETCH CALL COST] Processing ${jobs.length} jobs`)

    let succeeded = 0
    let failed = 0
    let retried = 0

    for (const job of jobs) {
      const result = await fetchAndUpdateCallCost(job.telnyxCallId)

      if (result.success) {
        // Mark job as completed
        await prisma.telnyxCdrReconcileJob?.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        })
        succeeded++
      } else if (result.shouldRetry && job.attempts < 5) {
        // Retry with exponential backoff
        const nextRunAt = new Date(Date.now() + Math.pow(2, job.attempts) * 60 * 1000)
        await prisma.telnyxCdrReconcileJob?.update({
          where: { id: job.id },
          data: {
            attempts: job.attempts + 1,
            nextRunAt,
            lastError: result.error,
          },
        })
        retried++
      } else {
        // Mark job as failed
        await prisma.telnyxCdrReconcileJob?.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            lastError: result.error,
            completedAt: new Date(),
          },
        })
        failed++
      }
    }

    console.log(`[FETCH CALL COST] Processed ${jobs.length} jobs:`, {
      succeeded,
      failed,
      retried,
    })

    return { processed: jobs.length, succeeded, failed, retried }

  } catch (error) {
    console.error('[FETCH CALL COST] Error processing jobs:', error)
    return { processed: 0, succeeded: 0, failed: 0, retried: 0 }
  }
}

