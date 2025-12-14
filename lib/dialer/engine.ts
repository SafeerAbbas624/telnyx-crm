/**
 * Multi-Line Power Dialer Backend Engine
 * 
 * Server-side engine that orchestrates multi-line outbound calling
 * with Telnyx Call Control API, AMD, and first-answer-wins logic.
 */

import { prisma } from '@/lib/db'
import { broadcast } from '@/lib/server-events'
import type {
  DialerRunState,
  DialerContact,
  ActiveLeg,
  CompletedLeg,
  DialerCallStatus,
  AMDResult,
  CallerIdStrategy,
} from './types'

// In-memory store for active dialer runs
// Key: runId, Value: DialerRunState
const activeRuns = new Map<string, DialerRunState>()

// Mapping from Telnyx call_control_id to runId for webhook routing
const callControlIdToRunId = new Map<string, string>()

// Configuration
const DEFAULT_MAX_LINES = 3
const MAX_ALLOWED_LINES = 10
const RING_TIMEOUT_MS = 30000 // 30 seconds max ring time
const COMPLETED_LEG_DISPLAY_MS = 4000 // How long to show completed legs
const MAX_CALL_DURATION_SECS = 600 // 10 minutes max for safety (prevents runaway voicemail costs)
const AMD_UNKNOWN_TIMEOUT_MS = 45000 // 45 seconds max for AMD unknown state before hangup

// Telnyx API configuration
const TELNYX_API_KEY = process.env.TELNYX_API_V2_KEY || process.env.TELNYX_API_KEY
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || process.env.TELNYX_SIP_CONNECTION_ID
// Credential connection ID for SIP URI calling (dialing to WebRTC endpoints)
const TELNYX_CREDENTIAL_CONNECTION_ID = process.env.TELNYX_CREDENTIAL_CONNECTION_ID || TELNYX_CONNECTION_ID
const TELNYX_RTC_LOGIN = process.env.TELNYX_RTC_LOGIN
const TELNYX_RTC_SIP_DOMAIN = process.env.TELNYX_RTC_SIP_DOMAIN || 'sip.telnyx.com'

/**
 * Initialize a new dialer run for a list
 */
export async function startDialerRun(params: {
  listId: string
  userId: string
  maxLines?: number
  selectedNumbers?: string[]
  callerIdStrategy?: CallerIdStrategy
  scriptId?: string
  resumeFromIndex?: number
}): Promise<DialerRunState> {
  const { listId, userId, maxLines, selectedNumbers, callerIdStrategy, scriptId, resumeFromIndex } = params

  // Check if there's already an active run for this list
  const existingRun = await prisma.powerDialerRun.findFirst({
    where: {
      listId,
      status: { in: ['running', 'paused'] }
    }
  })

  if (existingRun && existingRun.status === 'running') {
    throw new Error('A dialer run is already active for this list')
  }

  // Load the list with contacts
  const list = await prisma.powerDialerList.findUnique({
    where: { id: listId },
    include: {
      contacts: {
        where: { status: 'PENDING' },
        include: {
          contact: {
            include: {
              contact_tags: { include: { tag: true } },
              properties: true
            }
          }
        },
        orderBy: { addedAt: 'asc' }
      },
      script: true
    }
  })

  if (!list) {
    throw new Error('List not found')
  }

  // Get available DIDs if not specified
  let dids = selectedNumbers || []
  if (dids.length === 0) {
    const phoneNumbers = await prisma.telnyxPhoneNumber.findMany({
      where: {
        isActive: true,
        capabilities: { hasSome: ['VOICE'] }
      }
    })
    dids = phoneNumbers.map(pn => pn.phoneNumber)
  }

  if (dids.length === 0) {
    throw new Error('No phone numbers available for outbound calls')
  }

  // Calculate effective max lines
  const effectiveMaxLines = Math.min(
    maxLines || list.maxLines || DEFAULT_MAX_LINES,
    MAX_ALLOWED_LINES,
    dids.length // Don't exceed available DIDs
  )

  // Create the run in database
  const startIndex = resumeFromIndex ?? list.currentIndex ?? 0
  const dbRun = await prisma.powerDialerRun.create({
    data: {
      listId,
      userId,
      maxLines: effectiveMaxLines,
      selectedNumbers: dids,
      callerIdStrategy: callerIdStrategy || list.callerIdStrategy || 'round_robin',
      scriptId: scriptId || list.scriptId,
      status: 'running',
      currentIndex: startIndex,
      totalContacts: list.contacts.length,
      startedAt: new Date()
    }
  })

  // Build queue from list contacts
  const queue: DialerContact[] = list.contacts.slice(startIndex).map((lc) => {
    const c = lc.contact
    const primaryPhone = c.phone1 || c.phone2 || c.phone3 || ''
    return {
      id: c.id,
      listEntryId: lc.id,
      fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
      firstName: c.firstName || undefined,
      lastName: c.lastName || undefined,
      phone: primaryPhone,
      phone2: c.phone2 || undefined,
      phone3: c.phone3 || undefined,
      llcName: c.llcName || undefined,
      propertyAddress: c.propertyAddress || undefined,
      city: c.city || undefined,
      state: c.state || undefined,
      tags: c.contact_tags?.map((ct: { tag: { id: string; name: string; color: string | null } }) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || undefined
      }))
    }
  }).filter(c => !!c.phone) as DialerContact[] // Only include contacts with phone numbers

  // Initialize run state
  const runState: DialerRunState = {
    runId: dbRun.id,
    listId,
    listName: list.name,
    status: 'running',
    maxLines: effectiveMaxLines,
    callerIdStrategy: (callerIdStrategy || list.callerIdStrategy || 'round_robin') as CallerIdStrategy,
    selectedNumbers: dids,
    scriptId: scriptId || list.scriptId || undefined,
    queue,
    activeLegs: [],
    completedLegs: [],
    currentIndex: 0,
    totalContacts: queue.length,
    stats: {
      totalAttempted: 0, totalAnswered: 0, totalNoAnswer: 0, totalVoicemail: 0,
      totalBusy: 0, totalFailed: 0, totalCanceled: 0, totalTalkTimeSeconds: 0, averageRingTimeMs: 0
    },
    startedAt: new Date().toISOString()
  }

  // Store in memory
  activeRuns.set(dbRun.id, runState)

  // Update list status
  await prisma.powerDialerList.update({
    where: { id: listId },
    data: { status: 'ACTIVE', lastWorkedOn: new Date() }
  })

  // Broadcast run started event
  broadcastRunUpdate(runState, 'run:started')

  // Start filling lines
  await fillLines(dbRun.id)

  return runState
}

