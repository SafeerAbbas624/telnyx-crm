"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Phone, Play, Pause, Square, Search, X, Users, History as HistoryIcon, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { useCallUI } from "@/lib/context/call-ui-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { format } from "date-fns"
import type { Contact } from "@/lib/types"
import { PowerDialerEngine, type QueueItem, type ActiveCall, type PowerDialerStats } from "@/lib/power-dialer/engine"
import AdvancedFiltersRedesign from "@/components/contacts/advanced-filters-redesign"
import { useContacts } from "@/lib/context/contacts-context"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  state?: string
  isActive: boolean
  capabilities: string[]
}

export default function PowerDialerTab() {
  const { toast } = useToast()
  const { openCall, call: currentCall } = useCallUI()
  const { contacts: contextContacts, searchContacts, isLoading: contactsLoading } = useContacts()

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
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'contacts' | 'queue' | 'history'>('contacts')
  const [history, setHistory] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Pagination for contacts
  const [contactsPage, setContactsPage] = useState(1)
  const contactsPerPage = 50

  const engineRef = useRef<PowerDialerEngine | null>(null)

  useEffect(() => {
    // loadPhoneNumbers()
    // loadHistory()
  }, [])

  useEffect(() => {
    // Update engine when admin call status changes
    if (engineRef.current) {
      engineRef.current.setAdminBusy(!!currentCall)
    }
  }, [currentCall])

  // Use filtered contacts from AdvancedContactFilter
  const baseContacts = filteredContacts.length > 0 ? filteredContacts : contextContacts

  // Apply search query
  const displayContacts = useMemo(() => {
    if (!searchQuery.trim()) return baseContacts
    
    const query = searchQuery.toLowerCase()
    return baseContacts.filter(contact => {
      const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
      const phone = contact.phone1 || contact.phone2 || contact.phone3 || ''
      const email = contact.email || ''
      const address = contact.propertyAddress || ''
      
      return fullName.includes(query) || 
             phone.includes(query) || 
             email.toLowerCase().includes(query) ||
             address.toLowerCase().includes(query)
    })
  }, [baseContacts, searchQuery])

  // Paginated contacts
  const paginatedContacts = useMemo(() => {
    const start = (contactsPage - 1) * contactsPerPage
    const end = start + contactsPerPage
    return displayContacts.slice(start, end)
  }, [displayContacts, contactsPage, contactsPerPage])

  const totalContactPages = Math.ceil(displayContacts.length / contactsPerPage)

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 p-6 gap-6 overflow-hidden">
        {/* Left: Statistics and Configuration */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Top: Statistics */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalCalls}</div>
              <div className="text-sm text-gray-600">Calls</div>
            </Card>
          </div>

          {/* Bottom: Dialer Configuration */}
          <div className="flex-1 flex flex-col bg-white rounded-lg border p-6 overflow-hidden">
            <h3 className="font-semibold text-lg mb-4">Dialer Configuration</h3>
            <div>Config goes here</div>
          </div>
        </div>

        {/* Right: Sidebar with Tabs */}
        <div className="w-[400px] flex flex-col bg-white rounded-lg border">
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex flex-col h-full">
            <TabsList className="grid grid-cols-3 m-4">
              <TabsTrigger value="contacts">
                <Users className="h-4 w-4 mr-1" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="queue">
                <Phone className="h-4 w-4 mr-1" />
                Queue
              </TabsTrigger>
              <TabsTrigger value="history">
                <HistoryIcon className="h-4 w-4 mr-1" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contacts" className="flex-1 flex flex-col m-0 overflow-hidden">
              <div className="p-4 border-b space-y-3">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      Advanced Filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[600px] p-4" align="start">
                    <AdvancedFiltersRedesign onClose={() => {}} />
                  </PopoverContent>
                </Popover>

                {/* Add to Queue Button */}
                <Button
                  size="sm"
                  className="w-full"
                  disabled={selectedContacts.length === 0}
                >
                  Add {selectedContacts.length > 0 ? `${selectedContacts.length} ` : ''}to Queue
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {paginatedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-3 rounded-lg mb-1 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedContacts.find(c => c.id === contact.id) ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatPhoneNumberForDisplay(contact.phone1 || contact.phone2 || contact.phone3 || '')}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="queue" className="flex-1 flex flex-col m-0 overflow-hidden">
              <div>Queue</div>
            </TabsContent>

            <TabsContent value="history" className="flex-1 flex flex-col m-0 overflow-hidden">
              <div>History</div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

