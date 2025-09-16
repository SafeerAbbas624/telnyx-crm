import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Processes pending Telnyx CDR reconciliation jobs by fetching Detail Records (/detail_records)
// and updating telnyx_calls + telnyx_billing with authoritative costs.
//
// Usage:
// - GET  /api/internal/reconcile/telnyx-cdr -> health/status
// - POST /api/internal/reconcile/telnyx-cdr[?force=1] -> process up to N pending jobs (force ignores nextRunAt)
//
// Configure env:
// - TELNYX_API_KEY=<secret>
//
// Recommended to trigger via a small cron every minute (e.g., PM2 cron):
//   curl -s -X POST https://your-domain/api/internal/reconcile/telnyx-cdr

const TELNYX_API_BASE = 'https://api.telnyx.com/v2'
const MAX_JOBS_PER_RUN = 10

export async function GET() {
  const counts = await prisma.$transaction([
    prisma.telnyxCdrReconcileJob.count({ where: { status: 'pending' } }),
    prisma.telnyxCdrReconcileJob.count({ where: { status: 'running' } }),
    prisma.telnyxCdrReconcileJob.count({ where: { status: 'failed' } }),
  ])
  return NextResponse.json({
    ok: true,
    pending: counts[0],
    running: counts[1],
    failed: counts[2],
    ts: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'Missing TELNYX_API_KEY' }, { status: 500 })
    }

    const url = new URL(request.url)
    const force = !!(url.searchParams.get('force') || '')

    // fetch due jobs (or all pending if force)
    const now = new Date()
    const where = force
      ? { status: 'pending' as const }
      : { status: 'pending' as const, nextRunAt: { lte: now } }

    const jobs = await prisma.telnyxCdrReconcileJob.findMany({
      where,
      orderBy: { nextRunAt: 'asc' },
      take: MAX_JOBS_PER_RUN,
    })

    if (!jobs.length) {
      return NextResponse.json({ ok: true, processed: 0 })
    }

    let processed = 0

    for (const job of jobs) {
      try {
        // mark running
        await prisma.telnyxCdrReconcileJob.update({
          where: { id: job.id },
          data: { status: 'running', attempts: { increment: 1 } },
        })

        // find the call
        const call = await prisma.telnyxCall.findFirst({
          where: {
            OR: [
              job.telnyxCallId ? { telnyxCallId: job.telnyxCallId } : undefined,
              job.telnyxSessionId ? { telnyxSessionId: job.telnyxSessionId } : undefined,
            ].filter(Boolean) as any,
          },
        })

        if (!call) {
          await failOrRetry(job, 'Associated call not found')
          continue
        }

        // skip if we already have a non-zero cost and job is older run
        const existingCost = call.cost ? parseFloat(call.cost.toString()) : 0

        // fetch CDR by session id primarily
        const cdr = await fetchCdr(apiKey, job.telnyxSessionId)
        if (!cdr) {
          await failOrRetry(job, 'CDR not available yet')
          continue
        }

        const parsed = parseCdrCost(cdr)
        if (!parsed) {
          await failOrRetry(job, 'CDR found but no cost amount')
          continue
        }
        const { amount, currency } = parsed

        const diff = amount - existingCost

        // Update call
        await prisma.telnyxCall.update({
          where: { id: call.id },
          data: { cost: amount },
        })

        // Upsert billing row
        const existingBilling = await prisma.telnyxBilling.findFirst({
          where: { recordId: call.telnyxCallId ?? '', recordType: 'call' },
        })
        if (existingBilling) {
          await prisma.telnyxBilling.update({
            where: { id: existingBilling.id },
            data: {
              cost: amount,
              currency: currency || existingBilling.currency,
              description: `Call cost updated (${amount} ${currency || 'USD'}) [CDR]`,
              metadata: cdr,
            },
          })
        } else {
          await prisma.telnyxBilling.create({
            data: {
              phoneNumber: call.fromNumber,
              recordType: 'call',
              recordId: call.telnyxCallId ?? call.id,
              cost: amount,
              currency: currency || 'USD',
              billingDate: call.endedAt ?? new Date(),
              description: `Call to ${call.toNumber} (${call.duration ?? 0}s) [CDR]`,
              metadata: cdr,
            },
          })
        }

        // Adjust phone number aggregate by diff
        if (diff !== 0) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: call.fromNumber },
            data: { totalCost: { increment: diff } },
          })
        }

        // job completed
        await prisma.telnyxCdrReconcileJob.update({
          where: { id: job.id },
          data: { status: 'completed', lastError: null },
        })
        processed++
      } catch (err: any) {
        await failOrRetry(job, err?.message || 'Unknown error')
      }
    }

    return NextResponse.json({ ok: true, processed })
  } catch (error) {
    console.error('Reconcile error', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

async function failOrRetry(job: any, error: string) {
  const attempts = job.attempts + 1
  let nextRunAt = new Date()
  // backoff: 30s, 2m, 5m, 15m, then fail
  if (attempts === 1) nextRunAt = new Date(Date.now() + 30_000)
  else if (attempts === 2) nextRunAt = new Date(Date.now() + 2 * 60_000)
  else if (attempts === 3) nextRunAt = new Date(Date.now() + 5 * 60_000)
  else if (attempts === 4) nextRunAt = new Date(Date.now() + 15 * 60_000)

  if (attempts >= 5) {
    await prisma.telnyxCdrReconcileJob.update({
      where: { id: job.id },
      data: { status: 'failed', lastError: error },
    })
  } else {
    await prisma.telnyxCdrReconcileJob.update({
      where: { id: job.id },
      data: { status: 'pending', attempts, nextRunAt, lastError: error },
    })
  }
}

async function fetchCdr(apiKey: string, sessionId?: string | null) {
  if (!sessionId) return null
  const url = new URL(`${TELNYX_API_BASE}/detail_records`)
  url.searchParams.append('filter[record_type]', 'voice')
  url.searchParams.append('filter[call_session_id]', sessionId)
  url.searchParams.append('page[size]', '1')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Telnyx CDR fetch failed: ${res.status} ${txt}`)
  }
  const json = await res.json()
  const record = json?.data?.[0]
  return record || null
}

function parseCdrCost(cdr: any): { amount: number; currency?: string } | null {
  if (!cdr) return null
  // Try common shapes
  const costObj = cdr.cost || cdr.charge || cdr.billing || undefined
  if (costObj && (costObj.amount != null)) {
    const amt = typeof costObj.amount === 'string' ? parseFloat(costObj.amount) : Number(costObj.amount)
    if (!isNaN(amt)) return { amount: amt, currency: costObj.currency || 'USD' }
  }
  // Some responses may flatten amount on root
  if (cdr.amount != null) {
    const amt2 = typeof cdr.amount === 'string' ? parseFloat(cdr.amount) : Number(cdr.amount)
    if (!isNaN(amt2)) return { amount: amt2, currency: cdr.currency || 'USD' }
  }
  return null
}

