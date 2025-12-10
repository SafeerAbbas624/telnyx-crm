"use strict";

// sequence-worker.ts
var PROCESS_INTERVAL = parseInt(process.env.SEQUENCE_PROCESS_INTERVAL_MS || "60000");
var INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";
var APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
var isProcessingSequences = false;
var lastSequenceProcessTime = null;
var sequenceProcessCount = 0;
var sequenceTotalProcessed = 0;
var sequenceTotalFailed = 0;
var isProcessingScheduled = false;
var lastScheduledProcessTime = null;
var scheduledProcessCount = 0;
var scheduledTotalSent = 0;
var scheduledTotalFailed = 0;
var isProcessingDialerSync = false;
var dialerSyncProcessCount = 0;
var dialerSyncTotalAdded = 0;
async function processSequences() {
  if (isProcessingSequences) {
    console.log("[Worker] Sequences: Already processing, skipping...");
    return;
  }
  isProcessingSequences = true;
  const startTime = Date.now();
  try {
    console.log(`[Worker] Sequences: Starting process cycle #${++sequenceProcessCount}`);
    const headers = {
      "Content-Type": "application/json"
    };
    if (INTERNAL_API_KEY) {
      headers["x-internal-key"] = INTERNAL_API_KEY;
    }
    const response = await fetch(`${APP_URL}/api/sequences/process`, {
      method: "POST",
      headers
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const result = await response.json();
    lastSequenceProcessTime = /* @__PURE__ */ new Date();
    if (result.message?.includes("quiet hours")) {
      console.log(`[Worker] Sequences: Skipped - quiet hours`);
    } else {
      sequenceTotalProcessed += result.processed || 0;
      sequenceTotalFailed += result.failed || 0;
      if (result.processed > 0 || result.failed > 0) {
        console.log(
          `[Worker] Sequences: Done in ${Date.now() - startTime}ms - Processed: ${result.processed}, Skipped: ${result.skipped}, Failed: ${result.failed}`
        );
      }
    }
  } catch (error) {
    console.error(`[Worker] Sequences: Error -`, error.message);
  } finally {
    isProcessingSequences = false;
  }
}
async function processScheduledMessages() {
  if (isProcessingScheduled) {
    console.log("[Worker] Scheduled: Already processing, skipping...");
    return;
  }
  isProcessingScheduled = true;
  const startTime = Date.now();
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (INTERNAL_API_KEY) {
      headers["x-internal-key"] = INTERNAL_API_KEY;
    }
    const response = await fetch(`${APP_URL}/api/cron/process-scheduled-messages`, {
      method: "POST",
      headers
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const result = await response.json();
    lastScheduledProcessTime = /* @__PURE__ */ new Date();
    scheduledProcessCount++;
    scheduledTotalSent += result.sent || 0;
    scheduledTotalFailed += result.failed || 0;
    if (result.processed > 0) {
      console.log(
        `[Worker] Scheduled: Done in ${Date.now() - startTime}ms - Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}`
      );
    }
  } catch (error) {
    console.error(`[Worker] Scheduled: Error -`, error.message);
  } finally {
    isProcessingScheduled = false;
  }
}
async function processPowerDialerSync() {
  if (isProcessingDialerSync) {
    console.log("[Worker] DialerSync: Already processing, skipping...");
    return;
  }
  isProcessingDialerSync = true;
  try {
    console.log(`[Worker] DialerSync: Starting sync cycle #${++dialerSyncProcessCount}`);
    const headers = {
      "Content-Type": "application/json"
    };
    if (INTERNAL_API_KEY) {
      headers["x-api-key"] = INTERNAL_API_KEY;
    }
    const response = await fetch(`${APP_URL}/api/cron/sync-power-dialer-lists`, {
      method: "POST",
      headers
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    const result = await response.json();
    if (result.totalAdded > 0) {
      dialerSyncTotalAdded += result.totalAdded;
      console.log(
        `[Worker] DialerSync: Processed ${result.listsProcessed} lists, added ${result.totalAdded} contacts`
      );
    }
  } catch (error) {
    console.error(`[Worker] DialerSync: Error -`, error.message);
  } finally {
    isProcessingDialerSync = false;
  }
}
async function runAllProcessors() {
  await Promise.all([
    processSequences(),
    processScheduledMessages(),
    processPowerDialerSync()
  ]);
}
setInterval(() => {
  console.log(
    `[Worker] Status - Sequences: Cycles=${sequenceProcessCount}, Processed=${sequenceTotalProcessed}, Failed=${sequenceTotalFailed} | Scheduled: Cycles=${scheduledProcessCount}, Sent=${scheduledTotalSent}, Failed=${scheduledTotalFailed} | DialerSync: Cycles=${dialerSyncProcessCount}, Added=${dialerSyncTotalAdded}`
  );
}, 3e5);
console.log(`[Worker] Starting with ${PROCESS_INTERVAL}ms interval`);
console.log(`[Worker] API URLs:`);
console.log(`  - Sequences: ${APP_URL}/api/sequences/process`);
console.log(`  - Scheduled: ${APP_URL}/api/cron/process-scheduled-messages`);
console.log(`  - DialerSync: ${APP_URL}/api/cron/sync-power-dialer-lists`);
runAllProcessors();
setInterval(runAllProcessors, PROCESS_INTERVAL);
process.on("SIGTERM", () => {
  console.log("[Worker] Received SIGTERM, shutting down...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[Worker] Received SIGINT, shutting down...");
  process.exit(0);
});