/**
 * Fill available line slots with new calls
 */
async function fillLines(runId: string): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state || state.status !== 'running') return

  // Don't start new calls if one is already answered
  const hasAnsweredCall = state.activeLegs.some(leg => leg.status === 'answered')
  if (hasAnsweredCall) return

  // Calculate available slots
  const activeCount = state.activeLegs.filter(leg =>
    ['dialing', 'ringing', 'amd_check'].includes(leg.status)
  ).length
  const availableSlots = state.maxLines - activeCount

  if (availableSlots <= 0 || state.queue.length === 0) return

  // Start calls for available slots
  const contactsToCall = state.queue.splice(0, availableSlots)

  for (let i = 0; i < contactsToCall.length; i++) {
    const contact = contactsToCall[i]
    const lineNumber = findAvailableLineNumber(state)
    const fromNumber = pickCallerIdForNextLeg(state)

    try {
      await initiateCallLeg(state, contact, lineNumber, fromNumber)
    } catch (error) {
      console.error(`[DIALER] Failed to initiate call to ${contact.phone}:`, error)
      // Mark as failed and continue
      const failedLeg: CompletedLeg = {
        legId: `failed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        contact,
        status: 'failed',
        outcome: 'failed',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        lineNumber,
        fromNumber
      }
      state.completedLegs.push(failedLeg)
      state.stats.totalFailed++
      state.stats.totalAttempted++

      // Update list contact status
      await prisma.powerDialerListContact.update({
        where: { id: contact.listEntryId },
        data: { status: 'FAILED', attemptCount: { increment: 1 }, lastCalledAt: new Date() }
      })
    }
  }

  broadcastRunUpdate(state, 'queue:updated')
}

/**
 * Find the next available line number (1..maxLines)
 */
function findAvailableLineNumber(state: DialerRunState): number {
  const usedLines = new Set(state.activeLegs.map(leg => leg.lineNumber))
  for (let i = 1; i <= state.maxLines; i++) {
    if (!usedLines.has(i)) return i
  }
  return 1 // Fallback
}

/**
 * Pick caller ID based on strategy
 */
function pickCallerIdForNextLeg(state: DialerRunState): string {
  const { selectedNumbers, callerIdStrategy, stats } = state

  if (selectedNumbers.length === 0) {
    throw new Error('No phone numbers available')
  }

  switch (callerIdStrategy) {
    case 'round_robin':
      return selectedNumbers[stats.totalAttempted % selectedNumbers.length]
    case 'random':
      return selectedNumbers[Math.floor(Math.random() * selectedNumbers.length)]
    case 'single_number':
    default:
      return selectedNumbers[0]
  }
}

/**
 * Initiate a call leg via Telnyx Call Control API
 */
async function initiateCallLeg(
  state: DialerRunState,
  contact: DialerContact,
  lineNumber: number,
  fromNumber: string
): Promise<void> {
  // Create leg record in database
  const dbLeg = await prisma.powerDialerRunLeg.create({
    data: {
      runId: state.runId,
      listContactId: contact.listEntryId,
      fromNumber,
      toNumber: contact.phone,
      lineNumber,
      status: 'dialing'
    }
  })

  // Create active leg
  const activeLeg: ActiveLeg = {
    legId: dbLeg.id,
    contact,
    status: 'dialing',
    startedAt: new Date().toISOString(),
    lineNumber,
    fromNumber
  }

  state.activeLegs.push(activeLeg)
  state.stats.totalAttempted++
  state.currentIndex++

  // Update list progress
  await prisma.powerDialerList.update({
    where: { id: state.listId },
    data: { currentIndex: { increment: 1 }, contactsCalled: { increment: 1 } }
  })

  // Broadcast leg started
  broadcastRunUpdate(state, 'leg:started')

  // Initiate call via Telnyx Call Control API
  try {
    const telnyxResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        connection_id: TELNYX_CONNECTION_ID,
        to: contact.phone,
        from: fromNumber,
        answering_machine_detection: 'premium', // Use premium ML-based AMD for faster detection
        answering_machine_detection_config: {
          // FAST AMD: Real humans won't wait more than 2 seconds
          total_analysis_time_millis: 2500,      // 2.5 seconds max
          after_greeting_silence_millis: 800,    // 0.8s silence after greeting
          between_words_silence_millis: 400,     // 0.4s between words
          greeting_duration_millis: 2000,        // 2s max greeting length
          initial_silence_millis: 1500,          // 1.5s initial silence
          maximum_number_of_words: 5,
          silence_threshold: 256,
          greeting_total_analysis_time_millis: 2500,
        },
        webhook_url: `${process.env.NEXTAUTH_URL}/api/dialer/webhooks/calls`,
        client_state: Buffer.from(JSON.stringify({
          runId: state.runId,
          legId: dbLeg.id,
          listEntryId: contact.listEntryId
        })).toString('base64'),
        timeout_secs: 30,
        time_limit_secs: MAX_CALL_DURATION_SECS // Safety limit to prevent runaway costs
      })
    })

    if (!telnyxResponse.ok) {
      const errorData = await telnyxResponse.json().catch(() => ({}))
      throw new Error(`Telnyx API error: ${telnyxResponse.status} - ${JSON.stringify(errorData)}`)
    }

    const telnyxData = await telnyxResponse.json()
    const callControlId = telnyxData.data?.call_control_id

    if (callControlId) {
      // Update leg with Telnyx call control ID
      activeLeg.telnyxCallControlId = callControlId
      callControlIdToRunId.set(callControlId, state.runId)

      await prisma.powerDialerRunLeg.update({
        where: { id: dbLeg.id },
        data: { telnyxCallControlId: callControlId }
      })

      // Log the call to TelnyxCall for activity history with origin = 'power_dialer'
      try {
        await prisma.telnyxCall.create({
          data: {
            telnyxCallId: callControlId,
            contactId: contact.id,
            fromNumber,
            toNumber: contact.phone,
            direction: 'outbound',
            status: 'initiated',
            webhookData: {
              origin: 'power_dialer',
              runId: state.runId,
              listId: state.listId,
              listName: state.listName,
              legId: dbLeg.id,
              lineNumber
            }
          }
        })
      } catch (err) {
        console.error('[DIALER] Failed to log call to TelnyxCall:', err)
      }

      console.log(`[DIALER] Call initiated: ${callControlId} -> ${contact.phone}`)
    }

    // Set ring timeout (will hang up if still ringing after 30s)
    setTimeout(() => handleRingTimeout(state.runId, dbLeg.id), RING_TIMEOUT_MS)

    // Safety timeout for AMD unknown state - if call connects but AMD can't determine human/machine,
    // hang up after 45s to prevent staying connected to voicemails indefinitely
    setTimeout(() => handleAMDUnknownTimeout(state.runId, dbLeg.id), AMD_UNKNOWN_TIMEOUT_MS)

  } catch (error) {
    console.error(`[DIALER] Telnyx API call failed:`, error)
    // Move leg to failed
    await handleLegEnded(state.runId, dbLeg.id, 'failed', undefined, 'api_error')
    throw error
  }
}

/**
 * Handle ring timeout - if call hasn't been answered
 */
async function handleRingTimeout(runId: string, legId: string): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) return

  // Only handle if still ringing
  if (leg.status === 'ringing' || leg.status === 'dialing') {
    console.log(`[DIALER] Ring timeout for leg ${legId}`)
    await handleLegEnded(runId, legId, 'no_answer', undefined, 'ring_timeout')

    // Hang up the call if it has a call control ID
    if (leg.telnyxCallControlId) {
      await hangupCall(leg.telnyxCallControlId)
    }
  }
}

/**
 * Handle AMD unknown timeout - if call is in amd_check state for too long
 * This prevents staying connected to voicemails when AMD can't determine human/machine
 */
async function handleAMDUnknownTimeout(runId: string, legId: string): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) return

  // Only handle if still in amd_check state (AMD returned 'unknown' and waiting)
  if (leg.status === 'amd_check' || (leg.status === 'ringing' && leg.amdResult === 'unknown')) {
    console.log(`[DIALER] AMD unknown timeout for leg ${legId} - hanging up to prevent voicemail costs`)

    // Hang up the call first
    if (leg.telnyxCallControlId) {
      await hangupCall(leg.telnyxCallControlId)
    }

    await handleLegEnded(runId, legId, 'voicemail', 'unknown', 'amd_unknown_timeout')
  }
}

/**
 * Handle a leg ending (any status)
 */
async function handleLegEnded(
  runId: string,
  legId: string,
  status: DialerCallStatus,
  amdResult?: AMDResult,
  hangupCause?: string
): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const legIndex = state.activeLegs.findIndex(l => l.legId === legId)
  if (legIndex === -1) return

  const leg = state.activeLegs[legIndex]
  const endedAt = new Date().toISOString()
  const ringDurationMs = new Date(endedAt).getTime() - new Date(leg.startedAt).getTime()

  // Move to completed legs
  const completedLeg: CompletedLeg = {
    ...leg,
    status,
    outcome: status,
    endedAt,
    amdResult,
    hangupCause,
    ringDurationMs
  }

  state.activeLegs.splice(legIndex, 1)
  state.completedLegs.push(completedLeg)

  // Update stats based on outcome
  // NOTE: 'answered' is NOT incremented here - it's done in handleCallAnswered() to avoid double counting
  switch (status) {
    case 'no_answer':
      state.stats.totalNoAnswer++
      break
    case 'voicemail':
    case 'machine':
      state.stats.totalVoicemail++
      break
    case 'busy':
      state.stats.totalBusy++
      break
    case 'failed':
      state.stats.totalFailed++
      break
    case 'canceled_other_answer':
      state.stats.totalCanceled++
      break
    // 'answered' stats are handled in handleCallAnswered() - don't double count here
  }

  // Map status to list contact status
  const listContactStatus = status === 'answered' ? 'ANSWERED'
    : status === 'no_answer' ? 'NO_ANSWER'
    : status === 'voicemail' || status === 'machine' ? 'NO_ANSWER'
    : status === 'canceled_other_answer' ? 'PENDING' // Can retry
    : 'FAILED'

  // Map dialer status to TelnyxCall status
  const telnyxCallStatus = status === 'answered' ? 'answered'
    : status === 'no_answer' ? 'no_answer'
    : status === 'voicemail' || status === 'machine' ? 'voicemail'
    : status === 'busy' ? 'busy'
    : status === 'canceled_other_answer' ? 'cancelled'
    : 'failed'

  // Map dialer status to call outcome for activity history
  const callOutcome = status === 'answered' ? 'answered'
    : status === 'no_answer' ? 'no_answer'
    : status === 'voicemail' || status === 'machine' ? 'voicemail'
    : status === 'busy' ? 'busy'
    : status === 'canceled_other_answer' ? 'cancelled'
    : 'no_answer'

  // Update database
  await Promise.all([
    prisma.powerDialerRunLeg.update({
      where: { id: legId },
      data: { status, amdResult, hangupCause, endedAt: new Date(), ringDurationMs }
    }),
    prisma.powerDialerListContact.update({
      where: { id: leg.contact.listEntryId },
      data: {
        status: listContactStatus,
        attemptCount: { increment: 1 },
        lastCalledAt: new Date()
      }
    }),
    prisma.powerDialerRun.update({
      where: { id: runId },
      data: {
        totalAnswered: state.stats.totalAnswered,
        totalNoAnswer: state.stats.totalNoAnswer,
        totalVoicemail: state.stats.totalVoicemail,
        totalBusy: state.stats.totalBusy,
        totalFailed: state.stats.totalFailed,
        totalCanceled: state.stats.totalCanceled
      }
    }),
    // Update TelnyxCall record with final status for activity history
    leg.telnyxCallControlId ? prisma.telnyxCall.updateMany({
      where: { telnyxCallId: leg.telnyxCallControlId },
      data: {
        status: telnyxCallStatus as any,
        callOutcome,
        hangupCause,
        endedAt: new Date(),
        duration: Math.floor(ringDurationMs / 1000)
      }
    }) : Promise.resolve()
  ])

  // Broadcast update
  broadcastRunUpdate(state, 'leg:hangup')

  // Schedule removal of completed leg from display
  setTimeout(() => {
    const currentState = activeRuns.get(runId)
    if (currentState) {
      const idx = currentState.completedLegs.findIndex(l => l.legId === legId)
      if (idx !== -1) {
        currentState.completedLegs.splice(idx, 1)
        broadcastRunUpdate(currentState, 'stats:updated')
      }
    }
  }, COMPLETED_LEG_DISPLAY_MS)

  // Fill lines if not paused and no call is answered
  const hasAnsweredCall = state.activeLegs.some(l => l.status === 'answered')
  if (state.status === 'running' && !hasAnsweredCall) {
    await fillLines(runId)
  }

  // Check if run is complete
  if (state.activeLegs.length === 0 && state.queue.length === 0 && state.status === 'running') {
    await completeRun(runId)
  }
}

/**
 * Handle when a call is answered by a human (first-answer-wins)
 */
export async function handleCallAnswered(runId: string, legId: string): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) return

  // Check if another call is already answered
  const alreadyAnswered = state.activeLegs.find(l => l.status === 'answered' && l.legId !== legId)
  if (alreadyAnswered) {
    // This is a late answer - hang up
    console.log(`[DIALER] Late answer on leg ${legId}, hanging up (first-answer-wins)`)
    await handleLegEnded(runId, legId, 'canceled_other_answer', undefined, 'late_answer')
    if (leg.telnyxCallControlId) {
      await hangupCall(leg.telnyxCallControlId)
    }
    return
  }

  // This is the first answer - connect!
  console.log(`[DIALER] Call answered: ${legId} -> ${leg.contact.phone}`)
  leg.status = 'answered'
  leg.answeredAt = new Date().toISOString()

  // Update database
  await prisma.powerDialerRunLeg.update({
    where: { id: legId },
    data: { status: 'answered', answeredAt: new Date() }
  })

  // Bridge the call to the user's WebRTC endpoint for audio
  if (leg.telnyxCallControlId) {
    const bridgeInitiated = await bridgeToWebRTC(leg.telnyxCallControlId, runId, legId, leg.fromNumber)
    if (bridgeInitiated) {
      console.log(`[DIALER] Call ${legId} bridge to WebRTC initiated`)
    } else {
      console.warn(`[DIALER] Call ${legId} answered but bridge to WebRTC failed - no audio`)
    }
  }

  // Cancel all other ringing legs
  const otherLegs = state.activeLegs.filter(l => l.legId !== legId && ['dialing', 'ringing', 'amd_check'].includes(l.status))
  for (const otherLeg of otherLegs) {
    console.log(`[DIALER] Canceling leg ${otherLeg.legId} (other contact answered)`)
    otherLeg.status = 'canceled_other_answer'

    // Hang up via Telnyx
    if (otherLeg.telnyxCallControlId) {
      hangupCall(otherLeg.telnyxCallControlId).catch(err =>
        console.error(`[DIALER] Failed to hang up leg ${otherLeg.legId}:`, err)
      )
    }

    // Handle as ended
    await handleLegEnded(runId, otherLeg.legId, 'canceled_other_answer', undefined, 'other_answered')
  }

  // Update stats
  state.stats.totalAnswered++

  // Update list stats
  await prisma.powerDialerList.update({
    where: { id: state.listId },
    data: { contactsAnswered: { increment: 1 } }
  })

  // Broadcast
  broadcastRunUpdate(state, 'leg:answered')
}

/**
 * Handle when the answered call ends
 */
export async function handleAnsweredCallEnded(
  runId: string,
  legId: string,
  duration: number
): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg || leg.status !== 'answered') return

  console.log(`[DIALER] Answered call ended: ${legId}, duration: ${duration}s`)

  // Update talk time
  state.stats.totalTalkTimeSeconds += duration

  // Update database
  await Promise.all([
    prisma.powerDialerRunLeg.update({
      where: { id: legId },
      data: { talkDurationMs: duration * 1000, endedAt: new Date() }
    }),
    prisma.powerDialerList.update({
      where: { id: state.listId },
      data: { totalTalkTime: { increment: duration } }
    }),
    prisma.powerDialerRun.update({
      where: { id: runId },
      data: { totalTalkTime: { increment: duration } }
    })
  ])

  // Move to completed
  await handleLegEnded(runId, legId, 'answered', undefined, 'normal_clearing')
}

/**
 * Handle a non-answered call ending (busy, no-answer, etc. from hangup webhook)
 */
export async function handleNonAnsweredCallEnded(
  runId: string,
  legId: string,
  hangupCause?: string
): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) return

  // Don't process if already in a terminal state
  if (['answered', 'no_answer', 'busy', 'failed', 'voicemail', 'machine', 'canceled_other_answer'].includes(leg.status)) {
    return
  }

  console.log(`[DIALER] Non-answered call ended: ${legId}, cause: ${hangupCause}`)

  // Map Telnyx hangup cause to our status
  let status: DialerCallStatus = 'no_answer'
  if (hangupCause === 'USER_BUSY' || hangupCause === 'busy') {
    status = 'busy'
  } else if (hangupCause === 'NO_ANSWER' || hangupCause === 'TIMEOUT' || hangupCause === 'ORIGINATOR_CANCEL') {
    status = 'no_answer'
  } else if (hangupCause === 'CALL_REJECTED' || hangupCause === 'UNALLOCATED_NUMBER' || hangupCause === 'NUMBER_CHANGED') {
    status = 'failed'
  }

  await handleLegEnded(runId, legId, status, undefined, hangupCause)
}

/**
 * Hang up a call via Telnyx
 */
async function hangupCall(callControlId: string): Promise<void> {
  try {
    const response = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) {
      console.warn(`[DIALER] Hangup failed for ${callControlId}: ${response.status}`)
    }
  } catch (error) {
    console.error(`[DIALER] Error hanging up call ${callControlId}:`, error)
  }
}

// Store mapping from WebRTC call control ID to conference info for joining
interface ConferenceInfo {
  conferenceId: string
  pstnCallControlId: string
  runId: string
  legId: string
}
const webrtcToConferenceMap = new Map<string, ConferenceInfo>()

/**
 * Bridge a PSTN call to the user's WebRTC SIP endpoint using a conference
 *
 * This works by:
 * 1. Creating a conference with the PSTN call
 * 2. Dialing the user's WebRTC SIP endpoint
 * 3. When the WebRTC call is answered (auto-answer in power dialer mode), join it to the conference
 * 4. Both parties are now in the conference and can hear each other
 */
async function bridgeToWebRTC(pstnCallControlId: string, runId: string, legId: string, fromNumber: string): Promise<boolean> {
  if (!TELNYX_RTC_LOGIN) {
    console.warn('[DIALER] Cannot bridge to WebRTC: TELNYX_RTC_LOGIN not configured')
    return false
  }

  console.log(`[DIALER] Creating conference for PSTN call ${pstnCallControlId}`)

  try {
    // Step 1: Create a conference with the PSTN call
    const conferenceName = `dialer-${runId}-${legId}-${Date.now()}`
    const conferenceResponse = await fetch('https://api.telnyx.com/v2/conferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        call_control_id: pstnCallControlId,
        name: conferenceName,
        beep_enabled: 'never', // Don't play beeps
        start_conference_on_create: true
      })
    })

    if (!conferenceResponse.ok) {
      const errorData = await conferenceResponse.json().catch(() => ({}))
      console.error(`[DIALER] Failed to create conference: ${conferenceResponse.status}`, errorData)
      return false
    }

    const conferenceData = await conferenceResponse.json()
    const conferenceId = conferenceData.data?.id

    if (!conferenceId) {
      console.error('[DIALER] No conference ID returned')
      return false
    }

    console.log(`[DIALER] Conference created: ${conferenceId} with PSTN call ${pstnCallControlId}`)

    // Step 2: Dial the user's WebRTC endpoint using the credential connection
    // The credential connection must have SIP URI calling enabled
    const sipUri = `sip:${TELNYX_RTC_LOGIN}@${TELNYX_RTC_SIP_DOMAIN}`
    console.log(`[DIALER] Dialing WebRTC endpoint: ${sipUri} using credential connection ${TELNYX_CREDENTIAL_CONNECTION_ID}`)

    const dialResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        connection_id: TELNYX_CREDENTIAL_CONNECTION_ID, // Use credential connection for SIP URI calling
        to: sipUri,
        from: fromNumber,
        webhook_url: `${process.env.NEXTAUTH_URL}/api/dialer/webhooks/calls`,
        client_state: Buffer.from(JSON.stringify({
          type: 'webrtc_conference',
          conferenceId,
          pstnCallControlId,
          runId,
          legId
        })).toString('base64'),
        timeout_secs: 30
      })
    })

    if (!dialResponse.ok) {
      const errorData = await dialResponse.json().catch(() => ({}))
      console.error(`[DIALER] Failed to dial WebRTC endpoint: ${dialResponse.status}`, errorData)
      return false
    }

    const dialData = await dialResponse.json()
    const webrtcCallControlId = dialData.data?.call_control_id

    if (webrtcCallControlId) {
      // Store the mapping so we can join the conference when WebRTC call is answered
      webrtcToConferenceMap.set(webrtcCallControlId, {
        conferenceId,
        pstnCallControlId,
        runId,
        legId
      })
      console.log(`[DIALER] WebRTC call initiated: ${webrtcCallControlId} -> will join conference ${conferenceId}`)
      return true
    }

    console.error('[DIALER] No call_control_id returned from WebRTC dial')
    return false
  } catch (error) {
    console.error(`[DIALER] Error in conference bridge setup:`, error)
    return false
  }
}

/**
 * Handle WebRTC call answered - join it to the conference
 */
export async function handleWebRTCCallAnswered(webrtcCallControlId: string): Promise<boolean> {
  const conferenceInfo = webrtcToConferenceMap.get(webrtcCallControlId)

  if (!conferenceInfo) {
    console.warn(`[DIALER] No conference found for WebRTC call ${webrtcCallControlId}`)
    return false
  }

  const { conferenceId, pstnCallControlId } = conferenceInfo

  console.log(`[DIALER] WebRTC call answered, joining conference ${conferenceId}`)

  try {
    // Join the WebRTC call to the conference
    const joinResponse = await fetch(`https://api.telnyx.com/v2/conferences/${conferenceId}/actions/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        call_control_id: webrtcCallControlId,
        beep_enabled: 'never'
      })
    })

    if (!joinResponse.ok) {
      const errorData = await joinResponse.json().catch(() => ({}))
      console.error(`[DIALER] Conference join failed: ${joinResponse.status}`, errorData)
      return false
    }

    console.log(`[DIALER] WebRTC call ${webrtcCallControlId} joined conference ${conferenceId} with PSTN ${pstnCallControlId}`)

    // Clean up the mapping
    webrtcToConferenceMap.delete(webrtcCallControlId)

    return true
  } catch (error) {
    console.error(`[DIALER] Error joining conference:`, error)
    return false
  }
}

