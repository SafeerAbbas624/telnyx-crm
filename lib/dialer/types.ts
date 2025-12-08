/**
 * Multi-Line Power Dialer Types
 * 
 * This file defines all types for the CallTools-style multi-line dialer
 * that supports concurrent outbound calls with first-answer-wins logic.
 */

// === Call Status States ===
export type DialerCallStatus =
  | 'idle'           // Not yet started
  | 'queued'         // In queue, waiting to be dialed
  | 'dialing'        // Call initiated, waiting for ring
  | 'ringing'        // Remote party's phone is ringing
  | 'amd_check'      // Answering machine detection in progress
  | 'answered'       // Human answered, call connected
  | 'voicemail'      // AMD detected voicemail
  | 'machine'        // AMD detected answering machine/IVR
  | 'no_answer'      // Rang but no answer (timeout)
  | 'busy'           // Line was busy
  | 'failed'         // Call failed (invalid number, network error, etc.)
  | 'skipped'        // Skipped (e.g., no phone number)
  | 'canceled_other_answer' // Hung up because another contact answered first

// === Dialer Run Status ===
export type DialerRunStatus =
  | 'idle'       // Not started
  | 'running'    // Actively dialing
  | 'paused'     // User paused
  | 'completed'  // All contacts processed
  | 'error'      // Fatal error occurred

// === AMD Detection Results ===
export type AMDResult = 'human' | 'machine' | 'fax' | 'unknown' | 'no_detection'

// === Caller ID Strategy ===
export type CallerIdStrategy = 'round_robin' | 'single_number' | 'random'

// === Contact in the Dialer ===
export interface DialerContact {
  id: string               // contactId from Contact table
  listEntryId: string      // row id in PowerDialerListContact
  fullName: string         // Display name
  firstName?: string
  lastName?: string
  phone: string            // Primary phone to dial
  phone2?: string          // Backup phone
  phone3?: string          // Backup phone
  company?: string
  llcName?: string
  propertyAddress?: string
  city?: string
  state?: string
  zipCode?: string
  tags?: { id: string; name: string; color?: string }[]
  notes?: string
  // From ContactProperty if available
  propertyType?: string
  bedrooms?: number
  buildingSqft?: number
  lotSizeSqft?: number
}

// === Active Call Leg ===
export interface ActiveLeg {
  legId: string              // Unique leg ID (Telnyx call_control_id or generated)
  telnyxCallControlId?: string
  telnyxSessionId?: string
  contact: DialerContact
  status: DialerCallStatus
  startedAt: string          // ISO timestamp
  answeredAt?: string        // ISO timestamp when answered
  endedAt?: string           // ISO timestamp when ended
  lineNumber: number         // 1..maxLines - which "line slot" this occupies
  fromNumber: string         // Telnyx DID used for this call
  amdResult?: AMDResult
  ringDurationMs?: number    // How long it rang before answer/end
  hangupCause?: string       // Telnyx hangup cause code
  displayDuration?: number   // Seconds to show the card after status change
}

// === Completed Leg (for history) ===
export interface CompletedLeg extends ActiveLeg {
  outcome: DialerCallStatus  // Final status
  duration?: number          // Call duration in seconds (if answered)
}

// === Dialer Run State ===
export interface DialerRunState {
  runId: string
  listId: string
  listName: string
  status: DialerRunStatus
  maxLines: number           // Up to 10, but capped by available DIDs
  callerIdStrategy: CallerIdStrategy
  selectedNumbers: string[]  // DIDs available for this run
  scriptId?: string          // Call script to use
  
  // Queue management
  queue: DialerContact[]     // Contacts waiting to be dialed
  activeLegs: ActiveLeg[]    // Currently active calls (dialing/ringing/answered)
  completedLegs: CompletedLeg[] // Recently completed (for display fade-out)
  
  // Progress tracking
  currentIndex: number       // Current position in list
  totalContacts: number      // Total contacts in list
  
  // Stats
  stats: DialerRunStats
  
  // Timestamps
  startedAt?: string
  pausedAt?: string
  completedAt?: string
  lastActivityAt?: string
}

// === Run Statistics ===
export interface DialerRunStats {
  totalAttempted: number
  totalAnswered: number
  totalNoAnswer: number
  totalVoicemail: number
  totalBusy: number
  totalFailed: number
  totalCanceled: number      // Canceled because another answered
  totalTalkTimeSeconds: number
  averageRingTimeMs: number
}

// === Events emitted by dialer engine ===
export type DialerEventType =
  | 'run:started'
  | 'run:paused'
  | 'run:resumed'
  | 'run:stopped'
  | 'run:completed'
  | 'run:error'
  | 'leg:started'
  | 'leg:ringing'
  | 'leg:amd'
  | 'leg:answered'
  | 'leg:hangup'
  | 'leg:canceled'
  | 'stats:updated'
  | 'queue:updated'

export interface DialerEvent {
  type: DialerEventType
  runId: string
  timestamp: string
  data: Partial<DialerRunState> | ActiveLeg | CompletedLeg | DialerRunStats
}

// === API Request/Response Types ===
export interface StartDialerRunRequest {
  listId: string
  maxLines?: number          // Default: min(3, availableDIDs)
  selectedNumbers?: string[] // Specific DIDs to use
  callerIdStrategy?: CallerIdStrategy
  scriptId?: string
  resumeFromIndex?: number   // For resuming a paused run
}

export interface StartDialerRunResponse {
  success: boolean
  runId?: string
  error?: string
  state?: DialerRunState
}

