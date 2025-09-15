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
    openCall: ({ contact, fromNumber, toNumber, mode, telnyxCallId, webrtcSessionId }) => {
      setCall({ contact, fromNumber, toNumber, mode, telnyxCallId, webrtcSessionId, startedAt: Date.now(), notes: "", isMinimized: false })
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