/**
 * Clean up WebRTC conference mapping when a call ends
 */
export function cleanupWebRTCBridgeMapping(callControlId: string): void {
  // Check if this is a WebRTC call that was pending conference join
  if (webrtcToConferenceMap.has(callControlId)) {
    webrtcToConferenceMap.delete(callControlId)
    console.log(`[DIALER] Cleaned up WebRTC conference mapping for ${callControlId}`)
  }

  // Also check if this was a PSTN call that had a pending WebRTC conference
  for (const [webrtcId, info] of webrtcToConferenceMap.entries()) {
    if (info.pstnCallControlId === callControlId) {
      webrtcToConferenceMap.delete(webrtcId)
      console.log(`[DIALER] Cleaned up PSTN conference mapping for ${callControlId}`)
      break
    }
  }
}

/**
 * Handle AMD (Answering Machine Detection) result
 */
export async function handleAMDResult(
  runId: string,
  legId: string,
  result: AMDResult
): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) return

  leg.amdResult = result
  leg.status = 'amd_check'

  console.log(`[DIALER] AMD result for ${legId}: ${result}`)

  if (result === 'machine' || result === 'fax') {
    // Hang up on machine/fax
    await handleLegEnded(runId, legId, 'machine', result, 'amd_machine')
    if (leg.telnyxCallControlId) {
      await hangupCall(leg.telnyxCallControlId)
    }
  } else if (result === 'human') {
    // Human detected - treat as answered
    await handleCallAnswered(runId, legId)
  }
  // For 'unknown', we wait for the call to be answered or timeout
}

