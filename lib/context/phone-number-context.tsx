"use client"

import React, { createContext, useContext, useState, useEffect, useMemo } from "react"

export type TelnyxPhoneNumber = {
  id: string
  phoneNumber: string
  friendlyName?: string | null
  isActive: boolean
  capabilities: string[]
}

type PhoneNumberContextType = {
  selectedPhoneNumber: TelnyxPhoneNumber | null
  setSelectedPhoneNumber: (phoneNumber: TelnyxPhoneNumber | null) => void
  availablePhoneNumbers: TelnyxPhoneNumber[]
  isLoading: boolean
  refreshPhoneNumbers: () => Promise<void>
}

const PhoneNumberContext = createContext<PhoneNumberContextType | undefined>(undefined)

export function PhoneNumberProvider({ children }: { children: React.ReactNode }) {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [availablePhoneNumbers, setAvailablePhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadPhoneNumbers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        const phoneNumbers = Array.isArray(data) ? data : []
        
        // Filter to only active phone numbers with VOICE capability
        const voiceNumbers = phoneNumbers.filter((pn: any) => 
          pn.isActive && pn.capabilities?.includes('VOICE')
        )
        
        setAvailablePhoneNumbers(voiceNumbers)
        
        // Auto-select first number if none selected
        if (!selectedPhoneNumber && voiceNumbers.length > 0) {
          // Try to restore from localStorage
          const savedNumber = localStorage.getItem('selectedPhoneNumber')
          if (savedNumber) {
            const parsed = JSON.parse(savedNumber)
            const found = voiceNumbers.find((pn: any) => pn.phoneNumber === parsed.phoneNumber)
            if (found) {
              setSelectedPhoneNumber(found)
              return
            }
          }
          // Otherwise select first available
          setSelectedPhoneNumber(voiceNumbers[0])
        }
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPhoneNumbers()
  }, [])

  // Save selected number to localStorage when it changes
  useEffect(() => {
    if (selectedPhoneNumber) {
      localStorage.setItem('selectedPhoneNumber', JSON.stringify(selectedPhoneNumber))
    }
  }, [selectedPhoneNumber])

  const value = useMemo<PhoneNumberContextType>(() => ({
    selectedPhoneNumber,
    setSelectedPhoneNumber,
    availablePhoneNumbers,
    isLoading,
    refreshPhoneNumbers: loadPhoneNumbers,
  }), [selectedPhoneNumber, availablePhoneNumbers, isLoading])

  return (
    <PhoneNumberContext.Provider value={value}>
      {children}
    </PhoneNumberContext.Provider>
  )
}

export function usePhoneNumber() {
  const context = useContext(PhoneNumberContext)
  if (context === undefined) {
    throw new Error('usePhoneNumber must be used within a PhoneNumberProvider')
  }
  return context
}

