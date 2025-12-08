"use client"

import React, { createContext, useContext, useMemo, useState } from "react"
import type { Contact } from "@/lib/types"

// Power dialer context for script and dispositions
export type PowerDialerContext = {
  enabled: boolean
  listId?: string
  scriptId?: string
  script?: { id: string; name: string; content: string }
  onNextContact?: () => void
  onDisposition?: (dispositionId: string, notes?: string) => Promise<void>
}

export type CallSession = {
  contact?: Partial<Contact> & { id: string }
  fromNumber: string
  toNumber: string
  telnyxCallId?: string // present for Call Control dials
  webrtcSessionId?: string // present for WebRTC dials
  mode: 'call_control' | 'webrtc'
  startedAt: number
  notes: string
  isMinimized: boolean
  callId: string // Unique ID for this call session to prevent timer conflicts
  direction?: 'inbound' | 'outbound'
  powerDialer?: PowerDialerContext // Power dialer context when in dialer mode
}

type CallUIContextType = {
  call: CallSession | null
  openCall: (opts: {
    contact?: Partial<Contact> & { id: string },
    fromNumber: string,
    toNumber: string,
    mode: 'call_control' | 'webrtc',
    telnyxCallId?: string,
    webrtcSessionId?: string,
    direction?: 'inbound' | 'outbound',
    powerDialer?: PowerDialerContext
  }) => void
  setNotes: (notes: string) => void
  minimize: () => void
  maximize: () => void
  close: () => void
}

const CallUIContext = createContext<CallUIContextType | undefined>(undefined)

export function CallUIProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<CallSession | null>(null)

  const value = useMemo<CallUIContextType>(() => ({
    call,
    openCall: async ({ contact, fromNumber, toNumber, mode, telnyxCallId, webrtcSessionId, direction, powerDialer }) => {
      // Auto-close previous call if exists (Issue #2 fix)
      if (call) {
        setCall(null)
        // Small delay to ensure clean state transition
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // If no contact provided, try to lookup by phone number (Issue #1 fix)
      // For inbound calls, look up by fromNumber (caller); for outbound, by toNumber
      let resolvedContact = contact
      const lookupNumber = direction === 'inbound' ? fromNumber : toNumber
      if (!contact && lookupNumber) {
        try {
          const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils')
          const formattedNumber = formatPhoneNumberForTelnyx(lookupNumber)
          const digits = (formattedNumber || lookupNumber).replace(/\D/g, '')
          const last10 = digits.slice(-10)

          if (last10) {
            const res = await fetch(`/api/contacts/lookup-by-number?last10=${last10}`)
            if (res.ok) {
              const foundContact = await res.json()
              if (foundContact && foundContact.id) {
                resolvedContact = {
                  id: foundContact.id,
                  firstName: foundContact.firstName,
                  lastName: foundContact.lastName,
                }
              }
            }
          }
        } catch (error) {
          console.error('Error looking up contact by number:', error)
          // Continue without contact - not a critical error
        }
      }

      setCall({
        contact: resolvedContact,
        fromNumber,
        toNumber,
        mode,
        telnyxCallId,
        webrtcSessionId,
        startedAt: Date.now(),
        notes: "",
        isMinimized: false,
        callId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique call ID
        direction: direction || 'outbound',
        powerDialer, // Include power dialer context if provided
      })
    },
    setNotes: (notes: string) => {
      setCall((c) => (c ? { ...c, notes } : c))
    },
    minimize: () => setCall((c) => (c ? { ...c, isMinimized: true } : c)),
    maximize: () => setCall((c) => (c ? { ...c, isMinimized: false } : c)),
    close: () => setCall(null),
  }), [call])

  return (
    <CallUIContext.Provider value={value}>
      {children}
    </CallUIContext.Provider>
  )
}

export function useCallUI() {
  const ctx = useContext(CallUIContext)
  if (!ctx) throw new Error("useCallUI must be used within CallUIProvider")
  return ctx
}