/**
 * Update leg status (e.g., ringing)
 */
export async function updateLegStatus(
  runId: string,
  legId: string,
  status: DialerCallStatus
): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) return

  leg.status = status

  await prisma.powerDialerRunLeg.update({
    where: { id: legId },
    data: { status }
  })

  broadcastRunUpdate(state, 'leg:ringing')
}

/**
 * Pause the dialer run
 */
export async function pauseDialerRun(runId: string): Promise<DialerRunState | null> {
  const state = activeRuns.get(runId)
  if (!state || state.status !== 'running') return null

  state.status = 'paused'
  state.pausedAt = new Date().toISOString()

  await prisma.powerDialerRun.update({
    where: { id: runId },
    data: { status: 'paused', pausedAt: new Date() }
  })

  broadcastRunUpdate(state, 'run:paused')
  return state
}

/**
 * Resume a paused dialer run
 */
export async function resumeDialerRun(runId: string): Promise<DialerRunState | null> {
  const state = activeRuns.get(runId)
  if (!state || state.status !== 'paused') return null

  state.status = 'running'
  state.pausedAt = undefined

  await prisma.powerDialerRun.update({
    where: { id: runId },
    data: { status: 'running', pausedAt: null }
  })

  broadcastRunUpdate(state, 'run:resumed')

  // Resume filling lines
  await fillLines(runId)

  return state
}

