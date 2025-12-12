"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import type { Contact } from "@/lib/types"

// Types for multi-line manual dialer
export type MultiCallStatus = "ringing" | "connected" | "ended" | "failed"

export interface ManualDialerCall {
  id: string                    // Telnyx call ID / UUID
  contactId?: string            // CRM contact ID, if available
  contactName?: string          // Display name
  phoneNumber: string           // To number
  fromNumber: string            // Telnyx DID used as caller ID
  status: MultiCallStatus
  startedAt: number             // Timestamp
  endedAt?: number              // When the call ended
  telnyxCall?: any              // Reference to Telnyx SDK call object
}

const MAX_CONCURRENT = 3

type MultiCallContextType = {
  activeCalls: Map<string, ManualDialerCall>
  primaryCallId: string | null
  canStartNewCall: boolean
  startManualCall: (opts: {
    contact?: Contact
    toNumber: string
    fromNumber: string
  }) => Promise<string | null>
  hangUpCall: (callId: string) => void
  hangUpAllCalls: () => void
  dismissCall: (callId: string) => void
  dismissAllEnded: () => void
  getCallCount: () => number
  switchPrimaryCall: (callId: string) => void
}

const MultiCallContext = createContext<MultiCallContextType | undefined>(undefined)

export function MultiCallProvider({ children }: { children: React.ReactNode }) {
  const [activeCalls, setActiveCalls] = useState<Map<string, ManualDialerCall>>(new Map())
  const [primaryCallId, setPrimaryCallId] = useState<string | null>(null)
  const activeCallsRef = useRef(activeCalls)
  const primaryCallIdRef = useRef(primaryCallId)

  // Keep refs in sync
  useEffect(() => {
    activeCallsRef.current = activeCalls
    primaryCallIdRef.current = primaryCallId
  }, [activeCalls, primaryCallId])

  const canStartNewCall = activeCalls.size < MAX_CONCURRENT || 
    Array.from(activeCalls.values()).some(c => c.status === 'ended' || c.status === 'failed')

  const getCallCount = useCallback(() => {
    return Array.from(activeCallsRef.current.values())
      .filter(c => c.status === 'ringing' || c.status === 'connected').length
  }, [])

  // Handle when a call is answered - allow multiple connected calls
  // User can manually hang up whichever call they want
  const handleCallAnswered = useCallback((answeredCallId: string) => {
    console.log('[MultiCall] Call answered:', answeredCallId)

    // Update this call's status to connected
    setActiveCalls(prev => {
      const newMap = new Map(prev)
      const c = newMap.get(answeredCallId)
      if (c) newMap.set(answeredCallId, { ...c, status: 'connected' })
      return newMap
    })

    // If no primary call yet, set this as primary (for audio focus)
    if (!primaryCallIdRef.current) {
      setPrimaryCallId(answeredCallId)
    } else {
      // Multiple connected calls - user can switch between them
      console.log('[MultiCall] Multiple calls connected - user can switch between:', primaryCallIdRef.current, 'and', answeredCallId)
    }

    // Hang up all other RINGING calls (not connected ones)
    activeCallsRef.current.forEach((call, callId) => {
      if (callId !== answeredCallId && call.status === 'ringing') {
        console.log('[MultiCall] Auto-hanging up other ringing call:', callId)
        if (call.telnyxCall) {
          try { call.telnyxCall.hangup() } catch (e) { console.error('[MultiCall] Hangup error:', e) }
        }
        setActiveCalls(prev => {
          const newMap = new Map(prev)
          const c = newMap.get(callId)
          if (c) newMap.set(callId, { ...c, status: 'ended', endedAt: Date.now() })
          return newMap
        })
      }
    })
  }, [])

  // Handle call ended event
  const handleCallEnded = useCallback((callId: string) => {
    console.log('[MultiCall] Call ended:', callId)
    
    setActiveCalls(prev => {
      const newMap = new Map(prev)
      const c = newMap.get(callId)
      if (c && c.status !== 'ended') {
        newMap.set(callId, { ...c, status: 'ended', endedAt: Date.now() })
      }
      return newMap
    })

    if (primaryCallIdRef.current === callId) {
      setPrimaryCallId(null)
    }
  }, [])

  const startManualCall = useCallback(async (opts: {
    contact?: Contact
    toNumber: string
    fromNumber: string
  }): Promise<string | null> => {
    const activeCount = getCallCount()
    if (activeCount >= MAX_CONCURRENT) {
      console.log('[MultiCall] Max concurrent calls reached:', activeCount)
      return null
    }

    try {
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.ensureRegistered()

      // Start the call
      const result = await rtcClient.startCall({
        toNumber: opts.toNumber,
        fromNumber: opts.fromNumber
      })
      const callId = result.sessionId

      // Get reference to the specific call object from rtcClient's activeCalls map
      // Use getCallById to get the correct call, not currentCall which gets overwritten
      const telnyxCall = rtcClient.getCallById(callId)
      console.log('[MultiCall] Got telnyxCall for', callId, ':', !!telnyxCall)

      // Create call entry
      const newCall: ManualDialerCall = {
        id: callId,
        contactId: opts.contact?.id,
        contactName: opts.contact ? `${opts.contact.firstName || ''} ${opts.contact.lastName || ''}`.trim() : undefined,
        phoneNumber: opts.toNumber,
        fromNumber: opts.fromNumber,
        status: 'ringing',
        startedAt: Date.now(),
        telnyxCall,
      }

      console.log('[MultiCall] Adding new call:', callId, 'Total will be:', activeCalls.size + 1)
      setActiveCalls(prev => new Map(prev).set(callId, newCall))

      // Log the call to database
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: callId,
          contactId: opts.contact?.id,
          fromNumber: opts.fromNumber,
          toNumber: opts.toNumber,
        })
      }).catch(err => console.error('[MultiCall] Failed to log call:', err))

      // Listen for call state changes
      const handleCallUpdate = (data: { state: string; callId: string }) => {
        if (data.callId !== callId) return

        console.log('[MultiCall] Call update for', callId, ':', data.state)

        if (data.state === 'active' || data.state === 'answering') {
          handleCallAnswered(callId)
        } else if (['hangup', 'destroy', 'failed', 'bye', 'cancel', 'rejected'].includes(data.state)) {
          handleCallEnded(callId)
          rtcClient.off('callUpdate', handleCallUpdate)
        }
      }
      rtcClient.on('callUpdate', handleCallUpdate)

      return callId
    } catch (error: any) {
      console.error('[MultiCall] Error starting call:', error)
      throw error
    }
  }, [getCallCount, handleCallAnswered, handleCallEnded])

  const hangUpCall = useCallback((callId: string) => {
    const call = activeCallsRef.current.get(callId)
    if (!call) return

    console.log('[MultiCall] Hanging up call:', callId)

    if (call.telnyxCall) {
      try { call.telnyxCall.hangup() } catch (e) { console.error('[MultiCall] Hangup error:', e) }
    }

    setActiveCalls(prev => {
      const newMap = new Map(prev)
      const c = newMap.get(callId)
      if (c) newMap.set(callId, { ...c, status: 'ended', endedAt: Date.now() })
      return newMap
    })

    if (primaryCallIdRef.current === callId) {
      setPrimaryCallId(null)
    }
  }, [])

  const hangUpAllCalls = useCallback(() => {
    activeCallsRef.current.forEach((call, callId) => {
      if (call.status === 'ringing' || call.status === 'connected') {
        hangUpCall(callId)
      }
    })
  }, [hangUpCall])

  // Dismiss a single call card (remove from UI)
  const dismissCall = useCallback((callId: string) => {
    setActiveCalls(prev => {
      const newMap = new Map(prev)
      newMap.delete(callId)
      return newMap
    })
  }, [])

  // Dismiss all ended/failed calls
  const dismissAllEnded = useCallback(() => {
    setActiveCalls(prev => {
      const newMap = new Map(prev)
      newMap.forEach((call, id) => {
        if (call.status === 'ended' || call.status === 'failed') {
          newMap.delete(id)
        }
      })
      return newMap
    })
  }, [])

  // Switch which call is primary (has audio focus)
  const switchPrimaryCall = useCallback(async (callId: string) => {
    const call = activeCallsRef.current.get(callId)
    if (!call || call.status !== 'connected') {
      console.warn('[MultiCall] Cannot switch to non-connected call:', callId)
      return
    }

    console.log('[MultiCall] Switching primary call to:', callId)
    setPrimaryCallId(callId)

    // Switch audio to this specific call
    try {
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      // Use the new switchAudioToCall method that actually switches to the specific call
      const switched = rtcClient.switchAudioToCall(callId)
      if (switched) {
        console.log('[MultiCall] ✓ Audio switched to call:', callId)
      } else {
        console.warn('[MultiCall] Failed to switch audio to call:', callId)
      }
    } catch (err) {
      console.error('[MultiCall] Error switching audio:', err)
    }
  }, [])

  const value = {
    activeCalls,
    primaryCallId,
    canStartNewCall,
    startManualCall,
    hangUpCall,
    hangUpAllCalls,
    dismissCall,
    dismissAllEnded,
    getCallCount,
    switchPrimaryCall,
  }

  return (
    <MultiCallContext.Provider value={value}>
      {children}
    </MultiCallContext.Provider>
  )
}

export function useMultiCall() {
  const ctx = useContext(MultiCallContext)
  if (!ctx) throw new Error("useMultiCall must be used within MultiCallProvider")
  return ctx
}

