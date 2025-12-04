"use client"

import React, { createContext, useContext, useMemo, useState, useCallback } from "react"
import type { Contact } from "@/lib/types"

export type SmsSession = {
  contact?: Partial<Contact> & { id: string }
  phoneNumber: string
  isMinimized: boolean
  sessionId: string // Unique ID for this SMS session
}

type SmsUIContextType = {
  // Support multiple sessions
  smsSessions: SmsSession[]
  // Legacy single-session support
  smsSession: SmsSession | null
  openSms: (opts: { contact?: Partial<Contact> & { id: string }, phoneNumber: string }) => void
  minimizeSession: (sessionId: string) => void
  maximizeSession: (sessionId: string) => void
  closeSession: (sessionId: string) => void
  // Legacy methods
  minimize: () => void
  maximize: () => void
  close: () => void
}

const SmsUIContext = createContext<SmsUIContextType | undefined>(undefined)

export function SmsUIProvider({ children }: { children: React.ReactNode }) {
  const [smsSessions, setSmsSessions] = useState<SmsSession[]>([])

  const openSms = useCallback(async ({ contact, phoneNumber }: { contact?: Partial<Contact> & { id: string }, phoneNumber: string }) => {
    // Check if already open for same number - maximize instead of creating new
    const existingSession = smsSessions.find(s => s.phoneNumber === phoneNumber)
    if (existingSession) {
      setSmsSessions(prev => prev.map(s =>
        s.sessionId === existingSession.sessionId ? { ...s, isMinimized: false } : s
      ))
      return
    }

    // Lookup contact if not provided
    let resolvedContact = contact
    if (!contact && phoneNumber) {
      try {
        const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils')
        const formattedNumber = formatPhoneNumberForTelnyx(phoneNumber)
        const digits = (formattedNumber || phoneNumber).replace(/\D/g, '')
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
      }
    }

    const newSession: SmsSession = {
      contact: resolvedContact,
      phoneNumber,
      isMinimized: false,
      sessionId: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    setSmsSessions(prev => [...prev, newSession])
  }, [smsSessions])

  const minimizeSession = useCallback((sessionId: string) => {
    setSmsSessions(prev => prev.map(s =>
      s.sessionId === sessionId ? { ...s, isMinimized: true } : s
    ))
  }, [])

  const maximizeSession = useCallback((sessionId: string) => {
    setSmsSessions(prev => prev.map(s =>
      s.sessionId === sessionId ? { ...s, isMinimized: false } : s
    ))
  }, [])

  const closeSession = useCallback((sessionId: string) => {
    setSmsSessions(prev => prev.filter(s => s.sessionId !== sessionId))
  }, [])

  // Legacy methods
  const minimize = useCallback(() => {
    setSmsSessions(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isMinimized: true }
      return updated
    })
  }, [])

  const maximize = useCallback(() => {
    setSmsSessions(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isMinimized: false }
      return updated
    })
  }, [])

  const close = useCallback(() => {
    setSmsSessions(prev => prev.slice(0, -1))
  }, [])

  // Legacy smsSession - last session or null
  const smsSession = smsSessions.length > 0 ? smsSessions[smsSessions.length - 1] : null

  const value = useMemo<SmsUIContextType>(() => ({
    smsSessions,
    smsSession,
    openSms,
    minimizeSession,
    maximizeSession,
    closeSession,
    minimize,
    maximize,
    close,
  }), [smsSessions, smsSession, openSms, minimizeSession, maximizeSession, closeSession, minimize, maximize, close])

  return (
    <SmsUIContext.Provider value={value}>
      {children}
    </SmsUIContext.Provider>
  )
}

export function useSmsUI() {
  const ctx = useContext(SmsUIContext)
  if (!ctx) throw new Error("useSmsUI must be used within SmsUIProvider")
  return ctx
}

