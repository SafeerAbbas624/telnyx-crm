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
import { Phone, PhoneOff, Play, Pause, Square, ArrowLeft, User, Loader2, SkipForward, PhoneCall, X, Settings2 } from 'lucide-react'
import { useCallUI } from '@/lib/context/call-ui-context'
import { rtcClient } from '@/lib/webrtc/rtc-client'
import { formatPhoneNumberForDisplay } from '@/lib/phone-utils'

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
  
  // Get next batch of contacts to dial
  const getNextBatch = useCallback(() => {
    const remaining = contacts.slice(currentIndex)
    return remaining.slice(0, maxLines)
  }, [contacts, currentIndex, maxLines])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Load phone numbers
        const phoneRes = await fetch('/api/telnyx/phone-numbers')
        const phoneData = await phoneRes.json()
        const numbers = Array.isArray(phoneData) ? phoneData : (phoneData.phoneNumbers || [])
        setPhoneNumbers(numbers)
        if (numbers.length > 0) {
          setSelectedPhoneIds([numbers[0].id])
        }

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

        // Load script if provided
        if (scriptId) {
          const scriptRes = await fetch(`/api/call-scripts/${scriptId}`)
          if (scriptRes.ok) {
            const scriptData = await scriptRes.json()
            setScript(scriptData)
          }
        }

        // Load dispositions
        const dispRes = await fetch('/api/dispositions')
        const dispData = await dispRes.json()
        setDispositions(Array.isArray(dispData) ? dispData : [])

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
    if (hasAnsweredRef.current) return

    const batch = getNextBatch()
    if (batch.length === 0) {
      setIsDialing(false)
      toast.success('Dialer complete - all contacts called!')
      return
    }

    const phones = getSelectedPhones()
    if (phones.length === 0) {
      toast.error('Please select at least one phone number')
      return
    }

    console.log(`[PowerDialer] Placing ${batch.length} calls...`)

    try {
      await rtcClient.ensureRegistered()

      const newCalls: ActiveCall[] = []

      for (let i = 0; i < batch.length; i++) {
        const contact = batch[i]
        const phone = phones[i % phones.length] // Rotate through selected phones

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

          // Log the call
          fetch('/api/telnyx/webrtc-calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webrtcSessionId: sessionId,
              contactId: contact.id,
              fromNumber: phone.phoneNumber,
              toNumber: contact.phone,
            })
          }).catch(err => console.error('Failed to log call:', err))

          // Small delay between calls to avoid rate limiting
          if (i < batch.length - 1) {
            await new Promise(r => setTimeout(r, 500))
          }
        } catch (err) {
          console.error(`[PowerDialer] Failed to call ${contact.firstName}:`, err)
        }
      }

      activeCallsRef.current = newCalls
      setActiveCalls(newCalls)

    } catch (error: any) {
      console.error('[PowerDialer] Call batch failed:', error)
      toast.error(error.message || 'Failed to place calls')
    }
  }, [getNextBatch, getSelectedPhones])

  // Handle when a call is answered - this is the "winner"
  const handleCallAnswered = useCallback((sessionId: string) => {
    if (hasAnsweredRef.current) return // Already have a winner

    const answeredCallInfo = activeCallsRef.current.find(c => c.sessionId === sessionId)
    if (!answeredCallInfo) return

    console.log(`[PowerDialer] 🎉 ANSWERED by ${answeredCallInfo.contact.firstName}!`)
    hasAnsweredRef.current = true

    // Hang up all other calls
    activeCallsRef.current.forEach(c => {
      if (c.sessionId !== sessionId && c.status === 'ringing') {
        console.log(`[PowerDialer] Hanging up other call to ${c.contact.firstName}`)
        rtcClient.hangup(c.sessionId).catch(console.error)
      }
    })

    // Update state
    setAnsweredCall(answeredCallInfo)
    setShowFocusedCall(true)
    setActiveCalls([{ ...answeredCallInfo, status: 'answered' }])

    toast.success(`Connected with ${answeredCallInfo.contact.firstName}!`)
  }, [])

  // Handle disposition selection
  const handleDisposition = useCallback(async (dispositionId: string) => {
    if (!answeredCall) return

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

      toast.success('Disposition saved')

      // Hang up the call
      rtcClient.hangup().catch(console.error)

      // Reset and move to next batch
      hasAnsweredRef.current = false
      setAnsweredCall(null)
      setShowFocusedCall(false)
      setActiveCalls([])
      setDispositionNotes('')

      // Advance index by the batch size we just dialed
      const batchSize = Math.min(maxLines, contacts.length - currentIndex)
      setCurrentIndex(prev => prev + batchSize)

      // Continue dialing if active
      if (isDialing && !isPaused) {
        setTimeout(() => placeMultipleCalls(), 1000)
      }

    } catch (error: any) {
      console.error('[PowerDialer] Disposition error:', error)
      toast.error(error.message || 'Failed to save disposition')
    }
  }, [answeredCall, dispositionNotes, listId, maxLines, contacts.length, currentIndex, isDialing, isPaused, placeMultipleCalls])

  // Skip current batch / hang up
  const handleSkip = useCallback(() => {
    // Hang up all active calls
    activeCallsRef.current.forEach(c => {
      rtcClient.hangup(c.sessionId).catch(console.error)
    })

    hasAnsweredRef.current = false
    setAnsweredCall(null)
    setShowFocusedCall(false)
    setActiveCalls([])
    setDispositionNotes('')

    // Advance to next batch
    const batchSize = Math.min(maxLines, contacts.length - currentIndex)
    setCurrentIndex(prev => prev + batchSize)

    if (isDialing && !isPaused) {
      setTimeout(() => placeMultipleCalls(), 500)
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

    setIsDialing(true)
    setIsPaused(false)
    hasAnsweredRef.current = false
    placeMultipleCalls()
  }, [selectedPhoneIds.length, contacts.length, placeMultipleCalls])

  // Pause dialing
  const handlePause = useCallback(() => {
    setIsPaused(true)
    // Hang up ringing calls but keep answered call
    activeCallsRef.current.forEach(c => {
      if (c.status === 'ringing') {
        rtcClient.hangup(c.sessionId).catch(console.error)
      }
    })
  }, [])

  // Resume dialing
  const handleResume = useCallback(() => {
    setIsPaused(false)
    if (!hasAnsweredRef.current) {
      placeMultipleCalls()
    }
  }, [placeMultipleCalls])

  // Stop dialing
  const handleStop = useCallback(() => {
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

  // Listen for call state updates from rtcClient
  useEffect(() => {
    const handleCallUpdate = (data: any) => {
      const { state, callId } = data
      console.log(`[PowerDialer] Call update: state=${state}, callId=${callId}`)

      // Find the matching call in our active calls
      const matchingCall = activeCallsRef.current.find(c => c.sessionId === callId)
      if (!matchingCall) {
        console.log('[PowerDialer] Call update for unknown call, ignoring')
        return
      }

      // Handle answered state
      if (state === 'active' || state === 'answering') {
        console.log(`[PowerDialer] 🎉 Call ANSWERED: ${matchingCall.contact.firstName}`)
        handleCallAnswered(callId)
      }

      // Handle end states
      const endStates = ['hangup', 'destroy', 'failed', 'bye', 'cancel', 'rejected']
      if (endStates.includes(state)) {
        console.log(`[PowerDialer] Call ended: ${matchingCall.contact.firstName} (${state})`)

        // Update call status
        activeCallsRef.current = activeCallsRef.current.map(c =>
          c.sessionId === callId ? { ...c, status: 'ended' } : c
        )
        setActiveCalls([...activeCallsRef.current])

        // Check if all calls ended without answer
        const allEnded = activeCallsRef.current.every(c => c.status === 'ended' || c.status === 'failed')
        if (allEnded && !hasAnsweredRef.current && isDialing && !isPaused) {
          // No one answered, move to next batch
          console.log('[PowerDialer] No one answered, moving to next batch')
          const batchSize = Math.min(maxLines, contacts.length - currentIndex)
          setCurrentIndex(prev => prev + batchSize)
          setTimeout(() => placeMultipleCalls(), 1000)
        }
      }
    }

    rtcClient.on('callUpdate', handleCallUpdate)

    return () => {
      rtcClient.off('callUpdate', handleCallUpdate)
    }
  }, [handleCallAnswered, isDialing, isPaused, maxLines, contacts.length, currentIndex, placeMultipleCalls])

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
  // FOCUSED CALL VIEW - Full screen when someone answers
  // =====================================================
  if (showFocusedCall && answeredCall) {
    const contact = answeredCall.contact
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header with minimal controls */}
        <div className="flex items-center justify-between p-4 border-b bg-green-600 text-white">
          <div className="flex items-center gap-4">
            <Badge className="bg-white text-green-600 animate-pulse">● CONNECTED</Badge>
            <span className="text-lg font-bold">
              {contact.firstName} {contact.lastName}
            </span>
            <span className="text-green-100">
              {formatPhoneNumberForDisplay(contact.phone)}
            </span>
          </div>
          <Button variant="destructive" size="sm" onClick={() => {
            rtcClient.hangup().catch(console.error)
          }}>
            <PhoneOff className="h-4 w-4 mr-2" />
            End Call
          </Button>
        </div>

        {/* Main content - Contact + Script + Dispositions */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Contact Details */}
          <div className="w-80 border-r p-4 bg-muted/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <User className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{contact.firstName} {contact.lastName}</h2>
                <p className="text-muted-foreground">{formatPhoneNumberForDisplay(contact.phone)}</p>
              </div>
            </div>

            {contact.llcName && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground">Company</div>
                <div className="font-medium">{contact.llcName}</div>
              </div>
            )}
            {contact.propertyAddress && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground">Property</div>
                <div className="font-medium">{contact.propertyAddress}</div>
              </div>
            )}
            {contact.phone2 && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground">Alt Phone</div>
                <div className="font-medium">{formatPhoneNumberForDisplay(contact.phone2)}</div>
              </div>
            )}
          </div>

          {/* Center: Script */}
          <div className="flex-1 p-6 overflow-auto">
            {script ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">{script.name}</h3>
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <div
                    className="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: script.content
                        .replace(/\{\{firstName\}\}/gi, contact.firstName || '')
                        .replace(/\{\{lastName\}\}/gi, contact.lastName || '')
                        .replace(/\{\{phone\}\}/gi, contact.phone || '')
                        .replace(/\{\{llcName\}\}/gi, contact.llcName || '')
                        .replace(/\{\{propertyAddress\}\}/gi, contact.propertyAddress || '')
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No script assigned to this list</p>
              </div>
            )}
          </div>

          {/* Right: Dispositions */}
          <div className="w-80 border-l p-4">
            <h3 className="text-lg font-semibold mb-4">Call Disposition</h3>
            <div className="space-y-2 mb-4">
              {dispositions.map(d => (
                <Button
                  key={d.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleDisposition(d.id)}
                  style={{ borderColor: d.color }}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: d.color }}
                  />
                  <span style={{ color: d.color }}>{d.name}</span>
                </Button>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={dispositionNotes}
                onChange={(e) => setDispositionNotes(e.target.value)}
                placeholder="Add call notes..."
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =====================================================
  // MAIN DIALER VIEW - Settings and queue management
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

              {/* Skip Button */}
              <Button
                onClick={handleSkip}
                variant="outline"
                className="w-full"
                disabled={activeCalls.length === 0 && !isDialing}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip Batch
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

        {/* Center: Active Calls */}
        <Card className="flex-1">
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
                            {ac.contact.firstName} {ac.contact.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatPhoneNumberForDisplay(ac.contact.phone)}
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

