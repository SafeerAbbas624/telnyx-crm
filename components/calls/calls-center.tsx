"use client"

import ContactName from "@/components/contacts/contact-name"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Phone, PhoneCall, PhoneOff, Search, Clock, DollarSign, Play, Pause, Volume2, User } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"
import { getBestPhoneNumber, formatPhoneNumberForDisplay, formatPhoneNumberForTelnyx } from "@/lib/phone-utils"
import { useSession } from "next-auth/react"
import AssignContactModal from "@/components/admin/assign-contact-modal"
import { useCallUI } from "@/lib/context/call-ui-context"
import type { Contact } from "@/lib/types"
import { format } from "date-fns"

import AdvancedContactFilter from "@/components/text/advanced-contact-filter"

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
  phoneNumber: string
  state?: string
  isActive: boolean
  capabilities: string[]
  totalCallCount: number
  totalSmsCount: number
}

export default function CallsCenter() {
  const { currentQuery, currentFilters } = useContacts()

  const { data: session } = useSession()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const contactsCacheRef = useRef<Map<string, any>>(new Map())
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  // Server-side contacts pagination
  const [contactsResults, setContactsResults] = useState<Contact[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<number>(() => {
    if (typeof window === 'undefined') return 25
    const saved = localStorage.getItem('callsContactsPageSize')
    return saved ? parseInt(saved) : 25
  })
  const [totalPages, setTotalPages] = useState(1)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  useEffect(() => { try { localStorage.setItem('callsContactsPageSize', String(limit)) } catch {} }, [limit])

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [recentCalls, setRecentCalls] = useState<TelnyxCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialing, setIsDialing] = useState(false)
  const [activeCall, setActiveCall] = useState<TelnyxCall | null>(null)
  const [isHangingUp, setIsHangingUp] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const { openCall } = useCallUI()

  // Calls pagination for selected contact (infinite scroll)
  const [selectedCalls, setSelectedCalls] = useState<TelnyxCall[]>([])
  const [callsOffset, setCallsOffset] = useState(0)
  const [callsHasMore, setCallsHasMore] = useState(true)
  const [isLoadingMoreCalls, setIsLoadingMoreCalls] = useState(false)
  const CALLS_LIMIT = 100000

  const ACTIVE_STATUSES = new Set(['initiated','ringing','answered','bridged'])

	  // Progressive local filtering for perceived "live" search on the contacts list
	  const displayContacts = React.useMemo(() => {
	    const q = searchQuery.trim().toLowerCase()
	    if (!q) return contactsResults
	    return contactsResults.filter((c: any) => {
	      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
	      return (
	        name.includes(q) ||
	        (c.phone1 || '').toLowerCase().includes(q) ||
	        (c.propertyAddress || '').toLowerCase().includes(q)
	      )


	    })
	  }, [contactsResults, searchQuery])
  const [activeTab, setActiveTab] = useState<'contacts' | 'dialpad'>('contacts')
  const [dialpadNumber, setDialpadNumber] = useState('')
  const [dialpadCalls, setDialpadCalls] = useState<TelnyxCall[]>([])
  const [isLoadingDialpadCalls, setIsLoadingDialpadCalls] = useState(false)
  // Cache for contacts fetched by id for dialpad logs
  const [callContactMap, setCallContactMap] = useState<Record<string, Contact | undefined>>({})
  // Cache for contacts looked up by phone last10 for dialpad logs
  const [callNumberMap, setCallNumberMap] = useState<Record<string, Contact | undefined>>({})

  // Resolve a contact for a given call (prefer fetched-by-id; else context list; else number match)
  const findContactForDialpadCall = React.useCallback((call: TelnyxCall) => {
    try {
      if (!call) return null
      const cid = (call as any).contactId as string | undefined
      if (cid) {
        const fetched = callContactMap[cid]
        if (fetched) return fetched
        const fromList = contactsResults.find(c => c.id === cid)
        if (fromList) return fromList
      }
      const counterparty = call.direction === 'outbound' ? call.toNumber : call.fromNumber
      const last10 = (counterparty || '').replace(/\D/g, '').slice(-10)
      if (!last10) return null
      // Try number-based cache first (DB lookup)
      const byNum = callNumberMap[last10]
      if (byNum) return byNum
      // Fallback to in-memory contacts list
      return contactsResults.find(c => [c.phone1, c.phone2, c.phone3].some(p => (p || '').replace(/\D/g, '').endsWith(last10))) || null
    } catch { return null }
  }, [contactsResults, callContactMap, callNumberMap])

  useEffect(() => {
    loadData()
  }, [])

  // Track if there is an active call and live-refresh while active
  const hasActiveCall = React.useMemo(() => recentCalls.some(c => ACTIVE_STATUSES.has(c.status)), [recentCalls])

  // While a call is active, poll backend to keep status fresh so banners/popups auto-hide
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (hasActiveCall) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/telnyx/calls')
          if (res.ok) {
            const data = await res.json()
            setRecentCalls(Array.isArray(data) ? data : (data.calls || []))
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
  useEffect(() => {
    if (!hasActiveCall && showActivityDialog) {
      setShowActivityDialog(false)
    }
  }, [hasActiveCall, showActivityDialog])
  // Load dialpad call logs (Admin):
  // - If a number is typed in the dialpad, show logs for that number
  // - Otherwise, show logs for the currently selected FROM number
  useEffect(() => {
    if (activeTab !== 'dialpad') return

    const typed = dialpadNumber?.trim()
    const fallbackFrom = selectedPhoneNumber?.phoneNumber || ''
    // Use the typed raw digits while user is typing; API handles partials via last-10/contains.
    const candidate = typed ? typed : fallbackFrom

    if (!candidate) { setDialpadCalls([]); return }

    let aborted = false
    const load = async () => {
      try {
        setIsLoadingDialpadCalls(true)
        const params = new URLSearchParams({ number: candidate, limit: '200' })
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
  }, [activeTab, dialpadNumber, selectedPhoneNumber?.phoneNumber])

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

  // When calls lack contactId and we cannot resolve from the current list,
  // look up contacts by phone last10 across the DB and cache them by last10
  useEffect(() => {
    if (!dialpadCalls || dialpadCalls.length === 0) return
    const needed = new Set<string>()
    for (const call of dialpadCalls) {
      const cid = (call as any).contactId as string | undefined
      if (cid && (callContactMap[cid] || contactsResults.some(c => c.id === cid))) continue
      const counterparty = call.direction === 'outbound' ? call.toNumber : call.fromNumber
      const last10 = (counterparty || '').replace(/\D/g, '').slice(-10)
      if (!last10) continue
      const hasInList = contactsResults.some(c => [c.phone1, c.phone2, c.phone3].some(p => (p || '').replace(/\D/g, '').endsWith(last10)))
      if (callNumberMap[last10] || hasInList) continue
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
  }, [dialpadCalls, contactsResults, callContactMap, callNumberMap])


  // Load calls for selected contact (initial + pagination)
  const fetchSelectedCalls = async (reset = false) => {
    if (!selectedContact) return
    try {
      setIsLoadingMoreCalls(true)
      const offset = reset ? 0 : callsOffset
      const params = new URLSearchParams({ contactId: selectedContact.id, limit: String(CALLS_LIMIT), offset: String(offset) })
      const res = await fetch(`/api/calls?${params}`)
      if (res.ok) {
        const data: TelnyxCall[] = await res.json()
        const merged = reset ? data : [...selectedCalls, ...data]
        // de-duplicate by id
        const uniqMap = new Map(merged.map(c => [c.id, c]))
        const uniq = Array.from(uniqMap.values())
        setSelectedCalls(uniq)
        setCallsOffset(offset + data.length)
        setCallsHasMore(data.length === CALLS_LIMIT)
      }
    } finally {
      setIsLoadingMoreCalls(false)
    }
  }

  useEffect(() => {
    // when changing selection, reset and load first page
    if (selectedContact) {
      setSelectedCalls([])
      setCallsOffset(0)
      setCallsHasMore(true)
      fetchSelectedCalls(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact?.id])

  // Debounce search to avoid spamming API
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 150)
    return () => clearTimeout(id)
  }, [searchQuery])

  // Fetch contacts from database with pagination + search/filters (DB-backed via /api/contacts)
  useEffect(() => {
    const controller = new AbortController()
    const fetchContacts = async () => {
      setIsSearching(true)
      setIsLoadingContacts(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) })
        const q = (currentQuery || '').trim()
        if (q) params.set('search', q)

        console.log('🔍 [CALLS CENTER] Fetching contacts with:', { currentQuery, currentFilters })

        // Apply filters - handle both array and string formats
        const entries = Object.entries(currentFilters || {})
        entries.forEach(([key, value]) => {
          if (value != null && value !== '') {
            // If it's already a comma-separated string, use it directly
            if (typeof value === 'string') {
              params.set(key, value)
            }
            // If it's an array, join with commas
            else if (Array.isArray(value) && value.length > 0) {
              params.set(key, value.join(','))
            }
          }
        })

        console.log('🔍 [CALLS CENTER] API params:', params.toString())

        const cacheKey = `p=${page}|l=${limit}|q=${q}|f=${params.toString()}`

        const cached = contactsCacheRef.current.get(cacheKey)
        if (cached) {
          console.log('🔍 [CALLS CENTER] Using cached results')
          setContactsResults(cached.results)
          setTotalPages(cached.totalPages)
        }

        const res = await fetch(`/api/contacts?${params}`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          const results = Array.isArray(data.contacts) ? data.contacts : []
          const total = data.pagination?.totalPages || 1
          console.log('🔍 [CALLS CENTER] Received', results.length, 'contacts')
          setContactsResults(results)
          setTotalPages(total)
          contactsCacheRef.current.set(cacheKey, { results, totalPages: total })
        } else {
          console.error('Failed to fetch contacts:', res.status, res.statusText)
          setContactsResults([])
          setTotalPages(1)
        }
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          console.error('Failed to load contacts for Calls Center:', err)
          setContactsResults([])
          setTotalPages(1)
        }
      } finally {
        setIsLoadingContacts(false)
        setIsSearching(false)
      }
    }
    fetchContacts()
    return () => controller.abort()
  }, [page, limit, currentQuery, currentFilters])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [phoneNumbersRes, callsRes] = await Promise.all([
        fetch('/api/telnyx/phone-numbers'),
        fetch('/api/telnyx/calls')
      ])

      if (phoneNumbersRes.ok) {
        const phoneNumbersData = await phoneNumbersRes.json()
        setPhoneNumbers(phoneNumbersData.filter((pn: TelnyxPhoneNumber) =>
          pn.capabilities.includes('VOICE') && pn.isActive
        ))
        if (phoneNumbersData.length > 0) {
          setSelectedPhoneNumber(phoneNumbersData[0])
        }
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json()
        setRecentCalls(callsData)
      }
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


  const makeCall = async (contact: Contact, toNumberOverride?: string) => {
    if (!selectedPhoneNumber) {
      toast({ title: 'Error', description: 'Please select a phone number to call from', variant: 'destructive' })
      return
    }

    const dialNumber = (toNumberOverride && toNumberOverride.trim()) || getBestPhoneNumber(contact)
    if (!dialNumber) {
      toast({ title: 'Error', description: 'Contact has no valid phone number', variant: 'destructive' })
      return
    }

    try {
      setIsDialing(true)

      // Try WebRTC first
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.ensureRegistered()
        const { sessionId } = await rtcClient.startCall({ toNumber: dialNumber, fromNumber: selectedPhoneNumber.phoneNumber })

        toast({ title: 'Calling (WebRTC)', description: `${contact.firstName} ${contact.lastName} at ${formatPhoneNumberForDisplay(dialNumber)}` })
        openCall({
          contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
          fromNumber: selectedPhoneNumber.phoneNumber,
          toNumber: dialNumber,
          mode: 'webrtc',
          webrtcSessionId: sessionId,
        })
        return
      } catch (webrtcErr) {
        console.warn('WebRTC call failed, falling back to Call Control:', webrtcErr)
      }

      // Fallback to existing Call Control dial
      const response = await fetch('/api/telnyx/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber: selectedPhoneNumber.phoneNumber,
          toNumber: dialNumber,
          contactId: contact.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initiate call')
      }
      const callData = await response.json()

      toast({ title: 'Call Initiated', description: `Calling ${contact.firstName} ${contact.lastName} at ${formatPhoneNumberForDisplay(dialNumber)}` })
      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber: selectedPhoneNumber.phoneNumber,
        toNumber: dialNumber,
        mode: 'call_control',
        telnyxCallId: callData.telnyxCallId,
      })

      loadData()
    } catch (error) {
      console.error('Error making call:', error)
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to make call', variant: 'destructive' })
    } finally {
      setIsDialing(false)
    }
  }

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

	  // Derive duration if missing using timestamps
	  const computeDuration = (call: TelnyxCall) => {
	    if (typeof call.duration === 'number' && call.duration > 0) return call.duration
	    const answered = call.answeredAt ? new Date(call.answeredAt).getTime() : null
	    const ended = call.endedAt ? new Date(call.endedAt).getTime() : null
	    if (answered && ended && ended >= answered) return Math.round((ended - answered) / 1000)
	    const created = call.createdAt ? new Date(call.createdAt).getTime() : null
	    if (created && ended && ended >= created) return Math.round((ended - created) / 1000)
	    return 0
	  }

  const hangupActiveCall = async () => {
    if (isHangingUp) return
    try {
      setIsHangingUp(true)
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
    } finally {
      setIsHangingUp(false)
    }
  }


  const getContactById = (contactId: string) => {
    return contacts.find(c => c.id === contactId)
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
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Calls Center</h2>


        {/* Phone Number Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Select Phone Number</label>
          <div className="flex gap-2 flex-wrap">
      {/* Tabs control */}
      <div className="px-4 py-2 border-b">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="dialpad">Dialpad</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

            {phoneNumbers.map((phoneNumber) => (
              <Button
                key={phoneNumber.id}
                variant={selectedPhoneNumber?.id === phoneNumber.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPhoneNumber(phoneNumber)}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {phoneNumber.phoneNumber}
                {phoneNumber.state && (
                  <span className="text-xs">({phoneNumber.state})</span>
                )}
              </Button>
            ))}
          </div>
          {phoneNumbers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No voice-enabled phone numbers found. Add phone numbers in the Text Center.
            </p>
          )}
        </div>
      </div>


      {activeTab !== 'dialpad' && (

      <div className="flex-1 flex">
        {/* Contacts List */}
        <div className="w-1/3 border-r" style={{ display: activeTab === 'dialpad' ? 'none' : undefined }}>
          <div className="p-4">
            <div className="mb-4">
              {/* Advanced Filters (DB-backed) */}
              <AdvancedContactFilter
                contacts={contactsResults as any}
                onFilteredContactsChange={() => { /* no-op: we fetch server-side below */ }}
                selectedContacts={[] as any}
                onSelectedContactsChange={() => { /* no-op for calls list */ }}
                showList={false}
                hideHeader
                hideSelectAllPagesButton
              />
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {isLoadingContacts && (
                  <div className="text-sm text-muted-foreground p-3">Loading contacts...</div>
                )}
                {!isLoadingContacts && displayContacts.map((contact) => (
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
                              {contact.firstName?.[0]}{contact.lastName?.[0]}
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
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault()
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
                {!isLoadingContacts && contactsResults.length === 0 && (
                  <div className="text-sm text-muted-foreground p-3">No contacts found</div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between p-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <select
                  className="text-sm border rounded px-2 py-1"
                  value={limit}
                  onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value)) }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || isLoadingContacts} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages || isLoadingContacts} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
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
                        <div className="flex gap-2 flex-wrap text-sm">
                          {([['phone1', selectedContact.phone1], ['phone2', selectedContact.phone2], ['phone3', selectedContact.phone3]] as const)
                            .filter(([, num]) => !!num)
                            .map(([key, num]) => (
                              <Button
                                key={key}
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.preventDefault(); makeCall(selectedContact, num as string) }}
                              >
                                <PhoneCall className="h-3 w-3 mr-1" /> {formatPhoneNumberForDisplay(num as string)}
                              </Button>
                            ))}
                        </div>
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
                            onClick={hangupActiveCall}
                            variant="destructive"
                            size="default"
                            disabled={isHangingUp}
                            className="flex items-center gap-2"
                          >
                            <PhoneOff className="h-4 w-4" />
                            {isHangingUp ? 'Ending...' : 'Hang Up'}
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
                        Last call: {format(new Date(last.createdAt), 'MMM d, yyyy h:mm a')} • {formatDuration(computeDuration(last))} • {last.direction === 'outbound' ? 'From' : 'To'} {formatPhoneNumberForDisplay(last.fromNumber)} -> {formatPhoneNumberForDisplay(last.toNumber)} {last.hangupCause ? `• ${last.hangupCause}` : ''}
                      </div>
                    )
                  })()}

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


                  {false && (<ScrollArea className="h-64">
                    <div
                      className="space-y-2"
                      onScroll={(e) => {
                        const container = (e.currentTarget.parentElement as HTMLElement) || null
                        if (!container) return
                        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 24 && callsHasMore && !isLoadingMoreCalls) {
                          fetchSelectedCalls(false)
                        }
                      }}
                    >
                      {selectedCalls
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
                                <p className="text-xs text-muted-foreground">
                                  {formatPhoneNumberForDisplay(call.fromNumber)}                   → {formatPhoneNumberForDisplay(call.toNumber)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={getStatusColor(call.status)}>
                                {call.status}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {formatDuration(computeDuration(call))}
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
                  </ScrollArea>)}
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
                              {/*
                              <p className="text-xs text-muted-foreground">
                                {formatPhoneNumberForDisplay(call.fromNumber)} 	 a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  a d  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  d a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a  a → {formatPhoneNumberForDisplay(call.toNumber)}
                              </p>
                              */}
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
                              {formatDuration(computeDuration(call))}
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
                  </div>
                </CardContent>

	                    {isLoadingMoreCalls && selectedCalls.length > 0 && (
	                      <div className="py-2 text-xs text-muted-foreground text-center">Loading more…</div>
	                    )}

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
      </div>


      )}

      {activeTab === 'dialpad' && (
        <div className="flex-1 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: Keypad */}
            <div className="w-full md:w-2/5">
              <Card>
                <CardHeader>
                  <CardTitle>Dialpad</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-md">
                    <Input placeholder="Enter number" value={dialpadNumber} onChange={(e) => setDialpadNumber(e.target.value)} className="mb-4 h-12 text-lg" />
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {["1","2","3","4","5","6","7","8","9","*","0","#"].map((d) => (
                        <Button key={d} variant="outline" className="h-14 text-lg" onClick={() => setDialpadNumber((n) => n + d)}>{d}</Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button className="h-12 text-lg" disabled={!selectedPhoneNumber || !dialpadNumber} onClick={async () => {
                        try {
                          const { formatPhoneNumberForTelnyx } = await import("@/lib/phone-utils")
                          const toNumber = formatPhoneNumberForTelnyx(dialpadNumber) as any
                          if (!toNumber) { throw new Error('Enter a valid phone number') }

                          // Try to resolve contact by the typed number (last-10). Use contacts list first, then DB lookup.
                          let resolvedContact: any = null
                          try {
                            const digits = (dialpadNumber || '').replace(/\D/g, '')
                            const last10 = digits.slice(-10)
                            if (last10) {
                              const fromList = contactsResults.find(c => [c.phone1, c.phone2, c.phone3].some(p => (p || '').replace(/\D/g, '').endsWith(last10)))
                              if (fromList) {
                                resolvedContact = fromList
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
                            const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber: selectedPhoneNumber!.phoneNumber })
                            toast({ title: 'Calling (WebRTC)', description: toNumber })
                            openCall({
                              fromNumber: selectedPhoneNumber!.phoneNumber,
                              toNumber,
                              mode: 'webrtc',
                              webrtcSessionId: sessionId,
                              ...(resolvedContact ? { contact: { id: resolvedContact.id, firstName: resolvedContact.firstName, lastName: resolvedContact.lastName } } : {})
                            })
                          } catch {
                            const resp = await fetch('/api/telnyx/calls', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fromNumber: selectedPhoneNumber!.phoneNumber, toNumber })
                            })
                            if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.error || 'Failed to initiate call') }
                            const data = await resp.json()
                            toast({ title: 'Call Initiated', description: toNumber })
                            openCall({
                              fromNumber: selectedPhoneNumber!.phoneNumber,
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
                      <Button className="h-12" variant="secondary" onClick={() => setDialpadNumber(dialpadNumber.slice(0,-1))}>Backspace</Button>
                      <Button className="h-12" variant="ghost" onClick={() => setDialpadNumber('')}>Clear</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Call Logs */}
            <div className="w-full md:w-3/5">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Call Logs</CardTitle>
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
                        <div className="text-xs text-muted-foreground">No calls found for this number.</div>
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
  )
}
