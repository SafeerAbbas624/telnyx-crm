"use client"

import ContactName from "@/components/contacts/contact-name"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useCallUI } from "@/lib/context/call-ui-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useToast } from "@/hooks/use-toast"
import { Phone, PhoneCall, PhoneOff, Search, Clock, DollarSign, Play, Pause, Volume2, User, Plus } from "lucide-react"
import { getBestPhoneNumber, formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { useSession } from "next-auth/react"
import AssignContactModal from "@/components/admin/assign-contact-modal"
import SimpleAddActivityDialog from "@/components/activities/simple-add-activity-dialog"
import type { Contact } from "@/lib/types"
import { format } from "date-fns"

interface TelnyxCall {
  id: string
  telnyxCallId: string
  contactId: string
  fromNumber: string
  toNumber: string
  direction: 'inbound' | 'outbound'
  status: string
  duration: number
  cost: number
  recordingUrl?: string
  answeredAt?: string
  endedAt?: string
  hangupCause?: string
  createdAt: string
}

interface TelnyxPhoneNumber {
  id: string
  number: string
  state?: string
  is_active: boolean
  capabilities: string[]
  usage_count?: number
}

export default function TeamCallsCenter() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { openCall } = useCallUI()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [assignedContacts, setAssignedContacts] = useState<Contact[]>([])
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsHasMore, setContactsHasMore] = useState(true)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  // Caches for resolved contacts (by id and by last-10 digits)
  const [callContactMap, setCallContactMap] = useState<Record<string, Contact>>({})
  const [callNumberMap, setCallNumberMap] = useState<Record<string, Contact>>({})

  // Resolve a contact for a given call (priority: fetched-by-id -> assigned list -> fetched-by-number -> assigned list by number)
  const findContactForDialpadCall = React.useCallback((call: TelnyxCall) => {
    try {
      if (!call) return null
      const cid = (call as any).contactId as string | undefined
      if (cid) {
        const fetched = callContactMap[cid]
        if (fetched) return fetched
        const fromAssigned = assignedContacts.find(c => c.id === cid)
        if (fromAssigned) return fromAssigned
      }
      const counterparty = call.direction === 'outbound' ? call.toNumber : call.fromNumber
      const last10 = (counterparty || '').replace(/\D/g, '').slice(-10)
      if (!last10) return null
      const byNum = callNumberMap[last10]
      if (byNum) return byNum
      return assignedContacts.find(c => [c.phone1, c.phone2, c.phone3].some(p => (p || '').replace(/\D/g, '').endsWith(last10))) || null
    } catch { return null }
  }, [assignedContacts, callContactMap, callNumberMap])

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [recentCalls, setRecentCalls] = useState<TelnyxCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialing, setIsDialing] = useState(false)
  const [activeCall, setActiveCall] = useState<TelnyxCall | null>(null)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Paged calls for selected contact (infinite scroll)
  const [selectedCalls, setSelectedCalls] = useState<TelnyxCall[]>([])
  const [callsOffset, setCallsOffset] = useState(0)
  const [callsHasMore, setCallsHasMore] = useState(true)
  const [isLoadingMoreCalls, setIsLoadingMoreCalls] = useState(false)
  const CALLS_LIMIT = 100000
  const [activeTab, setActiveTab] = useState<'contacts' | 'dialpad'>('contacts')
  const [dialpadNumber, setDialpadNumber] = useState('')
  const [dialpadCalls, setDialpadCalls] = useState<TelnyxCall[]>([])
  const [isLoadingDialpadCalls, setIsLoadingDialpadCalls] = useState(false)

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    loadData()
  }, [])

  // Scroll handler for infinite scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop
      const scrollHeight = scrollContainer.scrollHeight
      const clientHeight = scrollContainer.clientHeight

      // Load more when scrolled near bottom (within 200px)
      if (scrollHeight - scrollTop - clientHeight < 200 && contactsHasMore && !isLoadingContacts && !searchQuery) {
        loadContacts(false)
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [contactsHasMore, isLoadingContacts, searchQuery, contactsPage])


  // Detect active calls and poll while active to keep UI in sync
  const hasActiveCall = recentCalls.some(c => ['initiated','ringing','answered','bridged'].includes(c.status))

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (hasActiveCall) {
      interval = setInterval(async () => {
        try {
          const resp = await fetch('/api/team/calls')
          if (resp.ok) {
            const data = await resp.json()
            setRecentCalls(data.calls || [])
          }
        } catch {}
      }, 3000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [hasActiveCall])

  // Live-refresh selected contact call list while a call is active and once after it ends
  useEffect(() => {
    if (!selectedContact) return
    let iv: NodeJS.Timeout | null = null
    const refresh = () => fetchSelectedCalls(true)
    // Initial fetch to catch any new records
    refresh()
    if (hasActiveCall) {
      iv = setInterval(refresh, 3000)
    }

    return () => { if (iv) clearInterval(iv) }
  }, [selectedContact?.id, hasActiveCall])


  // Close the activity dialog automatically once there is no active call
  // Load dialpad call logs (team: assigned number only)
  useEffect(() => {
    if (activeTab !== 'dialpad') return
    const number = selectedPhoneNumber?.number
    if (!number) { setDialpadCalls([]); return }
    let aborted = false
    const load = async () => {
      try {
        setIsLoadingDialpadCalls(true)
        const params = new URLSearchParams({ number, limit: '200' })
        const res = await fetch(`/api/calls/by-number?${params}`)
        if (!res.ok) { setDialpadCalls([]); return }


        const data = await res.json()
        if (!aborted) setDialpadCalls(data.calls || [])
      } finally {
        if (!aborted) setIsLoadingDialpadCalls(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [activeTab, selectedPhoneNumber?.number])

  useEffect(() => {
    if (!hasActiveCall && showActivityDialog) setShowActivityDialog(false)
  }, [hasActiveCall, showActivityDialog])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [phoneNumbersRes, callsRes] = await Promise.all([
        fetch('/api/team/assigned-phone-numbers'),
        fetch('/api/team/calls')
      ])

      if (phoneNumbersRes.ok) {
        const phoneNumbersData = await phoneNumbersRes.json()
        const phoneNumbers = phoneNumbersData.phoneNumbers || []
        setPhoneNumbers(phoneNumbers.filter((pn: TelnyxPhoneNumber) =>
          pn.capabilities.includes('voice') && pn.is_active
        ))
        if (phoneNumbers.length > 0) {
          setSelectedPhoneNumber(phoneNumbers[0])
        }
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json()
        setRecentCalls(callsData.calls || [])
      }

      // Load contacts separately with pagination
      await loadContacts(true)
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load calls data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadContacts = async (reset: boolean = false) => {
    if (isLoadingContacts) return

    try {
      setIsLoadingContacts(true)
      const page = reset ? 1 : contactsPage
      const limit = 100

      const contactsRes = await fetch(`/api/team/assigned-contacts?page=${page}&limit=${limit}`)

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        const newContacts = contactsData.contacts || []

        console.log(`Team assigned contacts loaded (page ${page}):`, newContacts.length)

        if (reset) {
          setAssignedContacts(newContacts)
          setContactsPage(1)
        } else {
          setAssignedContacts(prev => [...prev, ...newContacts])
        }

        // Check if there are more pages
        setContactsHasMore(contactsData.pagination?.hasMore || false)
        setContactsPage(page + 1)

        console.log('Pagination info:', {
          hasMore: contactsData.pagination?.hasMore,
          totalContacts: assignedContacts.length + newContacts.length,
          page
        })
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setIsLoadingContacts(false)
    }
  }

  // Fetch paged calls for the selected contact
  const fetchSelectedCalls = async (reset: boolean = false) => {
    if (!selectedContact) return
    try {
      setIsLoadingMoreCalls(true)
      const offset = reset ? 0 : callsOffset
      const params = new URLSearchParams({
        contactIds: selectedContact.id,
        limit: String(CALLS_LIMIT),
        offset: String(offset),
      })
      const res = await fetch(`/api/team/calls?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()


        const newCalls: TelnyxCall[] = data.calls || []
        const merged = reset ? newCalls : [...selectedCalls, ...newCalls]
        const uniqMap = new Map(merged.map((c) => [c.id, c]))
        const uniq = Array.from(uniqMap.values())
        setSelectedCalls(uniq)
        setCallsOffset(offset + newCalls.length)
        setCallsHasMore(newCalls.length === CALLS_LIMIT)
      }
    } catch (e) {
      console.error('Failed to fetch team calls page:', e)
    } finally {
      setIsLoadingMoreCalls(false)
    }
  }

  // Reset and load when contact changes
  useEffect(() => {
    if (!selectedContact) {
      setSelectedCalls([])
      setCallsOffset(0)
      setCallsHasMore(true)
      return
    }
    setSelectedCalls([])
    setCallsOffset(0)
    setCallsHasMore(true)
    fetchSelectedCalls(true)
  }, [selectedContact?.id])

  const filteredContacts = assignedContacts.filter((contact: Contact) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
    return (
      fullName.includes(searchLower) ||
      contact.phone1?.toLowerCase().includes(searchLower) ||
      contact.phone2?.toLowerCase().includes(searchLower) ||
      contact.phone3?.toLowerCase().includes(searchLower)
    )
  })

  const makeCall = async (contact: Contact) => {
    if (!selectedPhoneNumber) {
      toast({
        title: 'Error',
        description: 'Please select a phone number to call from',
        variant: 'destructive',
      })
      return
    }

    const phoneToCall = getBestPhoneNumber(contact)
    if (!phoneToCall) {
      toast({
        title: 'Error',
        description: 'Contact has no valid phone number',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsDialing(true)

      // Try WebRTC first (opens the same in-progress popup as admin)
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.ensureRegistered()
        const { sessionId } = await rtcClient.startCall({ toNumber: phoneToCall, fromNumber: selectedPhoneNumber.number })

        // Log the call to database
        fetch('/api/telnyx/webrtc-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webrtcSessionId: sessionId,
            contactId: contact.id,
            fromNumber: selectedPhoneNumber.number,
            toNumber: phoneToCall,
          })
        }).catch(err => console.error('Failed to log call:', err))

        toast({ title: 'Calling (WebRTC)', description: `${contact.firstName} ${contact.lastName} at ${formatPhoneNumberForDisplay(phoneToCall)}` })
        openCall({
          contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
          fromNumber: selectedPhoneNumber.number,
          toNumber: phoneToCall,


          mode: 'webrtc',
          webrtcSessionId: sessionId,
        })
        return
      } catch (webrtcErr) {
        console.warn('WebRTC call failed, falling back to Call Control:', webrtcErr)
      }

      // Fallback: Call Control API
      const response = await fetch('/api/telnyx/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromNumber: selectedPhoneNumber.number,
          toNumber: phoneToCall,
          contactId: contact.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initiate call')
      }

      const callData = await response.json()
      toast({
        title: 'Call Initiated',
        description: `Calling ${contact.firstName} ${contact.lastName} at ${formatPhoneNumberForDisplay(phoneToCall)}`,
      })

      // Open the shared call UI popup in Call Control mode
      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber: selectedPhoneNumber.number,
        toNumber: phoneToCall,
        mode: 'call_control',
        telnyxCallId: callData.telnyxCallId,
      })

      // Refresh calls list
      loadData()
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to make call',
        variant: 'destructive',
      })
    } finally {
      setIsDialing(false)
    }
  }

  const handleActivityAdded = () => {
    // Refresh calls to show updated activity
    loadData()
    toast({
      title: 'Success',
      description: 'Activity added successfully',
    })
  }


  // Fetch missing contacts by id for dialpad calls so we can display names
  useEffect(() => {
    const ids = Array.from(new Set(
      dialpadCalls.map(c => (c as any).contactId).filter(Boolean)
    )) as string[]
    const missing = ids.filter(id => !callContactMap[id])
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries: Record<string, Contact> = {}
      await Promise.all(missing.map(async (id) => {
        try {
          const r = await fetch(`/api/contacts/${id}`)
          if (r.ok) {
            const data = await r.json()
            entries[id] = data
          }
        } catch {}
      }))
      if (!cancelled && Object.keys(entries).length) {
        setCallContactMap(prev => ({ ...prev, ...entries }))
      }
    })()
    return () => { cancelled = true }
  }, [dialpadCalls, callContactMap])

  // When calls lack contactId and we cannot resolve from the assigned list,
  // look up contacts by phone last10 across the DB and cache them by last10
  useEffect(() => {
    if (!dialpadCalls || dialpadCalls.length === 0) return
    const needed = new Set<string>()
    for (const call of dialpadCalls) {
      const cid = (call as any).contactId as string | undefined
      if (cid && (callContactMap[cid] || assignedContacts.some(c => c.id === cid))) continue
      const counterparty = call.direction === 'outbound' ? call.toNumber : call.fromNumber
      const last10 = (counterparty || '').replace(/\D/g, '').slice(-10)
      if (!last10) continue
      const hasInAssigned = assignedContacts.some(c => [c.phone1, c.phone2, c.phone3].some(p => (p || '').replace(/\D/g, '').endsWith(last10)))
      if (callNumberMap[last10] || hasInAssigned) continue
      needed.add(last10)
    }
    const arr = Array.from(needed)
    if (arr.length === 0) return
    let cancelled = false
    ;(async () => {
      const updates: Record<string, Contact> = {}
      await Promise.all(arr.map(async (last10) => {
        try {
          const r = await fetch(`/api/contacts/lookup-by-number?last10=${last10}`)
          if (!r.ok) return
          const contact = await r.json()
          if (contact && contact.id) updates[last10] = contact
        } catch {}
      }))
      if (!cancelled && Object.keys(updates).length) {
        setCallNumberMap(prev => ({ ...prev, ...updates }))
      }
    })()
    return () => { cancelled = true }
  }, [dialpadCalls, assignedContacts, callContactMap, callNumberMap])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
      case 'bridged':
        return 'bg-green-100 text-green-800'
      case 'ringing':
      case 'initiated':
        return 'bg-blue-100 text-blue-800'
      case 'hangup':
        return 'bg-gray-100 text-gray-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  const hangupActiveCall = async () => {
    try {
      const latest = recentCalls.find(c => c.status === 'initiated' || c.status === 'ringing' || c.status === 'answered' || c.status === 'bridged')
      if (!latest) {
        toast({ title: 'No active call', description: 'There is no active call to hang up.' })
        return
      }
      const res = await fetch('/api/telnyx/calls/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telnyxCallId: latest.telnyxCallId })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to hang up call')
      }
      toast({ title: 'Call ended' })
      await loadData()
    } catch (e) {
      console.error('Hangup error:', e)
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to end call', variant: 'destructive' })
    }
  }


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }


	  // Derive duration if missing using timestamps
	  const computeDuration = (call: CallRecord) => {
	    if (typeof call.duration === 'number' && call.duration > 0) return call.duration
	    const answered = call.answeredAt ? new Date(call.answeredAt).getTime() : null
	    const ended = call.endedAt ? new Date(call.endedAt).getTime() : null
	    if (answered && ended && ended >= answered) return Math.round((ended - answered) / 1000)
	    const created = (call as any).createdAt ? new Date((call as any).createdAt).getTime() : null
	    if (created && ended && ended >= created) return Math.round((ended - created) / 1000)
	    return 0
	  }

  const getContactById = (contactId: string) => {
    return assignedContacts.find(c => c.id === contactId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">



      {/* Tabs control */}
      <div className="px-4 py-2 border-b sticky top-0 z-10 bg-background">
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="dialpad">Dialpad</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => setActiveTab('dialpad')}>
            <Phone className="h-4 w-4 mr-2" /> Dialpad
          </Button>
        </div>
      </div>


      <div className="flex-1 flex">
        {/* Contacts List */}
        <div className="w-1/3 border-r" style={{ display: activeTab === 'dialpad' ? 'none' : undefined }}>
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(true); setTimeout(() => setIsSearching(false), 200) }}
                className="pl-10"
              />
              {isSearching && (<div className="text-xs text-muted-foreground mt-1">Searching...</div>)}
            </div>

            <div
              ref={scrollContainerRef}
              className="h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden"
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="space-y-2 pb-40">
                {filteredContacts.map((contact) => (
                  <Card
                    key={contact.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedContact?.id === contact.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {(contact.firstName?.[0] || '?')}{(contact.lastName?.[0] || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              <ContactName contact={contact} className="!no-underline" />
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPhoneNumberForDisplay(getBestPhoneNumber(contact)) || 'No phone'}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            makeCall(contact)
                          }}
                          disabled={isDialing || !selectedPhoneNumber}
                        >
                          <PhoneCall className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Loading indicator */}
                {isLoadingContacts && (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                  </div>
                )}

                {/* End of list indicator */}
                {!contactsHasMore && assignedContacts.length > 0 && !searchQuery && (
                  <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-md">
                    All contacts loaded ({assignedContacts.length})
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Call Details & Recent Calls */}
        <div className="w-2/3 p-4" style={{ display: activeTab === 'dialpad' ? 'none' : undefined }}>
          {selectedContact ? (
            <div className="space-y-6">
              {/* Selected Contact Call Interface */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {selectedContact.firstName[0]}{selectedContact.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          <ContactName contact={selectedContact} className="!no-underline" />
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumberForDisplay(getBestPhoneNumber(selectedContact))}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <AssignContactModal
                          contact={selectedContact}
                          onAssignmentComplete={() => {
                            toast({
                              title: "Success",
                              description: "Contact assigned successfully",
                            })
                          }}
                          buttonVariant="outline"
                          buttonSize="default"
                          buttonText=""
                          trigger={
                            <Button variant="outline" size="default" title="Assign Contact to Team">
                              <User className="h-4 w-4" />
                            </Button>
                          }
                        />
                      )}
                      <Button
                        type="button"
                        onClick={() => makeCall(selectedContact)}
                        disabled={isDialing || !selectedPhoneNumber}
                        className="flex items-center gap-2"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {isDialing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Dialing...
                          </>
                        ) : (
                          <>
                            <PhoneCall className="h-4 w-4" />
                            Call Now
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={hangupActiveCall}
                        variant="destructive"
                        className="flex items-center gap-2"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <PhoneOff className="h-4 w-4" />
                        Hang Up
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setShowActivityDialog(true)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Activity
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Property:</span>
                      <p className="text-muted-foreground">{selectedContact.propertyAddress || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Property Type:</span>
                      <p className="text-muted-foreground">{selectedContact.propertyType || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Calls for Selected Contact */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Calls</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const calls = selectedCalls
                    const last = calls[0]
                    if (!last) return null
                    return (
                      <div className="mb-3 text-xs text-muted-foreground">
                        Last call: {format(new Date(last.createdAt), 'MMM d, yyyy h:mm a')} • {formatDuration(computeDuration(last as any))} • {last.direction === 'outbound' ? 'From' : 'To'} {formatPhoneNumberForDisplay(last.fromNumber)} -> {formatPhoneNumberForDisplay(last.toNumber)} {last.hangupCause ? `• ${last.hangupCause}` : ''}
                      </div>
                    )
                  })()}
                  {false && (<ScrollArea className="h-64">
                    <div className="space-y-2">
                      {recentCalls
                        .filter((call: any) => {
                          if (!selectedContact) return false
                          if ((call as any).contactId && (call as any).contactId === selectedContact.id) return true
                          if ((call as any).contact && (call as any).contact.id === selectedContact.id) return true
                          const nums = [selectedContact.phone1, selectedContact.phone2, selectedContact.phone3].filter(Boolean)
                          return nums.includes((call as any).toNumber) || nums.includes((call as any).fromNumber)
                        })
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 10)
                        .map((call) => (
                          <div key={call.id} className="flex items-center justify-between p-3 border rounded-md">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${call.direction === 'outbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                                {call.direction === 'outbound' ? (
                                  <PhoneCall className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Phone className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {call.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(call.createdAt), 'MMM d, yyyy h:mm a')}
                                </p>
                                <p className="hidden">
                                  {formatPhoneNumberForDisplay(call.fromNumber)}   {formatPhoneNumberForDisplay(call.toNumber)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatPhoneNumberForDisplay(call.fromNumber)} -> {formatPhoneNumberForDisplay(call.toNumber)}
                                </p>

                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={getStatusColor(call.status)}>
                                {call.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {formatDuration(computeDuration(call as any))}
                              </p>
                              {call.cost && (
                                <p className="text-xs text-muted-foreground">
                                  <DollarSign className="h-3 w-3 inline mr-1" />
                                  ${call.cost.toFixed(4)}
                                </p>
                              )}
                              {call.recordingUrl && (
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 mt-1">
                                  <Play className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                  )}

                  {isLoadingMoreCalls && selectedCalls.length === 0 && (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse p-3 border rounded-md">
                          <div className="h-3 bg-muted rounded w-1/3 mb-2" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className="h-64 overflow-auto"
                    onScroll={(e) => {
                      const el = e.currentTarget
                      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24 && callsHasMore && !isLoadingMoreCalls) {
                        fetchSelectedCalls(false)
                      }
                    }}
                  >
                    <div className="space-y-2">
                      {selectedCalls.map((call) => (
                        <div key={call.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${call.direction === 'outbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                              {call.direction === 'outbound' ? (
                                <PhoneCall className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Phone className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {call.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(call.createdAt), 'MMM d, yyyy h:mm a')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPhoneNumberForDisplay(call.fromNumber)} -> {formatPhoneNumberForDisplay(call.toNumber)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(call.status)}>
                              {call.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDuration(computeDuration(call as any))}
                            </p>
                            {call.cost && (
                              <p className="text-xs text-muted-foreground">
                                <DollarSign className="h-3 w-3 inline mr-1" />
                                ${call.cost.toFixed(4)}
                              </p>
                            )}
                            {call.recordingUrl && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 mt-1">
                                <Play className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      {isLoadingMoreCalls && selectedCalls.length > 0 && (
                        <div className="py-2 text-xs text-muted-foreground text-center">Loading more…</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <PhoneCall className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a contact to start calling</p>
              </div>
            </div>
          )}
        </div>

      {activeTab === 'dialpad' && (
        <div className="flex-1 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: Keypad */}
            <div className="w-full md:w-1/3">
              <Card>
                <CardHeader>
                  <CardTitle>Dialpad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-sm">
                    <Input placeholder="Enter number" value={dialpadNumber} onChange={(e) => setDialpadNumber(e.target.value)} className="mb-3" />
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {["1","2","3","4","5","6","7","8","9","*","0","#"].map((d) => (
                        <Button key={d} variant="outline" onClick={() => setDialpadNumber((n) => n + d)}>{d}</Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={!selectedPhoneNumber || !dialpadNumber} onClick={async () => {
                        try {
                          const { formatPhoneNumberForTelnyx } = await import("@/lib/phone-utils")
                          const toNumber = formatPhoneNumberForTelnyx(dialpadNumber) as any
                          if (!toNumber) { throw new Error('Enter a valid phone number') }

                          // Try to resolve contact by the typed number (last-10). Use assigned list first, then DB lookup.
                          let resolvedContact: any = null
                          try {
                            const digits = (dialpadNumber || '').replace(/\D/g, '')
                            const last10 = digits.slice(-10)
                            if (last10) {
                              const fromAssigned = assignedContacts.find(c => [c.phone1, c.phone2, c.phone3].some(p => (p || '').replace(/\D/g, '').endsWith(last10)))
                              if (fromAssigned) {
                                resolvedContact = fromAssigned
                              } else {
                                const r = await fetch(`/api/contacts/lookup-by-number?last10=${last10}`)
                                if (r.ok) { resolvedContact = await r.json() }
                              }
                            }
                          } catch {}

                          // Try WebRTC first
                          try {
                            const { rtcClient } = await import('@/lib/webrtc/rtc-client')
                            await rtcClient.ensureRegistered()
                            const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber: selectedPhoneNumber!.number })

                            // Log the call to database
                            fetch('/api/telnyx/webrtc-calls', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                webrtcSessionId: sessionId,
                                contactId: resolvedContact?.id || null,
                                fromNumber: selectedPhoneNumber!.number,
                                toNumber,
                              })
                            }).catch(err => console.error('Failed to log call:', err))

                            toast({ title: 'Calling (WebRTC)', description: toNumber })
                            openCall({
                              fromNumber: selectedPhoneNumber!.number,
                              toNumber,
                              mode: 'webrtc',
                              webrtcSessionId: sessionId,
                              ...(resolvedContact ? { contact: { id: resolvedContact.id, firstName: resolvedContact.firstName, lastName: resolvedContact.lastName } } : {})
                            })
                          } catch {
                            const resp = await fetch('/api/telnyx/calls', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fromNumber: selectedPhoneNumber!.number, toNumber, contactId: resolvedContact?.id || null })
                            })
                            if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.error || 'Failed to initiate call') }
                            const data = await resp.json()
                            toast({ title: 'Call Initiated', description: toNumber })
                            openCall({
                              fromNumber: selectedPhoneNumber!.number,
                              toNumber,
                              mode: 'call_control',
                              telnyxCallId: data.telnyxCallId,
                              ...(resolvedContact ? { contact: { id: resolvedContact.id, firstName: resolvedContact.firstName, lastName: resolvedContact.lastName } } : {})
                            })
                          }
                        } catch (err: any) {
                          toast({ title: 'Error', description: err?.message || 'Failed to call', variant: 'destructive' })
                        }
                      }}>
                        <PhoneCall className="h-4 w-4 mr-2" /> Call
                      </Button>
                      <Button variant="secondary" onClick={() => setDialpadNumber(dialpadNumber.slice(0,-1))}>Backspace</Button>
                      <Button variant="ghost" onClick={() => setDialpadNumber('')}>Clear</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Call Logs */}
            <div className="w-full md:flex-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Call Logs (Your Number)</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingDialpadCalls && dialpadCalls.length === 0 ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse p-3 border rounded-md">
                          <div className="h-3 bg-muted rounded w-1/3 mb-2" />
                          <div className="h-3 bg-muted rounded w-1/4" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dialpadCalls.map((call) => (
                        <div key={call.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${call.direction === 'outbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                              {call.direction === 'outbound' ? (
                                <PhoneCall className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Phone className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div>
                              {/* Name (top) */}
                              <p className="text-sm font-semibold">
                                {(() => {
                                  const c = findContactForDialpadCall(call)
                                  if (c) return <ContactName contact={c} className="!no-underline" />
                                  if ((call as any).contactId) return <ContactName contactId={(call as any).contactId} className="!no-underline" />
                                  return <>Unknown contact</>
                                })()}
                              </p>
                              {/* Contact number (counterparty) */}
                              <p className="text-xs text-muted-foreground">
                                {formatPhoneNumberForDisplay(call.direction === 'outbound' ? call.toNumber : call.fromNumber)}
                              </p>
                              {/* Time */}
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(call.createdAt), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(call.status)}>
                              {call.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDuration(computeDuration(call))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {dialpadCalls.length === 0 && !isLoadingDialpadCalls && (
                        <div className="text-xs text-muted-foreground">No calls found for your number.</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Add Activity Dialog */}
      {selectedContact && (
        <SimpleAddActivityDialog
          open={showActivityDialog}
          onOpenChange={setShowActivityDialog}
          contactId={selectedContact.id}
          contactName={`${selectedContact.firstName} ${selectedContact.lastName}`}
          onActivityAdded={handleActivityAdded}
        />
      )}
    </div>
  )
}
