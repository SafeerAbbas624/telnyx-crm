"use client"

import { useCallback } from "react"
import { useMultiCall } from "@/lib/context/multi-call-context"
import { usePhoneNumber } from "@/lib/context/phone-number-context"
import { toast } from "sonner"

interface MakeCallOptions {
  phoneNumber: string
  contactId?: string
  contactName?: string
  fromNumber?: string // Override the selected phone number
}

const MAX_CONCURRENT_CALLS = 3

/**
 * Hook for making calls from anywhere in the CRM.
 * Uses the MultiCallContext to display side-by-side call cards.
 */
export function useMakeCall() {
  const { activeCalls, canStartNewCall, startManualCall } = useMultiCall()
  const { selectedPhoneNumber } = usePhoneNumber()

  const makeCall = useCallback(async (options: MakeCallOptions): Promise<string | null> => {
    const { phoneNumber, contactId, contactName, fromNumber } = options

    // Validate phone number is provided
    if (!phoneNumber || phoneNumber.trim() === '') {
      toast.error('No phone number provided for the call.')
      console.error('[useMakeCall] Error: phoneNumber is empty or undefined')
      return null
    }

    // Check if we can start a new call
    const activeCount = Array.from(activeCalls.values()).filter(
      c => c.status !== 'ended' && c.status !== 'failed'
    ).length

    if (activeCount >= MAX_CONCURRENT_CALLS) {
      toast.error(`Maximum ${MAX_CONCURRENT_CALLS} concurrent calls reached. Please end a call first.`)
      return null
    }

    // Determine the from number
    const callerNumber = fromNumber || selectedPhoneNumber?.phoneNumber
    if (!callerNumber) {
      toast.error('No phone number selected. Please select a calling number from the header.')
      return null
    }

    try {
      const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils')
      const toNumber = formatPhoneNumberForTelnyx(phoneNumber)

      if (!toNumber) {
        toast.error('Invalid phone number format.')
        console.error('[useMakeCall] Error: formatPhoneNumberForTelnyx returned null for:', phoneNumber)
        return null
      }

      // Build contact object if we have info
      const contact = contactId ? {
        id: contactId,
        firstName: contactName?.split(' ')[0] || '',
        lastName: contactName?.split(' ').slice(1).join(' ') || '',
      } as any : undefined

      // Start the call using MultiCallContext (shows as side-by-side cards)
      const callId = await startManualCall({
        contact,
        toNumber,
        fromNumber: callerNumber,
      })

      if (!callId) {
        toast.error('Failed to start call')
        return null
      }

      toast.success(`Calling ${contactName || phoneNumber}`)
      return callId
    } catch (error: any) {
      console.error('[useMakeCall] Error:', error)
      toast.error(error.message || 'Failed to initiate call')
      return null
    }
  }, [startManualCall, selectedPhoneNumber, activeCalls])

  // Calculate active call count (excluding ended/failed)
  const activeCallCount = Array.from(activeCalls.values()).filter(
    c => c.status !== 'ended' && c.status !== 'failed'
  ).length

  return {
    makeCall,
    canStartNewCall: activeCallCount < MAX_CONCURRENT_CALLS,
    activeCallCount,
  }
}

