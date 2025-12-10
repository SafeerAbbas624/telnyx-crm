"use client"

import React, { createContext, useContext, useMemo, useState, useCallback } from "react"
import type { Contact } from "@/lib/types"

type ContactPanelContextType = {
  // Current contact being viewed in the panel
  contact: Contact | null
  // Whether the panel is open
  isOpen: boolean
  // Open the panel with a contact (by ID or full contact object)
  openContactPanel: (contactOrId: Contact | string) => Promise<void>
  // Close the panel
  closeContactPanel: () => void
}

const ContactPanelContext = createContext<ContactPanelContextType | undefined>(undefined)

export function ContactPanelProvider({ children }: { children: React.ReactNode }) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openContactPanel = useCallback(async (contactOrId: Contact | string) => {
    if (typeof contactOrId === 'string') {
      // Fetch contact by ID
      try {
        const res = await fetch(`/api/contacts/${contactOrId}`)
        if (res.ok) {
          const fetchedContact = await res.json()
          setContact(fetchedContact)
          setIsOpen(true)
        } else {
          console.error('Failed to fetch contact:', contactOrId)
        }
      } catch (error) {
        console.error('Error fetching contact:', error)
      }
    } else {
      // Use provided contact object
      setContact(contactOrId)
      setIsOpen(true)
    }
  }, [])

  const closeContactPanel = useCallback(() => {
    setIsOpen(false)
    // Delay clearing contact to allow for animation
    setTimeout(() => setContact(null), 300)
  }, [])

  const value = useMemo<ContactPanelContextType>(() => ({
    contact,
    isOpen,
    openContactPanel,
    closeContactPanel,
  }), [contact, isOpen, openContactPanel, closeContactPanel])

  return (
    <ContactPanelContext.Provider value={value}>
      {children}
    </ContactPanelContext.Provider>
  )
}

export function useContactPanel() {
  const ctx = useContext(ContactPanelContext)
  if (!ctx) throw new Error("useContactPanel must be used within ContactPanelProvider")
  return ctx
}