/**
 * Stop the dialer run (cancel all active calls)
 */
export async function stopDialerRun(runId: string): Promise<DialerRunState | null> {
  const state = activeRuns.get(runId)
  if (!state) return null

  console.log(`[DIALER] Stopping run ${runId}`)

  // Hang up all active calls
  for (const leg of state.activeLegs) {
    if (leg.telnyxCallControlId && leg.status !== 'answered') {
      hangupCall(leg.telnyxCallControlId).catch(err =>
        console.error(`[DIALER] Failed to hang up leg ${leg.legId}:`, err)
      )
    }
  }

  state.status = 'paused'
  state.pausedAt = new Date().toISOString()

  await prisma.powerDialerRun.update({
    where: { id: runId },
    data: { status: 'paused', pausedAt: new Date() }
  })

  broadcastRunUpdate(state, 'run:stopped')
  return state
}

/**
 * Complete the dialer run
 */
async function completeRun(runId: string): Promise<void> {
  const state = activeRuns.get(runId)
  if (!state) return

  console.log(`[DIALER] Run ${runId} completed`)

  state.status = 'completed'
  state.completedAt = new Date().toISOString()

  await Promise.all([
    prisma.powerDialerRun.update({
      where: { id: runId },
      data: { status: 'completed', completedAt: new Date() }
    }),
    prisma.powerDialerList.update({
      where: { id: state.listId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    })
  ])

  broadcastRunUpdate(state, 'run:completed')

  // Clean up after a delay
  setTimeout(() => {
    activeRuns.delete(runId)
  }, 60000) // Keep in memory for 1 minute for late events
}

/**
 * Broadcast run state update via SSE
 */
function broadcastRunUpdate(state: DialerRunState, eventType: string): void {
  broadcast('dialer:update', {
    type: eventType,
    runId: state.runId,
    listId: state.listId,
    timestamp: new Date().toISOString(),
    state: {
      runId: state.runId,
      listId: state.listId,
      listName: state.listName,
      status: state.status,
      maxLines: state.maxLines,
      activeLegs: state.activeLegs,
      completedLegs: state.completedLegs,
      queue: state.queue.slice(0, 20), // Only send first 20 queued
      queueLength: state.queue.length,
      currentIndex: state.currentIndex,
      totalContacts: state.totalContacts,
      stats: state.stats
    }
  })
}

/**
 * Get current run state
 */
export function getDialerRunState(runId: string): DialerRunState | null {
  return activeRuns.get(runId) || null
}

/**
 * Get active run for a list
 */
export function getActiveRunForList(listId: string): DialerRunState | null {
  for (const state of activeRuns.values()) {
    if (state.listId === listId && ['running', 'paused'].includes(state.status)) {
      return state
    }
  }
  return null
}

/**
 * Get run ID from Telnyx call control ID
 */
export function getRunIdFromCallControlId(callControlId: string): string | undefined {
  return callControlIdToRunId.get(callControlId)
}

/**
 * Get leg by call control ID
 */
export function getLegByCallControlId(runId: string, callControlId: string): ActiveLeg | undefined {
  const state = activeRuns.get(runId)
  if (!state) return undefined
  return state.activeLegs.find(l => l.telnyxCallControlId === callControlId)
}

/**
 * Clean up call control ID mapping
 */
export function cleanupCallControlId(callControlId: string): void {
  callControlIdToRunId.delete(callControlId)
}

/**
 * Get all active runs (for admin/debugging)
 */
export function getAllActiveRuns(): DialerRunState[] {
  return Array.from(activeRuns.values())
}

/**
 * Hangup a specific call leg by legId
 */
export async function hangupLeg(runId: string, legId: string): Promise<boolean> {
  const state = activeRuns.get(runId)
  if (!state) {
    console.warn(`[DIALER] Cannot hangup: run ${runId} not found`)
    return false
  }

  const leg = state.activeLegs.find(l => l.legId === legId)
  if (!leg) {
    console.warn(`[DIALER] Cannot hangup: leg ${legId} not found in run ${runId}`)
    return false
  }

  if (!leg.telnyxCallControlId) {
    console.warn(`[DIALER] Cannot hangup: leg ${legId} has no call control ID`)
    return false
  }

  console.log(`[DIALER] Hanging up leg ${legId} (call control: ${leg.telnyxCallControlId})`)
  await hangupCall(leg.telnyxCallControlId)
  return true
}

