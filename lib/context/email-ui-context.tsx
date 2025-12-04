"use client"

import React, { createContext, useContext, useMemo, useState } from "react"
import type { Contact } from "@/lib/types"

export type EmailSession = {
  contact?: Partial<Contact> & { id: string }
  email: string
  isMinimized: boolean
  sessionId: string
}

type EmailUIContextType = {
  emailSession: EmailSession | null
  openEmail: (opts: { contact?: Partial<Contact> & { id: string }, email: string }) => void
  minimize: () => void
  maximize: () => void
  close: () => void
}

const EmailUIContext = createContext<EmailUIContextType | undefined>(undefined)

export function EmailUIProvider({ children }: { children: React.ReactNode }) {
  const [emailSession, setEmailSession] = useState<EmailSession | null>(null)

  const value = useMemo<EmailUIContextType>(() => ({
    emailSession,
    openEmail: async ({ contact, email }) => {
      // If already open for same email, just maximize
      if (emailSession && emailSession.email === email) {
        setEmailSession((s) => (s ? { ...s, isMinimized: false } : s))
        return
      }

      // Lookup contact if not provided
      let resolvedContact = contact
      if (!contact && email) {
        try {
          const res = await fetch(`/api/contacts/lookup-by-email?email=${encodeURIComponent(email)}`)
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
        } catch (error) {
          console.error('Error looking up contact by email:', error)
        }
      }

      setEmailSession({
        contact: resolvedContact,
        email,
        isMinimized: false,
        sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    },
    minimize: () => setEmailSession((s) => (s ? { ...s, isMinimized: true } : s)),
    maximize: () => setEmailSession((s) => (s ? { ...s, isMinimized: false } : s)),
    close: () => setEmailSession(null),
  }), [emailSession])

  return (
    <EmailUIContext.Provider value={value}>
      {children}
    </EmailUIContext.Provider>
  )
}

export function useEmailUI() {
  const ctx = useContext(EmailUIContext)
  if (!ctx) throw new Error("useEmailUI must be used within EmailUIProvider")
  return ctx
}

