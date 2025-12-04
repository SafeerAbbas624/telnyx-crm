"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Phone, Search, X, Filter, ChevronLeft, ChevronRight } from "lucide-react"
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
import { LocalFilterWrapper } from "@/components/calls/local-filter-wrapper"
import AdvancedFiltersRedesign from "@/components/contacts/advanced-filters-redesign"
import ContactName from "@/components/contacts/contact-name"

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

export default function ManualDialingTab() {
  const { toast } = useToast()
  const { openCall } = useCallUI()
  const { isLoading: contactsLoading } = useContacts()

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [recentCalls, setRecentCalls] = useState<TelnyxCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialpadNumber, setDialpadNumber] = useState("")

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

  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Pagination for contacts
  const [contactsPage, setContactsPage] = useState(1)
  const contactsPerPage = 50

  // Pagination for calls
  const [callsPage, setCallsPage] = useState(1)
  const callsPerPage = 50

  // Selected phone number for call log filtering (single selection)
  const [selectedCallLogNumber, setSelectedCallLogNumber] = useState<string | null>(null)
  const [contactsMap, setContactsMap] = useState<Map<string, Contact>>(new Map())
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  // Load ALL contacts for filtering (only once on mount)
  const loadAllContacts = async () => {
    try {
      setLoadingAllContacts(true)
      console.log(`📊 [MANUAL DIALING] Loading all contacts for filtering...`)

      const response = await fetch('/api/contacts?limit=10000')
      if (response.ok) {
        const data = await response.json()
        const contacts = data.contacts || []
        setAllContactsFromContext(contacts)
        console.log(`📊 [MANUAL DIALING] Loaded ${contacts.length} contacts for filtering`)
      }
    } catch (error) {
      console.error('📊 [MANUAL DIALING] Error loading all contacts:', error)
    } finally {
      setLoadingAllContacts(false)
    }
  }

  // Load contacts with server-side pagination
  const loadContacts = async (page = 1) => {
    try {
      setLoadingContacts(true)
      console.log(`📊 [MANUAL DIALING] Loading contacts page ${page}...`)

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
        console.log(`📊 [MANUAL DIALING] Loaded ${data.contacts?.length || 0} contacts`)
      } else {
        console.error(`📊 [MANUAL DIALING] Failed to load contacts: ${response.status}`)
      }
    } catch (error) {
      console.error('📊 [MANUAL DIALING] Error loading contacts:', error)
      toast({ title: 'Error', description: 'Failed to load contacts', variant: 'destructive' })
    } finally {
      setLoadingContacts(false)
    }
  }

  useEffect(() => {
    loadData()
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

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [phoneNumbersRes, callsRes] = await Promise.all([
        fetch('/api/telnyx/phone-numbers'),
        fetch('/api/telnyx/calls')
      ])

      if (phoneNumbersRes.ok) {
        const phoneNumbersData = await phoneNumbersRes.json()
        const voiceNumbers = phoneNumbersData.filter((pn: TelnyxPhoneNumber) =>
          pn.capabilities.includes('VOICE') && pn.isActive
        )
        setPhoneNumbers(voiceNumbers)
        if (voiceNumbers.length > 0) {
          setSelectedPhoneNumber(voiceNumbers[0])
        }
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json()
        setRecentCalls(Array.isArray(callsData) ? callsData : callsData.calls || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load contact names for call logs
  useEffect(() => {
    const loadContactsForCalls = async () => {
      const phoneNumbers = new Set<string>()
      recentCalls.forEach(call => {
        phoneNumbers.add(call.fromNumber)
        phoneNumbers.add(call.toNumber)
      })

      const contactsData = new Map<string, Contact>()
      for (const phone of phoneNumbers) {
        try {
          const res = await fetch(`/api/contacts/lookup-by-number?number=${encodeURIComponent(phone)}`)
          if (res.ok) {
            const contact = await res.json()
            if (contact) {
              contactsData.set(phone, contact)
            }
          }
        } catch (error) {
          console.error('Error loading contact for', phone, error)
        }
      }
      setContactsMap(contactsData)
    }

    if (recentCalls.length > 0) {
      loadContactsForCalls()
    }
  }, [recentCalls])

  // Reload calls when selected number changes
  useEffect(() => {
    if (selectedCallLogNumber) {
      loadCallsForNumber(selectedCallLogNumber)
    } else {
      loadData()
    }
  }, [selectedCallLogNumber])

  const loadCallsForNumber = async (number: string) => {
    try {
      const res = await fetch(`/api/calls/by-number?number=${encodeURIComponent(number)}&limit=${callsPerPage}&offset=${(callsPage - 1) * callsPerPage}`)
      if (res.ok) {
        const data = await res.json()
        setRecentCalls(data.calls || [])
      }
    } catch (error) {
      console.error('Error loading calls for number:', error)
    }
  }

  const handleCall = async (contact: Contact) => {
    if (!selectedPhoneNumber) {
      toast({ title: 'Error', description: 'Please select a phone number first', variant: 'destructive' })
      return
    }

    const toNumber = getBestPhoneNumber(contact)
    if (!toNumber) {
      toast({ title: 'Error', description: 'Contact has no phone number', variant: 'destructive' })
      return
    }

    try {
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.ensureRegistered()
      const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber: selectedPhoneNumber.phoneNumber })

      // Log the call to database
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          contactId: contact.id,
          fromNumber: selectedPhoneNumber.phoneNumber,
          toNumber,
        })
      }).catch(err => console.error('Failed to log call:', err))

      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber: selectedPhoneNumber.phoneNumber,
        toNumber,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
      })

      toast({ title: 'Calling', description: `${contact.firstName} ${contact.lastName}` })
    } catch (error: any) {
      console.error('Call error:', error)
      toast({ title: 'Call Failed', description: error.message || 'Unknown error', variant: 'destructive' })
    }
  }

  const handleDialpadCall = async () => {
    if (!selectedPhoneNumber) {
      toast({ title: 'Error', description: 'Please select a phone number first', variant: 'destructive' })
      return
    }

    if (!dialpadNumber) {
      toast({ title: 'Error', description: 'Please enter a number', variant: 'destructive' })
      return
    }

    try {
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.ensureRegistered()
      const { sessionId } = await rtcClient.startCall({ toNumber: dialpadNumber, fromNumber: selectedPhoneNumber.phoneNumber })

      // Log the call to database (no contactId for dialpad calls)
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          fromNumber: selectedPhoneNumber.phoneNumber,
          toNumber: dialpadNumber,
        })
      }).catch(err => console.error('Failed to log call:', err))

      openCall({
        fromNumber: selectedPhoneNumber.phoneNumber,
        toNumber: dialpadNumber,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
      })

      toast({ title: 'Calling', description: dialpadNumber })
      setDialpadNumber("")
    } catch (error: any) {
      console.error('Call error:', error)
      toast({ title: 'Call Failed', description: error.message || 'Unknown error', variant: 'destructive' })
    }
  }

  // Handle Enter key on dialpad input
  const handleDialpadKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleDialpadCall()
    }
  }

  const dialpadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ]

  // Use server-loaded contacts (already paginated)
  const displayContacts = hasActiveFilters ? localFilteredContacts : contacts

  const totalContactPages = pagination?.totalPages || 1

  // Paginated calls
  const paginatedCalls = useMemo(() => {
    const start = (callsPage - 1) * callsPerPage
    const end = start + callsPerPage
    return recentCalls.slice(start, end)
  }, [recentCalls, callsPage])

  const totalCallPages = Math.ceil(recentCalls.length / callsPerPage)

  const selectCallLogNumber = (number: string | null) => {
    setSelectedCallLogNumber(number)
    setCallsPage(1)
  }

  const getContactForNumber = (phoneNumber: string): Contact | null => {
    return contactsMap.get(phoneNumber) || null
  }

  return (
    <LocalFilterWrapper
      instanceId="manual-dialing"
      allContacts={allContactsFromContext}
      onFilteredContactsChange={(filtered, hasFilters) => {
        setLocalFilteredContacts(filtered)
        setHasActiveFilters(hasFilters)
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-1 gap-6 p-6 overflow-hidden">
          {/* Left: Contacts */}
          <div className="w-[380px] flex flex-col bg-white rounded-lg border overflow-hidden">
            <div className="p-4 border-b shrink-0">
              <h3 className="font-semibold text-lg mb-3">Contacts</h3>

              {/* Search Bar */}
              <div className="relative mb-3">
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
            </div>

          <div className="flex-1 overflow-y-auto">
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
                    className={`p-3 rounded-lg mb-1 hover:bg-gray-50 transition-colors ${
                      selectedContact?.id === contact.id ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCall(contact)
                        }}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
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

        {/* Center: Dial Pad */}
        <div className="flex-1 flex flex-col bg-white rounded-lg border p-8 overflow-hidden">
        <div className="w-full max-w-md mx-auto">
          <h3 className="font-semibold text-lg mb-4 text-center">Dial Pad</h3>

          {/* Calling From */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Calling From</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={selectedPhoneNumber?.phoneNumber || ''}
              onChange={(e) => {
                const pn = phoneNumbers.find(p => p.phoneNumber === e.target.value)
                setSelectedPhoneNumber(pn || null)
              }}
            >
              {phoneNumbers.map((pn) => (
                <option key={pn.id} value={pn.phoneNumber}>
                  {formatPhoneNumberForDisplay(pn.phoneNumber)}
                </option>
              ))}
            </select>
          </div>

          {/* Number Input */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Number</label>
            <Input
              placeholder="Enter phone number"
              value={dialpadNumber}
              onChange={(e) => setDialpadNumber(e.target.value)}
              onKeyDown={handleDialpadKeyDown}
              className="text-center text-lg"
            />
          </div>

          {/* Dialpad Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {dialpadButtons.flat().map((btn) => (
              <Button
                key={btn}
                variant="outline"
                className="h-14 text-xl font-semibold"
                onClick={() => setDialpadNumber(prev => prev + btn)}
              >
                {btn}
              </Button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDialpadNumber("")}
            >
              Clear
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleDialpadCall}
              disabled={!dialpadNumber || !selectedPhoneNumber}
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
          </div>
        </div>
        </div>

        {/* Right: Recent Calls */}
        <div className="w-[380px] flex flex-col bg-white rounded-lg border overflow-hidden">
          <div className="p-4 border-b shrink-0">
            <h3 className="font-semibold text-lg mb-3">Recent Calls</h3>

            {/* Number Selector - Single selection */}
            <div className="space-y-2">
              <Button
                variant={selectedCallLogNumber === null ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => selectCallLogNumber(null)}
              >
                All Call Logs
              </Button>

              <div className="space-y-1">
                {phoneNumbers.map((pn, index) => (
                  <Button
                    key={pn.id}
                    variant={selectedCallLogNumber === pn.phoneNumber ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => selectCallLogNumber(pn.phoneNumber)}
                  >
                    Line {index + 1}: {formatPhoneNumberForDisplay(pn.phoneNumber)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {paginatedCalls.map((call) => {
                const phoneNumber = call.direction === 'outbound' ? call.toNumber : call.fromNumber
                const contact = getContactForNumber(phoneNumber)
                const displayName = contact ? `${contact.firstName} ${contact.lastName}` : null

                return (
                  <div key={call.id} className="p-3 rounded-lg mb-1 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 bg-blue-100">
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                            <Phone className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          {displayName && (
                            <div className="font-medium text-sm">
                              {displayName}
                            </div>
                          )}
                          <div className={`text-xs ${displayName ? 'text-gray-500' : 'font-medium text-sm'}`}>
                            {formatPhoneNumberForDisplay(phoneNumber)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(call.createdAt), 'yyyy-MM-dd HH:mm')} • {call.duration ? `${Math.floor(call.duration / 60)} min` : '0 min'}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={call.status === 'answered' || call.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs bg-blue-600 hover:bg-blue-700"
                      >
                        {call.status === 'answered' || call.status === 'completed' ? 'completed' : 'missed'}
                      </Badge>
                    </div>
                  </div>
                )
              })}

              {paginatedCalls.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  No calls found
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalCallPages > 1 && (
            <div className="p-3 border-t flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCallsPage(p => Math.max(1, p - 1))}
                disabled={callsPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {callsPage} of {totalCallPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCallsPage(p => Math.min(totalCallPages, p + 1))}
                disabled={callsPage === totalCallPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
    </LocalFilterWrapper>
  )
}

