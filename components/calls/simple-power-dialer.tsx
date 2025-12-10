'use client'

/**
 * Multi-Line Power Dialer - Uses browser WebRTC for outbound calls
 *
 * Features:
 * 1. Places N calls simultaneously (configurable 1-5 lines)
 * 2. First person to answer wins - popup call window shows immediately
 * 3. Other calls get hung up automatically
 * 4. Shows script + dispositions in full-screen focused view
 * 5. After disposition, auto-advances to next batch
 *
 * State Machine:
 * - Each contact is dialed exactly ONCE per session unless explicitly re-queued
 * - dialedContactIds tracks all contacts that have been dialed
 * - currentIndex advances forward only, never backwards
 * - Telnyx callUpdate events (hangup/destroy/bye) mark calls as ended
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Phone, PhoneOff, Play, Pause, Square, ArrowLeft, User, Loader2, SkipForward, PhoneCall, X, Settings2, FileText, Shuffle } from 'lucide-react'
import { useCallUI } from '@/lib/context/call-ui-context'
import { rtcClient } from '@/lib/webrtc/rtc-client'
import { formatPhoneNumberForDisplay } from '@/lib/phone-utils'

// Structured logging for telemetry
const log = {
  info: (msg: string, data?: any) => console.log(`[PowerDialer] ℹ️ ${msg}`, data || ''),
  queue: (msg: string, data?: any) => console.log(`[PowerDialer] 📋 QUEUE: ${msg}`, data || ''),
  call: (msg: string, data?: any) => console.log(`[PowerDialer] 📞 CALL: ${msg}`, data || ''),
  state: (msg: string, data?: any) => console.log(`[PowerDialer] 🔄 STATE: ${msg}`, data || ''),
  disposition: (msg: string, data?: any) => console.log(`[PowerDialer] ✅ DISPOSITION: ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[PowerDialer] ❌ ERROR: ${msg}`, data || ''),
}

interface Contact {
  id: string
  listEntryId: string
  firstName: string
  lastName: string
  phone: string
  phone2?: string
  llcName?: string
  propertyAddress?: string
  status?: string
}

interface PhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
}

interface CallScript {
  id: string
  name: string
  content: string
}

interface CallDisposition {
  id: string
  name: string
  color: string
  icon?: string
}

// Track active calls for multi-line dialing
interface ActiveCall {
  contactId: string
  contact: Contact
  sessionId: string
  status: 'ringing' | 'answered' | 'ended' | 'failed'
  call?: any
}

interface SimplePowerDialerProps {
  listId: string
  listName: string
  scriptId?: string
  onBack: () => void
}

export function SimplePowerDialer({ listId, listName, scriptId, onBack }: SimplePowerDialerProps) {
  const { openCall, call, close } = useCallUI()

  // State
  const [contacts, setContacts] = useState<Contact[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]) // Multiple phone lines
  const [script, setScript] = useState<CallScript | null>(null)
  const [availableScripts, setAvailableScripts] = useState<CallScript[]>([])
  const [dispositions, setDispositions] = useState<CallDisposition[]>([])
  const [isDialing, setIsDialing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Multi-line state
  const [maxLines, setMaxLines] = useState(1) // How many calls to place at once
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([])
  const [answeredCall, setAnsweredCall] = useState<ActiveCall | null>(null)
  const [showFocusedCall, setShowFocusedCall] = useState(false)
  const [dispositionNotes, setDispositionNotes] = useState('')

  // Refs for managing async call state
  const activeCallsRef = useRef<ActiveCall[]>([])
  const hasAnsweredRef = useRef(false)
  const isPausedRef = useRef(false) // Ref to track pause state in callbacks

  // Track dialed contacts to prevent re-dialing (contactId -> timestamp)
  const dialedContactIdsRef = useRef<Set<string>>(new Set())

  // Track dialed phone numbers to prevent calling same number twice
  const dialedPhoneNumbersRef = useRef<Set<string>>(new Set())

  // Track which batch is currently being processed to prevent race conditions
  const currentBatchRef = useRef<number>(0)

  // Normalize phone number for comparison (remove non-digits)
  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '').slice(-10) // Last 10 digits
  }

  // Get next batch of contacts to dial (filtering out already-dialed contacts AND phone numbers)
  const getNextBatch = useCallback(() => {
    const remaining = contacts.slice(currentIndex)
    // Filter out contacts that have already been dialed in this session
    // Also filter out contacts whose phone number was already called (prevent duplicate numbers)
    const notYetDialed = remaining.filter(c => {
      const normalizedPhone = normalizePhone(c.phone)
      const alreadyDialedContact = dialedContactIdsRef.current.has(c.id)
      const alreadyDialedPhone = dialedPhoneNumbersRef.current.has(normalizedPhone)

      if (alreadyDialedContact) {
        log.queue(`Skipping ${c.firstName} ${c.lastName} - contact already dialed`)
      } else if (alreadyDialedPhone) {
        log.queue(`Skipping ${c.firstName} ${c.lastName} - phone ${c.phone} already dialed`)
      }

      return !alreadyDialedContact && !alreadyDialedPhone
    })
    const batch = notYetDialed.slice(0, maxLines)

    log.queue(`getNextBatch: index=${currentIndex}, remaining=${remaining.length}, notDialed=${notYetDialed.length}, batch=${batch.length}`,
      { batchContacts: batch.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, phone: c.phone })) })

    return batch
  }, [contacts, currentIndex, maxLines])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      log.info('Loading dialer data...', { listId, scriptId })

      try {
        // Load phone numbers
        const phoneRes = await fetch('/api/telnyx/phone-numbers')
        const phoneData = await phoneRes.json()
        const numbers = Array.isArray(phoneData) ? phoneData : (phoneData.phoneNumbers || [])
        setPhoneNumbers(numbers)
        if (numbers.length > 0) {
          setSelectedPhoneIds([numbers[0].id])
        }
        log.info(`Loaded ${numbers.length} phone numbers`)

        // Load contacts
        const contactsRes = await fetch(`/api/power-dialer/lists/${listId}/contacts?status=pending&limit=500`)
        const contactsData = await contactsRes.json()
        const loadedContacts: Contact[] = (contactsData.contacts || []).map((c: any) => ({
          id: c.contactId,
          listEntryId: c.id,
          firstName: c.contact?.firstName || '',
          lastName: c.contact?.lastName || '',
          phone: c.phoneNumber || c.contact?.phone1 || '',
          phone2: c.contact?.phone2,
          llcName: c.contact?.llcName,
          propertyAddress: c.contact?.propertyAddress,
          status: c.status
        }))
        setContacts(loadedContacts)
        log.queue(`Loaded ${loadedContacts.length} contacts into queue`)

        // Load all available scripts for selection
        const scriptsRes = await fetch('/api/call-scripts?activeOnly=true')
        if (scriptsRes.ok) {
          const scriptsData = await scriptsRes.json()
          setAvailableScripts(scriptsData.scripts || [])
        }

        // Load script if provided
        if (scriptId) {
          const scriptRes = await fetch(`/api/call-scripts/${scriptId}`)
          if (scriptRes.ok) {
            const scriptData = await scriptRes.json()
            setScript(scriptData)
            log.info(`Loaded script: ${scriptData.name}`)
          }
        }

        // Load dispositions
        const dispRes = await fetch('/api/dispositions')
        const dispData = await dispRes.json()
        setDispositions(Array.isArray(dispData) ? dispData : [])
        log.info(`Loaded ${Array.isArray(dispData) ? dispData.length : 0} dispositions`)

      } catch (error) {
        console.error('[PowerDialer] Error loading data:', error)
        toast.error('Failed to load dialer data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [listId, scriptId])

  // Get selected phone numbers for caller ID rotation
  const getSelectedPhones = useCallback(() => {
    return phoneNumbers.filter(p => selectedPhoneIds.includes(p.id))
  }, [phoneNumbers, selectedPhoneIds])

  // Place multiple calls simultaneously
  const placeMultipleCalls = useCallback(async () => {
    // Increment batch counter to track which batch we're on
    const batchNum = ++currentBatchRef.current

    log.state(`placeMultipleCalls called`, {
      batchNum,
      hasAnswered: hasAnsweredRef.current,
      currentIndex,
      totalContacts: contacts.length,
      dialedCount: dialedContactIdsRef.current.size
    })

    if (hasAnsweredRef.current) {
      log.state(`Skipping - already have an answered call`)
      return
    }

    // Check if we've dialed all contacts
    if (currentIndex >= contacts.length) {
      log.state(`Campaign complete - all ${contacts.length} contacts processed`)
      setIsDialing(false)
      toast.success('Dialer complete - all contacts called!')
      return
    }

    const batch = getNextBatch()
    if (batch.length === 0) {
      log.state(`No more contacts to dial (all remaining contacts already dialed)`)
      setIsDialing(false)
      toast.success('Dialer complete - all contacts called!')
      return
    }

    const phones = getSelectedPhones()
    if (phones.length === 0) {
      toast.error('Please select at least one phone number')
      return
    }

    log.call(`Placing batch #${batchNum}: ${batch.length} calls`, {
      contacts: batch.map(c => `${c.firstName} ${c.lastName} (${c.id})`)
    })

    try {
      await rtcClient.ensureRegistered()

      const newCalls: ActiveCall[] = []

      for (let i = 0; i < batch.length; i++) {
        const contact = batch[i]
        const phone = phones[i % phones.length] // Rotate through selected phones

        // Mark contact AND phone number as dialed BEFORE placing call to prevent race conditions
        dialedContactIdsRef.current.add(contact.id)
        dialedPhoneNumbersRef.current.add(normalizePhone(contact.phone))
        log.call(`Dialing ${contact.firstName} ${contact.lastName}`, {
          contactId: contact.id,
          phone: contact.phone,
          normalizedPhone: normalizePhone(contact.phone),
          fromNumber: phone.phoneNumber,
          batchNum,
          totalDialedContacts: dialedContactIdsRef.current.size,
          totalDialedPhones: dialedPhoneNumbersRef.current.size
        })

        try {
          const { sessionId } = await rtcClient.startCall({
            toNumber: contact.phone,
            fromNumber: phone.phoneNumber
          })

          newCalls.push({
            contactId: contact.id,
            contact,
            sessionId,
            status: 'ringing'
          })

          log.call(`Call initiated`, {
            contactId: contact.id,
            sessionId,
            name: `${contact.firstName} ${contact.lastName}`
          })

          // Log the call to backend
          fetch('/api/telnyx/webrtc-calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webrtcSessionId: sessionId,
              contactId: contact.id,
              fromNumber: phone.phoneNumber,
              toNumber: contact.phone,
            })
          }).catch(err => log.error('Failed to log call to backend', err))

          // Small delay between calls to avoid rate limiting
          if (i < batch.length - 1) {
            await new Promise(r => setTimeout(r, 500))
          }
        } catch (err) {
          log.error(`Failed to call ${contact.firstName}`, err)
        }
      }

      activeCallsRef.current = newCalls
      setActiveCalls(newCalls)

      log.state(`Batch #${batchNum} initiated with ${newCalls.length} calls`)

    } catch (error: any) {
      console.error('[PowerDialer] Call batch failed:', error)
      toast.error(error.message || 'Failed to place calls')
    }
  }, [getNextBatch, getSelectedPhones])

  // Handle when a call is answered - this is the "winner"
  const handleCallAnswered = useCallback((sessionId: string) => {
    if (hasAnsweredRef.current) {
      log.call(`Ignoring answered call - already have a winner`, { sessionId })
      return
    }

    const answeredCallInfo = activeCallsRef.current.find(c => c.sessionId === sessionId)
    if (!answeredCallInfo) {
      log.call(`Cannot find call info for answered session`, { sessionId })
      return
    }

    // Safely get contact name
    const contactName = answeredCallInfo.contact
      ? `${answeredCallInfo.contact.firstName || ''} ${answeredCallInfo.contact.lastName || ''}`.trim() || 'Unknown'
      : 'Unknown'

    log.call(`🎉 WINNER: ${contactName}`, {
      contactId: answeredCallInfo.contactId,
      sessionId,
      otherCalls: activeCallsRef.current.filter(c => c.sessionId !== sessionId).length,
      hasContact: !!answeredCallInfo.contact
    })

    hasAnsweredRef.current = true

    // Hang up all other calls (they lost the race)
    const otherCalls = activeCallsRef.current.filter(c => c.sessionId !== sessionId && c.status === 'ringing')
    otherCalls.forEach(c => {
      const otherName = c.contact?.firstName || 'Unknown'
      log.call(`Hanging up losing call: ${otherName}`, { sessionId: c.sessionId })
      rtcClient.hangup(c.sessionId).catch(console.error)
    })

    // Update state
    setAnsweredCall(answeredCallInfo)
    setShowFocusedCall(true)
    setActiveCalls([{ ...answeredCallInfo, status: 'answered' }])

    toast.success(`Connected with ${contactName}!`)
  }, [])

  // Handle disposition selection
  const handleDisposition = useCallback(async (dispositionId: string) => {
    if (!answeredCall) return

    const dispositionName = dispositions.find(d => d.id === dispositionId)?.name || dispositionId
    log.disposition(`Saving disposition`, {
      contactId: answeredCall.contactId,
      contactName: `${answeredCall.contact.firstName} ${answeredCall.contact.lastName}`,
      dispositionId,
      dispositionName,
      notes: dispositionNotes ? 'Yes' : 'No',
      listEntryId: answeredCall.contact.listEntryId
    })

    try {
      const res = await fetch('/api/dialer/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: answeredCall.contactId,
          dispositionId,
          notes: dispositionNotes,
          listId,
          listEntryId: answeredCall.contact.listEntryId,
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save disposition')
      }

      log.disposition(`Disposition saved successfully`, { contactId: answeredCall.contactId, dispositionName })
      toast.success('Disposition saved')

      // Hang up the call
      rtcClient.hangup().catch(console.error)

      // Calculate next index BEFORE resetting state to prevent race condition
      const batchSize = Math.min(maxLines, contacts.length - currentIndex)
      const nextIndex = currentIndex + batchSize
      const shouldContinueDialing = isDialing && !isPaused && nextIndex < contacts.length

      log.state(`Post-disposition state update`, {
        currentIndex,
        batchSize,
        nextIndex,
        totalContacts: contacts.length,
        shouldContinueDialing,
        dialedCount: dialedContactIdsRef.current.size
      })

      // Update index FIRST
      setCurrentIndex(nextIndex)

      // Then reset call state
      setAnsweredCall(null)
      setShowFocusedCall(false)
      setActiveCalls([])
      setDispositionNotes('')

      // Reset answered flag LAST (after index is updated)
      hasAnsweredRef.current = false

      // Continue dialing if active and more contacts remain
      if (shouldContinueDialing) {
        log.state(`Scheduling next batch in 1 second`)
        setTimeout(() => placeMultipleCalls(), 1000)
      } else if (nextIndex >= contacts.length) {
        log.state(`Campaign complete - all ${contacts.length} contacts processed`)
        setIsDialing(false)
        toast.success('Dialer complete - all contacts called!')
      }

    } catch (error: any) {
      log.error('Disposition save failed', error)
      toast.error(error.message || 'Failed to save disposition')
    }
  }, [answeredCall, dispositionNotes, dispositions, listId, maxLines, contacts.length, currentIndex, isDialing, isPaused, placeMultipleCalls])

  // Skip current contact / hang up
  const handleSkip = useCallback(() => {
    console.log('[PowerDialer] ⏭️ SKIP: Button clicked', {
      activeCalls: activeCallsRef.current.length,
      currentIndex,
      hasAnswered: hasAnsweredRef.current
    })
    log.state(`Skip requested`, {
      activeCalls: activeCallsRef.current.length,
      currentIndex,
      hasAnswered: hasAnsweredRef.current
    })

    // Hang up all active calls
    activeCallsRef.current.forEach(c => {
      log.call(`Hanging up on skip: ${c.contact.firstName}`, { sessionId: c.sessionId })
      rtcClient.hangup(c.sessionId).catch(console.error)
    })

    // For skip, we advance by 1 contact (not batch size) when in single-line mode
    // This allows skipping the current contact to move to the next one
    const skipCount = maxLines === 1 ? 1 : Math.min(maxLines, contacts.length - currentIndex)
    const nextIndex = currentIndex + skipCount
    const shouldContinueDialing = isDialing && !isPaused && nextIndex < contacts.length

    log.state(`Skip state update`, { currentIndex, skipCount, nextIndex, shouldContinueDialing })
    toast.info(`Skipped contact ${currentIndex + 1} of ${contacts.length}`)

    // Update index FIRST
    setCurrentIndex(nextIndex)

    // Then reset state
    setAnsweredCall(null)
    setShowFocusedCall(false)
    setActiveCalls([])
    setDispositionNotes('')

    // Reset flag LAST
    hasAnsweredRef.current = false

    if (shouldContinueDialing) {
      setTimeout(() => placeMultipleCalls(), 500)
    } else if (nextIndex >= contacts.length) {
      log.state(`Campaign complete after skip - all contacts processed`)
      setIsDialing(false)
      toast.success('Dialer complete - all contacts called!')
    }
  }, [maxLines, contacts.length, currentIndex, isDialing, isPaused, placeMultipleCalls])

  // Start dialing
  const handleStart = useCallback(() => {
    if (selectedPhoneIds.length === 0) {
      toast.error('Please select at least one phone number')
      return
    }
    if (contacts.length === 0) {
      toast.error('No contacts in queue')
      return
    }

    log.state(`Starting dialer`, {
      maxLines,
      selectedPhones: selectedPhoneIds.length,
      totalContacts: contacts.length,
      currentIndex
    })

    // Reset trackers for new session
    dialedContactIdsRef.current.clear()
    dialedPhoneNumbersRef.current.clear()
    currentBatchRef.current = 0
    isPausedRef.current = false // Clear pause ref

    setIsDialing(true)
    setIsPaused(false)
    hasAnsweredRef.current = false
    placeMultipleCalls()
  }, [selectedPhoneIds.length, contacts.length, maxLines, currentIndex, placeMultipleCalls])

  // Pause dialing
  const handlePause = useCallback(() => {
    console.log('[PowerDialer] ⏸️ PAUSE: Button clicked')
    log.state(`Pausing dialer`)
    isPausedRef.current = true // Set ref IMMEDIATELY so callbacks see it
    setIsPaused(true)
    toast.info('Dialer paused - will not auto-advance after current calls')
    // Hang up ringing calls but keep answered call
    activeCallsRef.current.forEach(c => {
      if (c.status === 'ringing') {
        log.call(`Hanging up ringing call on pause: ${c.contact.firstName}`)
        rtcClient.hangup(c.sessionId).catch(console.error)
      }
    })
  }, [])

  // Resume dialing
  const handleResume = useCallback(() => {
    console.log('[PowerDialer] ▶️ RESUME: Button clicked')
    log.state(`Resuming dialer`, { hasAnswered: hasAnsweredRef.current, currentIndex })
    isPausedRef.current = false // Clear ref IMMEDIATELY
    setIsPaused(false)
    toast.info('Dialer resumed')
    if (!hasAnsweredRef.current) {
      placeMultipleCalls()
    }
  }, [placeMultipleCalls, currentIndex])

  // Stop dialing
  const handleStop = useCallback(() => {
    isPausedRef.current = false // Clear ref
    setIsDialing(false)
    setIsPaused(false)
    // Hang up all calls
    activeCallsRef.current.forEach(c => {
      rtcClient.hangup(c.sessionId).catch(console.error)
    })
    hasAnsweredRef.current = false
    setAnsweredCall(null)
    setShowFocusedCall(false)
    setActiveCalls([])
    close()
  }, [close])

  // Shuffle queue - randomize remaining contacts
  const handleShuffle = useCallback(() => {
    console.log('[PowerDialer] 🔀 SHUFFLE: Button clicked')

    // Get already-called contacts (before current index)
    const calledContacts = contacts.slice(0, currentIndex)
    // Get remaining contacts (from current index onwards)
    const remainingContacts = contacts.slice(currentIndex)

    // Fisher-Yates shuffle for remaining contacts
    const shuffled = [...remainingContacts]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Reconstruct the contacts array: called + shuffled remaining
    const newContacts = [...calledContacts, ...shuffled]
    setContacts(newContacts)

    log.state(`Queue shuffled`, {
      totalContacts: newContacts.length,
      alreadyCalled: calledContacts.length,
      shuffledRemaining: shuffled.length,
      currentIndex
    })

    toast.success(`Shuffled ${shuffled.length} remaining contacts`)
  }, [contacts, currentIndex])

  // Listen for call state updates from rtcClient
  useEffect(() => {
    const handleCallUpdate = (data: any) => {
      const { state, callId } = data
      log.call(`callUpdate event`, { state, callId })

      // Find the matching call in our active calls
      const matchingCall = activeCallsRef.current.find(c => c.sessionId === callId)
      if (!matchingCall) {
        log.call(`callUpdate for unknown call, ignoring`, { callId })
        return
      }

      // Safely get contact name for logging
      const contactName = matchingCall.contact
        ? `${matchingCall.contact.firstName || ''} ${matchingCall.contact.lastName || ''}`.trim() || 'Unknown'
        : 'Unknown'

      // Handle answered state
      if (state === 'active' || state === 'answering') {
        log.call(`🎉 ANSWERED: ${contactName}`, {
          contactId: matchingCall.contactId,
          callId
        })
        handleCallAnswered(callId)
        return // Don't process further - we have an answered call
      }

      // Handle end states
      const endStates = ['hangup', 'destroy', 'failed', 'bye', 'cancel', 'rejected']
      if (endStates.includes(state)) {
        log.call(`Call ended: ${contactName} (${state})`, {
          contactId: matchingCall.contactId,
          callId,
          wasAnswered: matchingCall.status === 'answered'
        })

        // Update call status in ref
        activeCallsRef.current = activeCallsRef.current.map(c =>
          c.sessionId === callId ? { ...c, status: 'ended' } : c
        )
        setActiveCalls([...activeCallsRef.current])

        // Check if all calls in this batch ended without anyone answering
        const allEnded = activeCallsRef.current.every(c => c.status === 'ended' || c.status === 'failed')
        const hasActiveAnsweredCall = hasAnsweredRef.current
        // Use ref for isPaused to get the CURRENT value (not stale closure value)
        const currentlyPaused = isPausedRef.current

        log.state(`All calls ended check`, {
          allEnded,
          hasActiveAnsweredCall,
          isDialing,
          isPaused: currentlyPaused,
          activeCalls: activeCallsRef.current.map(c => ({
            name: c.contact.firstName,
            status: c.status
          }))
        })

        if (allEnded && !hasActiveAnsweredCall && isDialing && !currentlyPaused) {
          // No one answered in this batch - advance and dial next batch
          const batchSize = activeCallsRef.current.length // Use actual batch size, not maxLines
          const nextIndex = currentIndex + batchSize

          log.state(`No answer in batch - advancing`, {
            currentIndex,
            batchSize,
            nextIndex,
            totalContacts: contacts.length
          })

          if (nextIndex >= contacts.length) {
            log.state(`Campaign complete - no more contacts`)
            setIsDialing(false)
            setActiveCalls([])
            activeCallsRef.current = []
            toast.success('Dialer complete - all contacts called!')
          } else {
            setCurrentIndex(nextIndex)
            // Clear active calls before next batch
            setActiveCalls([])
            activeCallsRef.current = []
            setTimeout(() => placeMultipleCalls(), 1000)
          }
        } else if (currentlyPaused && allEnded) {
          log.state(`Dialer is paused - NOT advancing to next batch`)
          // Clear active calls UI when paused and all calls ended
          setActiveCalls([])
          activeCallsRef.current = []
        }
      }
    }

    rtcClient.on('callUpdate', handleCallUpdate)

    return () => {
      rtcClient.off('callUpdate', handleCallUpdate)
    }
  }, [handleCallAnswered, isDialing, contacts.length, currentIndex, placeMultipleCalls])

  // Toggle phone selection for multi-line
  const togglePhoneSelection = (phoneId: string) => {
    setSelectedPhoneIds(prev =>
      prev.includes(phoneId)
        ? prev.filter(id => id !== phoneId)
        : [...prev, phoneId]
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // =====================================================
  // ACTIVE CALL PANEL - Renders inside main view, not blocking
  // =====================================================
  const renderActiveCallPanel = () => {
    if (!showFocusedCall || !answeredCall) return null

    const contact = answeredCall.contact
    // Safety check - if contact is missing, show error state
    if (!contact) {
      log.error('Answered call has no contact data', { answeredCall })
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 mb-2">Error: Contact data not available</p>
          <Button size="sm" onClick={() => {
            rtcClient.hangup().catch(console.error)
            setShowFocusedCall(false)
            setAnsweredCall(null)
          }}>
            Close & Continue
          </Button>
        </div>
      )
    }

    return (
      <Card className="border-green-500 border-2">
        {/* Active call header */}
        <div className="flex items-center justify-between p-3 bg-green-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Badge className="bg-white text-green-600 animate-pulse text-xs">● LIVE</Badge>
            <span className="font-bold">
              {contact?.firstName || ''} {contact?.lastName || ''}
            </span>
            <span className="text-green-100 text-sm">
              {formatPhoneNumberForDisplay(contact?.phone || '')}
            </span>
          </div>
          <Button variant="destructive" size="sm" onClick={() => {
            rtcClient.hangup().catch(console.error)
          }}>
            <PhoneOff className="h-4 w-4 mr-1" />
            End
          </Button>
        </div>

        <CardContent className="p-4">
          {/* Contact info row */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <User className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{contact?.firstName || ''} {contact?.lastName || ''}</h3>
              <p className="text-sm text-muted-foreground">{formatPhoneNumberForDisplay(contact?.phone || '')}</p>
              {contact?.llcName && <p className="text-sm text-muted-foreground">{contact.llcName}</p>}
              {contact?.propertyAddress && <p className="text-sm text-muted-foreground">{contact.propertyAddress}</p>}
            </div>
          </div>

          {/* Script section */}
          {script && script.content ? (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">{script.name}</h4>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                <div
                  dangerouslySetInnerHTML={{
                    __html: (script.content || '')
                      .replace(/\{\{?firstName\}?\}/gi, contact?.firstName || '')
                      .replace(/\{\{?lastname\}?\}/gi, contact?.lastName || '')
                      .replace(/\{\{?phone\}?\}/gi, contact?.phone || '')
                      .replace(/\{\{?llcName\}?\}/gi, contact?.llcName || '')
                      .replace(/\{\{?companyName\}?\}/gi, contact?.llcName || '')
                      .replace(/\{\{?propertyAddress\}?\}/gi, contact?.propertyAddress || '')
                      .replace(/\{\{?address\}?\}/gi, contact?.propertyAddress || '')
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Dispositions */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Disposition</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {dispositions.map(d => (
                <Button
                  key={d.id}
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-2"
                  onClick={() => handleDisposition(d.id)}
                  style={{ borderColor: d.color }}
                >
                  <div
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-xs" style={{ color: d.color }}>{d.name}</span>
                </Button>
              ))}
            </div>

            {/* Notes */}
            <Textarea
              value={dispositionNotes}
              onChange={(e) => setDispositionNotes(e.target.value)}
              placeholder="Add call notes..."
              className="text-sm"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // =====================================================
  // MAIN DIALER VIEW - Settings, queue, AND active call panel
  // =====================================================
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={isDialing}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {listName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {contacts.length} contacts • Position {currentIndex + 1} of {contacts.length}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {activeCalls.length > 0 && (
            <Badge className="bg-blue-600 animate-pulse">
              <PhoneCall className="h-3 w-3 mr-1" />
              {activeCalls.filter(c => c.status === 'ringing').length} Ringing
            </Badge>
          )}
          {isDialing && !isPaused && !showFocusedCall && (
            <Badge className="bg-green-600 animate-pulse">● DIALING</Badge>
          )}
          {isPaused && (
            <Badge className="bg-yellow-500">⏸ PAUSED</Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: Controls */}
        <Card className="w-96 flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Dialer Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lines Setting */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Simultaneous Lines: {maxLines}
              </label>
              <Slider
                value={[maxLines]}
                onValueChange={([v]) => setMaxLines(v)}
                min={1}
                max={5}
                step={1}
                disabled={isDialing}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                First person to answer wins - others get hung up
              </p>
            </div>

            {/* Phone Numbers - Multi-select */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Caller IDs ({selectedPhoneIds.length} selected)
              </label>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                {phoneNumbers.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                      selectedPhoneIds.includes(p.id) ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => !isDialing && togglePhoneSelection(p.id)}
                  >
                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                      selectedPhoneIds.includes(p.id) ? 'bg-primary border-primary' : ''
                    }`}>
                      {selectedPhoneIds.includes(p.id) && <X className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">
                      {formatPhoneNumberForDisplay(p.phoneNumber)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              {!isDialing ? (
                <Button onClick={handleStart} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Start Dialing ({maxLines} lines)
                </Button>
              ) : (
                <>
                  {!isPaused ? (
                    <Button onClick={handlePause} variant="outline" className="w-full" size="lg">
                      <Pause className="h-5 w-5 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={handleResume} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                      <Play className="h-5 w-5 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button onClick={handleStop} variant="destructive" className="w-full" size="lg">
                    <Square className="h-5 w-5 mr-2" />
                    Stop Dialer
                  </Button>
                </>
              )}

              {/* Skip Contact Button */}
              <Button
                onClick={handleSkip}
                variant="outline"
                className="w-full"
                disabled={!isDialing}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip Contact
              </Button>

              {/* Shuffle Queue Button */}
              <Button
                onClick={handleShuffle}
                variant="outline"
                className="w-full"
                disabled={isDialing && !isPaused}
              >
                <Shuffle className="h-4 w-4 mr-2" />
                Shuffle Queue ({contacts.length - currentIndex} remaining)
              </Button>
            </div>

            {/* Progress */}
            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-2">Progress</div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${(currentIndex / Math.max(contacts.length, 1)) * 100}%` }}
                />
              </div>
              <div className="text-sm text-center mt-1 font-medium">
                {currentIndex} / {contacts.length} called
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Center: Active Call Panel OR Active Calls List */}
        <div className="flex-1 overflow-auto">
          {/* Show focused call panel when someone has answered */}
          {showFocusedCall && answeredCall ? (
            renderActiveCallPanel()
          ) : (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {activeCalls.length > 0 ? 'Active Calls' : 'Ready to Dial'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeCalls.length > 0 ? (
                  <div className="space-y-3">
                    {activeCalls.map((ac) => (
                      <div
                        key={ac.sessionId}
                        className={`p-4 rounded-lg border-2 ${
                          ac.status === 'ringing' ? 'border-blue-400 bg-blue-50 animate-pulse' :
                          ac.status === 'answered' ? 'border-green-400 bg-green-50' :
                          'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              ac.status === 'ringing' ? 'bg-blue-200' :
                              ac.status === 'answered' ? 'bg-green-200' : 'bg-gray-200'
                            }`}>
                              {ac.status === 'ringing' ? (
                                <Phone className="h-5 w-5 text-blue-600 animate-bounce" />
                              ) : ac.status === 'answered' ? (
                                <PhoneCall className="h-5 w-5 text-green-600" />
                              ) : (
                                <PhoneOff className="h-5 w-5 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">
                                {ac.contact?.firstName || ''} {ac.contact?.lastName || ''}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatPhoneNumberForDisplay(ac.contact?.phone || '')}
                              </div>
                            </div>
                          </div>
                          <Badge className={
                            ac.status === 'ringing' ? 'bg-blue-600' :
                            ac.status === 'answered' ? 'bg-green-600' : 'bg-gray-400'
                          }>
                            {ac.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">Ready to dial</h3>
                    <p className="text-muted-foreground">
                      Click "Start Dialing" to begin calling {Math.min(maxLines, contacts.length - currentIndex)} contacts
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Queue */}
        <Card className="w-72 flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Queue ({Math.max(0, contacts.length - currentIndex)} remaining)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-2 space-y-1">
                {contacts.slice(currentIndex, currentIndex + 25).map((contact, idx) => (
                  <div
                    key={contact.id}
                    className={`p-2 rounded-md text-sm ${
                      idx < maxLines && isDialing ? 'bg-blue-50 border border-blue-200' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPhoneNumberForDisplay(contact.phone)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

