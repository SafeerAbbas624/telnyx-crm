/**
 * Sequence Worker
 * 
 * This worker processes sequence enrollments by calling the /api/sequences/process endpoint
 * on a regular interval. It handles:
 * - Executing due sequence steps (EMAIL, SMS, TASK)
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

let isProcessing = false
let lastProcessTime: Date | null = null
let processCount = 0
let totalProcessed = 0
let totalFailed = 0

async function processSequences() {
  if (isProcessing) {
    console.log("[Sequence Worker] Already processing, skipping...")
    return
  }

  isProcessing = true
  const startTime = Date.now()

  try {
    console.log(`[Sequence Worker] Starting process cycle #${++processCount}`)

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
    lastProcessTime = new Date()

    if (result.message?.includes("quiet hours")) {
      console.log(`[Sequence Worker] Skipped: Currently in quiet hours`)
    } else {
      totalProcessed += result.processed || 0
      totalFailed += result.failed || 0
      
      console.log(
        `[Sequence Worker] Completed in ${Date.now() - startTime}ms - ` +
        `Processed: ${result.processed}, Skipped: ${result.skipped}, Failed: ${result.failed}`
      )
    }
  } catch (error: any) {
    console.error(`[Sequence Worker] Error:`, error.message)
  } finally {
    isProcessing = false
  }
}

// Status logging every 5 minutes
setInterval(() => {
  console.log(
    `[Sequence Worker] Status - ` +
    `Cycles: ${processCount}, Total Processed: ${totalProcessed}, Total Failed: ${totalFailed}, ` +
    `Last Process: ${lastProcessTime?.toISOString() || "Never"}`
  )
}, 300000)

// Main loop
console.log(`[Sequence Worker] Starting with ${PROCESS_INTERVAL}ms interval`)
console.log(`[Sequence Worker] API URL: ${APP_URL}/api/sequences/process`)

// Run immediately on start
processSequences()

// Then run on interval
setInterval(processSequences, PROCESS_INTERVAL)

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Sequence Worker] Received SIGTERM, shutting down...")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("[Sequence Worker] Received SIGINT, shutting down...")
  process.exit(0)
})

