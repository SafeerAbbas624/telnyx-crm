"use client"

import React, { createContext, useContext, useMemo, useState } from "react"
import type { Contact } from "@/lib/types"

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
}

type CallUIContextType = {
  call: CallSession | null
  openCall: (opts: { contact?: Partial<Contact> & { id: string }, fromNumber: string, toNumber: string, mode: 'call_control' | 'webrtc', telnyxCallId?: string, webrtcSessionId?: string }) => void
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
    openCall: async ({ contact, fromNumber, toNumber, mode, telnyxCallId, webrtcSessionId }) => {
      // Auto-close previous call if exists (Issue #2 fix)
      if (call) {
        setCall(null)
        // Small delay to ensure clean state transition
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // If no contact provided, try to lookup by phone number (Issue #1 fix)
      let resolvedContact = contact
      if (!contact && toNumber) {
        try {
          const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils')
          const formattedNumber = formatPhoneNumberForTelnyx(toNumber)
          const digits = (formattedNumber || toNumber).replace(/\D/g, '')
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
        isMinimized: false
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

