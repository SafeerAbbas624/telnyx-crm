"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Phone, Search, X, Filter, ChevronLeft, ChevronRight, Play, Pause, Square, LayoutGrid, List } from "lucide-react"
import { useCallUI } from "@/lib/context/call-ui-context"
import { formatPhoneNumberForDisplay, formatPhoneNumberForTelnyx, getBestPhoneNumber } from "@/lib/phone-utils"
import { format } from "date-fns"
import type { Contact } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PowerDialerEngine, type QueueItem, type ActiveCall, type PowerDialerStats } from "@/lib/power-dialer/engine"
import { LocalFilterWrapper } from "@/components/calls/local-filter-wrapper"
import AdvancedFiltersRedesign from "@/components/contacts/advanced-filters-redesign"
import ContactName from "@/components/contacts/contact-name"
import { PowerDialerListsManager } from "@/components/calls/power-dialer-lists-manager"
import MultiLineDialer from "@/components/calls/multi-line-dialer"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  state?: string
  isActive: boolean
  capabilities: string[]
}

interface TelnyxCall {
  id: string
  direction: 'inbound' | 'outbound'
  status: string
  duration: number
  fromNumber: string
  toNumber: string
  createdAt: string
  answeredAt?: string
  endedAt?: string
}

export default function PowerDialerTab() {
  const { toast } = useToast()
  const { openCall, call: currentCall } = useCallUI()
  const { isLoading: contactsLoading } = useContacts()

  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([])
  const [concurrentLines, setConcurrentLines] = useState(1)
  const [isDialing, setIsDialing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const [stats, setStats] = useState<PowerDialerStats>({
    totalCalls: 0,
    totalContacted: 0,
    totalAnswered: 0,
    totalNoAnswer: 0,
    totalTalkTime: 0,
    uniqueRate: 0,
  })

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])

  // Server-side pagination state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  } | null>(null)

  // All contacts for filtering
  const [allContactsFromContext, setAllContactsFromContext] = useState<Contact[]>([])
  const [loadingAllContacts, setLoadingAllContacts] = useState(false)

  // Local filter state for this tab only
  const [localFilteredContacts, setLocalFilteredContacts] = useState<Contact[]>([])
  const [hasActiveFilters, setHasActiveFilters] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'contacts' | 'queue' | 'history'>('contacts')
  const [history, setHistory] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  // List management state
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [showListsManager, setShowListsManager] = useState(false)

  // View mode: 'classic' or 'multiline'
  const [viewMode, setViewMode] = useState<'classic' | 'multiline'>('multiline')

  // Pagination for contacts
  const [contactsPage, setContactsPage] = useState(1)
  const contactsPerPage = 50

  const engineRef = useRef<PowerDialerEngine | null>(null)

  // Load ALL contacts for filtering (only once on mount)
  const loadAllContacts = async () => {
    try {
      setLoadingAllContacts(true)
      console.log(`📊 [POWER DIALER] Loading all contacts for filtering...`)

      const response = await fetch('/api/contacts?limit=10000')
      if (response.ok) {
        const data = await response.json()
        const contacts = data.contacts || []
        setAllContactsFromContext(contacts)
        console.log(`📊 [POWER DIALER] Loaded ${contacts.length} contacts for filtering`)
      }
    } catch (error) {
      console.error('📊 [POWER DIALER] Error loading all contacts:', error)
    } finally {
      setLoadingAllContacts(false)
    }
  }

  // Load contacts with server-side pagination
  const loadContacts = async (page = 1) => {
    try {
      setLoadingContacts(true)
      console.log(`📊 [POWER DIALER] Loading contacts page ${page}...`)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: contactsPerPage.toString(),
        ...(searchQuery && { search: searchQuery }),
      })

      const response = await fetch(`/api/contacts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
        setPagination(data.pagination)
        console.log(`📊 [POWER DIALER] Loaded ${data.contacts?.length || 0} contacts`)
      } else {
        console.error(`📊 [POWER DIALER] Failed to load contacts: ${response.status}`)
      }
    } catch (error) {
      console.error('📊 [POWER DIALER] Error loading contacts:', error)
      toast({ title: 'Error', description: 'Failed to load contacts', variant: 'destructive' })
    } finally {
      setLoadingContacts(false)
    }
  }

  useEffect(() => {
    loadAllContacts() // Load all contacts once for filtering
  }, [])

  // Load contacts when page or search changes
  useEffect(() => {
    loadContacts(contactsPage)
  }, [contactsPage, searchQuery])

  // Reset to page 1 when search changes
  useEffect(() => {
    if (contactsPage !== 1) {
      setContactsPage(1)
    }
  }, [searchQuery])

  const loadPhoneNumbers = async () => {
    try {
      const res = await fetch('/api/telnyx/phone-numbers')
      if (res.ok) {
        const data = await res.json()
        const voiceNumbers = data.filter((pn: TelnyxPhoneNumber) =>
          pn.capabilities.includes('VOICE') && pn.isActive
        )
        setPhoneNumbers(voiceNumbers)

        // Select all by default
        const allNumbers = voiceNumbers.map((pn: TelnyxPhoneNumber) => pn.phoneNumber)
        setSelectedNumbers(allNumbers)

        // Set concurrent lines to half
        setConcurrentLines(Math.max(1, Math.floor(allNumbers.length / 2)))
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    }
  }

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/power-dialer/session')
      if (res.ok) {
        const sessions = await res.json()
        setHistory(sessions)
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  useEffect(() => {
    loadPhoneNumbers()
    loadHistory()
  }, [])

  useEffect(() => {
    // Update engine when admin call status changes
    if (engineRef.current) {
      engineRef.current.setAdminBusy(!!currentCall)
    }
  }, [currentCall])

  const handleAddToQueue = () => {
    if (selectedContacts.length === 0) {
      toast({ title: 'Error', description: 'Please select contacts first', variant: 'destructive' })
      return
    }

    const newQueueItems: QueueItem[] = selectedContacts.map((contact, index) => ({
      id: `queue-${Date.now()}-${index}`,
      contactId: contact.id,
      contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, phone1: contact.phone1, phone2: contact.phone2, phone3: contact.phone3 },
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 3,
      priority: selectedContacts.length - index,
    }))

    setQueue(prev => [...prev, ...newQueueItems])
    setSelectedContacts([])
    setSidebarTab('queue')

    toast({ title: 'Success', description: `Added ${selectedContacts.length} contacts to queue` })
  }

  const handleStartDialing = async () => {
    // If starting from a list, we don't need queue to be pre-populated
    if (!selectedListId && queue.length === 0) {
      toast({ title: 'Error', description: 'Queue is empty or select a list', variant: 'destructive' })
      return
    }

    if (selectedNumbers.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one phone number', variant: 'destructive' })
      return
    }

    try {
      const res = await fetch('/api/power-dialer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: selectedListId ? undefined : queue.map(q => q.contactId),
          selectedNumbers,
          concurrentLines,
          listId: selectedListId || undefined,
        })
      })

      if (!res.ok) throw new Error('Failed to create session')

      const { session, queuedCount } = await res.json()
      setSessionId(session.id)

      // If starting from list, update queue with the queued items
      if (selectedListId && queuedCount > 0) {
        // Reload queue from session
        const sessionRes = await fetch(`/api/power-dialer/session?sessionId=${session.id}`)
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          const newQueue: QueueItem[] = sessionData.queueItems.map((item: any) => ({
            id: item.id,
            contactId: item.contactId,
            contact: item.contact,
            status: item.status,
            attemptCount: item.attemptCount,
            maxAttempts: item.maxAttempts,
            priority: item.priority,
          }))
          setQueue(newQueue)
        }
      }

      const engine = new PowerDialerEngine({
        sessionId: session.id,
        concurrentLines,
        selectedNumbers,
        onCallAnswered: (call: ActiveCall) => {
          openCall({
            contact: call.contact,
            fromNumber: call.fromNumber,
            toNumber: call.toNumber,
            mode: 'webrtc',
            webrtcSessionId: call.webrtcSessionId,
          })
        },
        onCallDroppedBusy: (call: ActiveCall) => {
          toast({
            title: 'Call Dropped',
            description: `${call.contact.firstName} ${call.contact.lastName} answered but you were busy. Queued for retry.`,
          })
        },
        onCallNoAnswer: (call: ActiveCall) => {},
        onCallFailed: (call: ActiveCall) => {
          console.error('Call failed:', call)
        },
        onStatsUpdate: (newStats: PowerDialerStats) => {
          setStats(newStats)
        },
        onQueueUpdate: (newQueue: QueueItem[]) => {
          setQueue(newQueue)
        },
        onActiveCallsUpdate: (calls: ActiveCall[]) => {
          setActiveCalls(calls)
        },
      })

      await engine.loadQueue(queue)
      engine.start()
      engineRef.current = engine

      setIsDialing(true)
      setIsPaused(false)

      await fetch('/api/power-dialer/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, action: 'start' })
      })

      toast({ title: 'Power Dialer Started', description: `Calling ${queue.length} contacts with ${concurrentLines} concurrent lines` })
    } catch (error: any) {
      console.error('Error starting dialer:', error)
      toast({ title: 'Error', description: error.message || 'Failed to start dialer', variant: 'destructive' })
    }
  }

  const handlePauseResume = async () => {
    if (!engineRef.current || !sessionId) return

    if (isPaused) {
      engineRef.current.resume()
      setIsPaused(false)
      await fetch('/api/power-dialer/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'resume' })
      })
      toast({ title: 'Resumed', description: 'Power dialer resumed' })
    } else {
      engineRef.current.pause()
      setIsPaused(true)
      await fetch('/api/power-dialer/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'pause' })
      })
      toast({ title: 'Paused', description: 'Power dialer paused' })
    }
  }

  const handleStop = async (endForToday: boolean = false) => {
    if (!engineRef.current || !sessionId) return

    engineRef.current.stop()
    setIsDialing(false)
    setIsPaused(false)

    const action = endForToday && selectedListId ? 'end_for_today' : 'stop'

    await fetch('/api/power-dialer/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action,
        stats: endForToday ? stats : undefined,
      })
    })

    const message = endForToday
      ? 'Progress saved. You can resume this list later.'
      : 'Power dialer stopped'

    toast({ title: 'Stopped', description: message })
    loadHistory()

    if (endForToday) {
      setSelectedListId(null)
      setQueue([])
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const toggleNumberSelection = (phoneNumber: string) => {
    setSelectedNumbers(prev => {
      if (prev.includes(phoneNumber)) {
        const newSelection = prev.filter(n => n !== phoneNumber)
        if (concurrentLines > newSelection.length) {
          setConcurrentLines(Math.max(1, newSelection.length))
        }
        return newSelection
      } else {
        return [...prev, phoneNumber]
      }
    })
  }

  // Use server-loaded contacts (already paginated)
  const displayContacts = hasActiveFilters ? localFilteredContacts : contacts

  const totalContactPages = pagination?.totalPages || 1

  // Check if all displayed contacts are selected
  const allDisplayedContactsSelected = useMemo(() => {
    if (displayContacts.length === 0) return false
    return displayContacts.every(contact => selectedContacts.find(c => c.id === contact.id))
  }, [displayContacts, selectedContacts])

  // Handle select all / deselect all
  const handleSelectAll = () => {
    if (allDisplayedContactsSelected) {
      // Deselect all displayed contacts
      setSelectedContacts(prev =>
        prev.filter(selected => !displayContacts.find(displayed => displayed.id === selected.id))
      )
    } else {
      // Select all displayed contacts
      setSelectedContacts(prev => {
        const newSelections = [...prev]
        displayContacts.forEach(contact => {
          if (!newSelections.find(c => c.id === contact.id)) {
            newSelections.push(contact)
          }
        })
        return newSelections
      })
    }
  }

  // If multiline view mode, render the new MultiLineDialer
  if (viewMode === 'multiline') {
    return (
      <div className="h-full flex flex-col">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-800">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Power Dialer</h2>
            <Badge variant="outline" className="text-xs">Multi-Line Mode</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowListsManager(true)}
            >
              Manage Lists
            </Button>
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === 'multiline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('multiline')}
                className="h-7 px-2"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Multi-Line
              </Button>
              <Button
                variant={viewMode === 'classic' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('classic')}
                className="h-7 px-2"
              >
                <List className="h-4 w-4 mr-1" />
                Classic
              </Button>
            </div>
          </div>
        </div>

        {/* Lists Manager Modal */}
        {showListsManager && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-40">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Call Lists</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowListsManager(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <PowerDialerListsManager
                  onSelectList={(listId) => {
                    setSelectedListId(listId)
                    setShowListsManager(false)
                    toast({ title: 'List Selected', description: 'Ready to start dialing from this list' })
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Multi-Line Dialer Component */}
        <div className="flex-1 min-h-0">
          <MultiLineDialer />
        </div>
      </div>
    )
  }

  // Classic view mode
  return (
    <LocalFilterWrapper
      instanceId="power-dialer"
      allContacts={allContactsFromContext}
      onFilteredContactsChange={(filtered, hasFilters) => {
        setLocalFilteredContacts(filtered)
        setHasActiveFilters(hasFilters)
      }}
    >
      {/* View Mode Toggle Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Power Dialer</h2>
          <Badge variant="outline" className="text-xs">Classic Mode</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowListsManager(true)}
          >
            Manage Lists
          </Button>
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'multiline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('multiline')}
              className="h-7 px-2"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Multi-Line
            </Button>
            <Button
              variant={viewMode === 'classic' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('classic')}
              className="h-7 px-2"
            >
              <List className="h-4 w-4 mr-1" />
              Classic
            </Button>
          </div>
        </div>
      </div>

      {/* Lists Manager Modal */}
      {showListsManager && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Call Lists</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowListsManager(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <PowerDialerListsManager
                onSelectList={(listId) => {
                  setSelectedListId(listId)
                  setShowListsManager(false)
                  toast({ title: 'List Selected', description: 'Ready to start dialing from this list' })
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex h-full overflow-hidden">
        <div className="flex flex-1 p-6 gap-6 overflow-hidden">
        {/* Left: Statistics and Configuration */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          {/* Top: Statistics */}
          <div className="grid grid-cols-6 gap-4 shrink-0">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalCalls}</div>
              <div className="text-sm text-gray-600">Calls</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalContacted}</div>
              <div className="text-sm text-gray-600">Contacted</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalAnswered}</div>
              <div className="text-sm text-gray-600">Answered</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.totalNoAnswer}</div>
              <div className="text-sm text-gray-600">No Answer</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {stats.totalContacted > 0 ? Math.round((stats.totalAnswered / stats.totalContacted) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Unique Rate</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">{formatTime(stats.totalTalkTime)}</div>
              <div className="text-sm text-gray-600">Talk Time</div>
            </Card>
          </div>

          {/* Bottom: Dialer Configuration */}
          <div className="flex flex-col bg-white rounded-lg border p-4 shrink-0 w-full max-w-[760px] mx-auto">
            <h3 className="font-semibold text-base mb-3">Dialer Configuration</h3>

            {/* Concurrent Lines Slider */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Concurrent Lines: {concurrentLines}</label>
                <span className="text-xs text-gray-500">{selectedNumbers.length} numbers selected</span>
              </div>
              <Slider
                value={[concurrentLines]}
                onValueChange={(value) => setConcurrentLines(value[0])}
                min={1}
                max={Math.max(1, selectedNumbers.length)}
                step={1}
                className="mb-1"
                disabled={isDialing}
              />
              <p className="text-xs text-gray-500">
                The dialer will call up to {concurrentLines} contacts simultaneously, rotating through your selected phone numbers.
              </p>
            </div>

            {/* Phone Number Selection */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block">Select Phone Numbers to Use</label>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {phoneNumbers.map((pn, index) => (
                  <div key={pn.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      checked={selectedNumbers.includes(pn.phoneNumber)}
                      onCheckedChange={() => toggleNumberSelection(pn.phoneNumber)}
                      disabled={isDialing}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Line {index + 1}: {formatPhoneNumberForDisplay(pn.phoneNumber)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unstarted Contacts Info */}
            {!isDialing && queue.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>{queue.filter(q => q.status === 'PENDING').length}</strong> contacts ready to call
                </p>
              </div>
            )}

            {/* Active Calls Progress (when dialing) */}
            {isDialing && activeCalls.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium mb-2">Active Calls ({activeCalls.length})</div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {activeCalls.map((call) => (
                    <div key={call.webrtcSessionId} className="p-3 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm text-green-800">
                          {call.contact.firstName} {call.contact.lastName}
                        </div>
                        <Badge variant="default" className="text-xs bg-green-600">
                          {call.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-green-700">
                        {formatPhoneNumberForDisplay(call.toNumber)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Bar (when dialing) */}
            {isDialing && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-blue-800">Progress</span>
                  <span className="text-xs text-blue-600">
                    {queue.filter(q => q.status === 'COMPLETED' || q.status === 'FAILED').length} / {queue.length}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${queue.length > 0 ? (queue.filter(q => q.status === 'COMPLETED' || q.status === 'FAILED').length / queue.length) * 100 : 0}%`
                    }}
                  />
                </div>
                <div className="text-[11px] text-blue-600 mt-0.5">
                  {Math.round(queue.length > 0 ? (queue.filter(q => q.status === 'COMPLETED' || q.status === 'FAILED').length / queue.length) * 100 : 0)}% complete
                </div>
              </div>
            )}

            {/* Start/Stop Controls */}
            {!isDialing ? (
              <div className="space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowListsManager(!showListsManager)}
                >
                  {selectedListId ? '📋 List Selected' : '📋 Select List'}
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded-md w-full"
                  onClick={handleStartDialing}
                  disabled={(queue.length === 0 && !selectedListId) || selectedNumbers.length === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Dialing
                </Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg"
                  onClick={handlePauseResume}
                >
                  {isPaused ? (
                    <>
                      <Play className="h-6 w-6 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-6 w-6 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg"
                  onClick={() => handleStop(true)}
                  title="Save progress and close session"
                >
                  💾 End for Today
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="px-8 py-6 text-lg"
                  onClick={() => handleStop(false)}
                >
                  <Square className="h-6 w-6 mr-2" />
                  Stop
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar with Tabs */}
        <div className="w-[400px] h-full flex flex-col bg-white rounded-lg border overflow-hidden">
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex flex-col h-full overflow-hidden">
            <TabsList className="grid grid-cols-3 m-4 shrink-0">
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="queue">Queue ({queue.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="contacts" className="m-0 h-full overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full grid grid-rows-[auto,1fr,auto]">
              <div className="p-4 border-b space-y-3 shrink-0">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search contacts..."
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Advanced Filters Button */}
                <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      Advanced Filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[580px] p-4" align="start">
                    <AdvancedFiltersRedesign onClose={() => setIsFiltersOpen(false)} useLocalContext={true} />
                  </PopoverContent>
                </Popover>

                {/* Add to Queue Button */}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleAddToQueue}
                  disabled={selectedContacts.length === 0}
                >
                  Add {selectedContacts.length > 0 ? `${selectedContacts.length} ` : ''}to Queue
                </Button>
              </div>

              {/* Select All Checkbox */}
              {displayContacts.length > 0 && (
                <div className="px-4 py-2 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-contacts"
                      checked={allDisplayedContactsSelected}
                      onCheckedChange={handleSelectAll}
                    />
                    <label
                      htmlFor="select-all-contacts"
                      className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                    >
                      {allDisplayedContactsSelected ? 'Deselect All' : 'Select All'} ({displayContacts.length})
                    </label>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-2">
                  {loadingContacts ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">Loading contacts...</p>
                    </div>
                  ) : displayContacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No contacts found</p>
                      {(hasActiveFilters || searchQuery) && (
                        <p className="text-xs mt-1">Try adjusting your filters or search</p>
                      )}
                    </div>
                  ) : (
                    displayContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-3 rounded-lg mb-1 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedContacts.find(c => c.id === contact.id) ? 'bg-blue-50 border border-blue-200' : ''
                        }`}
                        onClick={() => {
                          setSelectedContacts(prev => {
                            const exists = prev.find(c => c.id === contact.id)
                            if (exists) {
                              return prev.filter(c => c.id !== contact.id)
                            } else {
                              return [...prev, contact]
                            }
                          })
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              <ContactName contact={contact} clickMode="popup" stopPropagation />
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                              {contact.phone1 && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {formatPhoneNumberForDisplay(contact.phone1)}
                                </span>
                              )}
                              {contact.propertyAddress && (
                                <span className="flex items-center gap-1 truncate">
                                  {contact.propertyAddress}
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedContacts.find(c => c.id === contact.id) && (
                            <div className="flex-shrink-0">
                              <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pagination */}
              {totalContactPages > 1 && (
                <div className="p-3 border-t flex items-center justify-between shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                    disabled={contactsPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {contactsPage} of {totalContactPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContactsPage(p => Math.min(totalContactPages, p + 1))}
                    disabled={contactsPage === totalContactPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              </div>
            </TabsContent>

            <TabsContent value="queue" className="m-0 h-full overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full grid grid-rows-[auto,1fr]">
              <div className="p-4 border-b shrink-0">
                <div className="text-sm font-medium">
                  Call Queue <span className="text-gray-500">({queue.length} contacts)</span>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-2">
                  {queue.map((item, index) => (
                    <div key={item.id} className="p-3 rounded-lg mb-1 border">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm">
                          {index + 1}. {item.contact.firstName} {item.contact.lastName}
                        </div>
                        <Badge variant={
                          item.status === 'COMPLETED' ? 'default' :
                          item.status === 'CALLING' ? 'secondary' :
                          item.status === 'FAILED' ? 'destructive' : 'outline'
                        } className="text-xs">
                          {item.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatPhoneNumberForDisplay(item.contact.phone1 || '')}
                      </div>
                      {item.attemptCount > 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          Attempt {item.attemptCount}/{item.maxAttempts}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="m-0 h-full overflow-hidden data-[state=inactive]:hidden">
              <div className="h-full grid grid-rows-[auto,1fr]">
              <div className="p-4 border-b shrink-0">
                <div className="text-sm font-medium">Session History</div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-2">
                  {history.map((session) => (
                    <div key={session.id} className="p-3 rounded-lg mb-2 border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">
                          {format(new Date(session.createdAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {session.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>Calls: {session.totalCalls}</div>
                        <div>Answered: {session.totalAnswered}</div>
                        <div>Contacted: {session.totalContacted}</div>
                        <div>No Answer: {session.totalNoAnswer}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </LocalFilterWrapper>
  )
}
