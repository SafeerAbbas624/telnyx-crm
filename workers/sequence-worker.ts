/**
 * Sequence & Scheduled Message Worker
 *
 * This worker processes:
 * 1. Sequence enrollments by calling the /api/sequences/process endpoint
 * 2. Scheduled messages by calling the /api/cron/process-scheduled-messages endpoint
 *
 * It handles:
 * - Executing due sequence steps (EMAIL, SMS, TASK)
 * - Executing scheduled SMS and EMAIL messages
 * - Rate limiting
 * - Quiet hours enforcement
 * - DNC/unsubscribe checks
 *
 * Configuration via environment variables:
 * - SEQUENCE_PROCESS_INTERVAL_MS: How often to process (default: 60000ms = 1 minute)
 * - INTERNAL_API_KEY: Optional security key for the process endpoint
 * - APP_URL: Base URL of the application (default: http://localhost:3000)
 */

const PROCESS_INTERVAL = parseInt(process.env.SEQUENCE_PROCESS_INTERVAL_MS || "60000")
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ""
const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

// Sequence processing stats
let isProcessingSequences = false
let lastSequenceProcessTime: Date | null = null
let sequenceProcessCount = 0
let sequenceTotalProcessed = 0
let sequenceTotalFailed = 0

// Scheduled message processing stats
let isProcessingScheduled = false
let lastScheduledProcessTime: Date | null = null
let scheduledProcessCount = 0
let scheduledTotalSent = 0
let scheduledTotalFailed = 0

// Power dialer list sync stats
let isProcessingDialerSync = false
let dialerSyncProcessCount = 0
let dialerSyncTotalAdded = 0

async function processSequences() {
  if (isProcessingSequences) {
    console.log("[Worker] Sequences: Already processing, skipping...")
    return
  }

  isProcessingSequences = true
  const startTime = Date.now()

  try {
    console.log(`[Worker] Sequences: Starting process cycle #${++sequenceProcessCount}`)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (INTERNAL_API_KEY) {
      headers["x-internal-key"] = INTERNAL_API_KEY
    }

    const response = await fetch(`${APP_URL}/api/sequences/process`, {
      method: "POST",
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    lastSequenceProcessTime = new Date()

    if (result.message?.includes("quiet hours")) {
      console.log(`[Worker] Sequences: Skipped - quiet hours`)
    } else {
      sequenceTotalProcessed += result.processed || 0
      sequenceTotalFailed += result.failed || 0

      if (result.processed > 0 || result.failed > 0) {
        console.log(
          `[Worker] Sequences: Done in ${Date.now() - startTime}ms - ` +
          `Processed: ${result.processed}, Skipped: ${result.skipped}, Failed: ${result.failed}`
        )
      }
    }
  } catch (error: any) {
    console.error(`[Worker] Sequences: Error -`, error.message)
  } finally {
    isProcessingSequences = false
  }
}

async function processScheduledMessages() {
  if (isProcessingScheduled) {
    console.log("[Worker] Scheduled: Already processing, skipping...")
    return
  }

  isProcessingScheduled = true
  const startTime = Date.now()

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (INTERNAL_API_KEY) {
      headers["x-internal-key"] = INTERNAL_API_KEY
    }

    const response = await fetch(`${APP_URL}/api/cron/process-scheduled-messages`, {
      method: "POST",
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    lastScheduledProcessTime = new Date()
    scheduledProcessCount++

    scheduledTotalSent += result.sent || 0
    scheduledTotalFailed += result.failed || 0

    if (result.processed > 0) {
      console.log(
        `[Worker] Scheduled: Done in ${Date.now() - startTime}ms - ` +
        `Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}`
      )
    }
  } catch (error: any) {
    console.error(`[Worker] Scheduled: Error -`, error.message)
  } finally {
    isProcessingScheduled = false
  }
}

async function processPowerDialerSync() {
  if (isProcessingDialerSync) {
    console.log("[Worker] DialerSync: Already processing, skipping...")
    return
  }

  isProcessingDialerSync = true

  try {
    console.log(`[Worker] DialerSync: Starting sync cycle #${++dialerSyncProcessCount}`)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (INTERNAL_API_KEY) {
      headers["x-api-key"] = INTERNAL_API_KEY
    }

    const response = await fetch(`${APP_URL}/api/cron/sync-power-dialer-lists`, {
      method: "POST",
      headers,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    const result = await response.json()
    if (result.totalAdded > 0) {
      dialerSyncTotalAdded += result.totalAdded
      console.log(
        `[Worker] DialerSync: Processed ${result.listsProcessed} lists, added ${result.totalAdded} contacts`
      )
    }
  } catch (error: any) {
    console.error(`[Worker] DialerSync: Error -`, error.message)
  } finally {
    isProcessingDialerSync = false
  }
}

async function runAllProcessors() {
  // Run all in parallel since they're independent
  await Promise.all([
    processSequences(),
    processScheduledMessages(),
    processPowerDialerSync()
  ])
}

// Status logging every 5 minutes
setInterval(() => {
  console.log(
    `[Worker] Status - ` +
    `Sequences: Cycles=${sequenceProcessCount}, Processed=${sequenceTotalProcessed}, Failed=${sequenceTotalFailed} | ` +
    `Scheduled: Cycles=${scheduledProcessCount}, Sent=${scheduledTotalSent}, Failed=${scheduledTotalFailed} | ` +
    `DialerSync: Cycles=${dialerSyncProcessCount}, Added=${dialerSyncTotalAdded}`
  )
}, 300000)

// Main loop
console.log(`[Worker] Starting with ${PROCESS_INTERVAL}ms interval`)
console.log(`[Worker] API URLs:`)
console.log(`  - Sequences: ${APP_URL}/api/sequences/process`)
console.log(`  - Scheduled: ${APP_URL}/api/cron/process-scheduled-messages`)
console.log(`  - DialerSync: ${APP_URL}/api/cron/sync-power-dialer-lists`)

// Run immediately on start
runAllProcessors()

// Then run on interval
setInterval(runAllProcessors, PROCESS_INTERVAL)

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Worker] Received SIGTERM, shutting down...")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("[Worker] Received SIGINT, shutting down...")
  process.exit(0)
})

