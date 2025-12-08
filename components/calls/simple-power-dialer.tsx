'use client'

/**
 * Simple Power Dialer - Uses browser WebRTC for outbound calls
 * 
 * This is a simpler approach that:
 * 1. Loads contacts from a list
 * 2. Uses browser WebRTC to place calls (same as manual dialing)
 * 3. Shows call popup when connected (with script + dispositions)
 * 4. Auto-advances to next contact after disposition
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Phone, PhoneOff, Play, Pause, Square, ArrowLeft, User, Loader2, SkipForward, Check, X } from 'lucide-react'
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
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('')
  const [script, setScript] = useState<CallScript | null>(null)
  const [dispositions, setDispositions] = useState<CallDisposition[]>([])
  const [isDialing, setIsDialing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [callActive, setCallActive] = useState(false)
  
  // Track if we're in an active call to prevent auto-advancing
  const callActiveRef = useRef(false)
  
  // Current contact
  const currentContact = contacts[currentIndex] || null
  
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
          setSelectedPhoneId(numbers[0].id)
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
        console.error('[SimplePowerDialer] Error loading data:', error)
        toast.error('Failed to load dialer data')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [listId, scriptId])

  // Get selected phone number
  const selectedPhone = phoneNumbers.find(p => p.id === selectedPhoneId)
  
  // Place call to current contact
  const placeCall = useCallback(async () => {
    if (!currentContact || !selectedPhone || callActiveRef.current) return
    
    console.log('[SimplePowerDialer] Placing call to:', currentContact.firstName, currentContact.phone)
    
    try {
      await rtcClient.ensureRegistered()
      const { sessionId } = await rtcClient.startCall({
        toNumber: currentContact.phone,
        fromNumber: selectedPhone.phoneNumber
      })
      
      callActiveRef.current = true
      setCallActive(true)
      
      // Log the call
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          contactId: currentContact.id,
          fromNumber: selectedPhone.phoneNumber,
          toNumber: currentContact.phone,
        })
      }).catch(err => console.error('Failed to log call:', err))

      // Open call popup with power dialer context
      openCall({
        contact: {
          id: currentContact.id,
          firstName: currentContact.firstName,
          lastName: currentContact.lastName
        },
        fromNumber: selectedPhone.phoneNumber,
        toNumber: currentContact.phone,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
        powerDialer: {
          enabled: true,
          listId,
          script: script || undefined,
          onNextContact: handleNextContact,
          onDisposition: handleDisposition
        }
      })

    } catch (error: any) {
      console.error('[SimplePowerDialer] Call failed:', error)
      toast.error(error.message || 'Failed to place call')
      callActiveRef.current = false
      setCallActive(false)
    }
  }, [currentContact, selectedPhone, script, listId, openCall])

  // Handle disposition selection
  const handleDisposition = useCallback(async (dispositionId: string, notes?: string) => {
    if (!currentContact) return

    try {
      const res = await fetch('/api/dialer/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: currentContact.id,
          dispositionId,
          notes,
          listId,
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save disposition')
      }

      toast.success('Disposition saved')

      // Move to next contact
      handleNextContact()

    } catch (error) {
      console.error('[SimplePowerDialer] Disposition error:', error)
      toast.error('Failed to save disposition')
    }
  }, [currentContact, listId])

  // Move to next contact
  const handleNextContact = useCallback(() => {
    callActiveRef.current = false
    setCallActive(false)
    close() // Close call popup

    if (currentIndex < contacts.length - 1) {
      setCurrentIndex(prev => prev + 1)

      // Auto-dial if dialing is active and not paused
      if (isDialing && !isPaused) {
        setTimeout(() => placeCall(), 1000) // Small delay before next call
      }
    } else {
      // End of list
      setIsDialing(false)
      toast.success('Dialer complete - all contacts called!')
    }
  }, [currentIndex, contacts.length, isDialing, isPaused, close, placeCall])

  // Skip current contact
  const handleSkip = useCallback(() => {
    if (callActive) {
      rtcClient.hangup().catch(console.error)
    }
    handleNextContact()
  }, [callActive, handleNextContact])

  // Start dialing
  const handleStart = useCallback(() => {
    if (!selectedPhone) {
      toast.error('Please select a phone number')
      return
    }
    if (contacts.length === 0) {
      toast.error('No contacts in queue')
      return
    }

    setIsDialing(true)
    setIsPaused(false)
    placeCall()
  }, [selectedPhone, contacts.length, placeCall])

  // Pause dialing
  const handlePause = useCallback(() => {
    setIsPaused(true)
  }, [])

  // Resume dialing
  const handleResume = useCallback(() => {
    setIsPaused(false)
    if (!callActive) {
      placeCall()
    }
  }, [callActive, placeCall])

  // Stop dialing
  const handleStop = useCallback(() => {
    setIsDialing(false)
    setIsPaused(false)
    if (callActive) {
      rtcClient.hangup().catch(console.error)
    }
    close()
  }, [callActive, close])

  // Listen for call end events
  useEffect(() => {
    const handleCallEnd = () => {
      console.log('[SimplePowerDialer] Call ended')
      // Don't auto-advance - wait for disposition
    }

    rtcClient.on('callEnded', handleCallEnd)
    return () => {
      rtcClient.off('callEnded', handleCallEnd)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
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

        {/* Status Badge */}
        {isDialing && !isPaused && (
          <Badge className="bg-green-600 animate-pulse">● DIALING</Badge>
        )}
        {isPaused && (
          <Badge className="bg-yellow-500">⏸ PAUSED</Badge>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: Controls */}
        <Card className="w-80 flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dialer Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone Number Selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Caller ID</label>
              <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId} disabled={isDialing}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select phone number" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {formatPhoneNumberForDisplay(p.phoneNumber)}
                      {p.friendlyName && ` - ${p.friendlyName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-col gap-2">
              {!isDialing ? (
                <Button onClick={handleStart} className="w-full bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-2" />
                  Start Dialing
                </Button>
              ) : (
                <>
                  {!isPaused ? (
                    <Button onClick={handlePause} variant="outline" className="w-full">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={handleResume} className="w-full bg-green-600 hover:bg-green-700">
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button onClick={handleStop} variant="destructive" className="w-full">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Dialer
                  </Button>
                </>
              )}

              {/* Skip Button */}
              <Button onClick={handleSkip} variant="outline" className="w-full" disabled={!currentContact}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip Contact
              </Button>
            </div>

            {/* Progress */}
            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-2">Progress</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${((currentIndex + 1) / contacts.length) * 100}%` }}
                />
              </div>
              <div className="text-xs text-center mt-1 text-muted-foreground">
                {currentIndex + 1} / {contacts.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Center: Current Contact */}
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Current Contact</span>
              {callActive && (
                <Badge className="bg-green-600 animate-pulse">ON CALL</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentContact ? (
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {currentContact.firstName} {currentContact.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatPhoneNumberForDisplay(currentContact.phone)}
                      </p>
                    </div>
                  </div>
                  {currentContact.llcName && (
                    <p className="text-sm"><strong>Company:</strong> {currentContact.llcName}</p>
                  )}
                  {currentContact.propertyAddress && (
                    <p className="text-sm"><strong>Property:</strong> {currentContact.propertyAddress}</p>
                  )}
                </div>

                {/* Script */}
                {script && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Call Script: {script.name}</h4>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-h-64 overflow-y-auto">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: script.content
                            .replace(/\{\{firstName\}\}/gi, currentContact.firstName || '')
                            .replace(/\{\{lastName\}\}/gi, currentContact.lastName || '')
                            .replace(/\{\{phone\}\}/gi, currentContact.phone || '')
                            .replace(/\{\{llcName\}\}/gi, currentContact.llcName || '')
                            .replace(/\{\{propertyAddress\}\}/gi, currentContact.propertyAddress || '')
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Dispositions */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Quick Dispositions</h4>
                  <div className="flex flex-wrap gap-2">
                    {dispositions.map(d => (
                      <Button
                        key={d.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisposition(d.id)}
                        className="text-xs"
                        style={{ borderColor: d.color, color: d.color }}
                      >
                        {d.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No more contacts in queue</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Queue */}
        <Card className="w-72 flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Queue ({contacts.length - currentIndex - 1} remaining)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-2 space-y-1">
                {contacts.slice(currentIndex + 1, currentIndex + 21).map((contact, idx) => (
                  <div
                    key={contact.id}
                    className="p-2 rounded-md hover:bg-muted text-sm"
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

