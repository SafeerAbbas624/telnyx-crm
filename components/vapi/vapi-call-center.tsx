'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Phone, Play, Pause, Square, Trash2, Search, Filter } from 'lucide-react'
import { useVapiStore } from '@/lib/stores/useVapiStore'
import { useContacts } from '@/lib/context/contacts-context'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import AdvancedContactFilter from '@/components/contacts/advanced-filters-redesign'

export default function VapiCallCenter() {
  const {
    selectedContactIds,
    addSelectedContactId,
    removeSelectedContactId,
    clearSelectedContactIds,
    calls,
    setCalls,
  } = useVapiStore()

  const { contacts } = useContacts()
  const [searchQuery, setSearchQuery] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [activeCalls, setActiveCalls] = useState<Map<string, any>>(new Map())
  const [filteredContactsList, setFilteredContactsList] = useState(contacts)
  const [hasActiveFilters, setHasActiveFilters] = useState(false)

  // Update filtered contacts when contacts change
  useEffect(() => {
    setFilteredContactsList(contacts)
  }, [contacts])

  const filteredContacts = filteredContactsList.filter(contact => {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase()
    const phone = (contact.phone1 || '').toLowerCase()
    const query = searchQuery.toLowerCase()
    return fullName.includes(query) || phone.includes(query)
  })

  const handleStartCalls = async () => {
    if (selectedContactIds.length === 0) {
      toast.error('Please select at least one contact')
      return
    }

    try {
      setIsStarting(true)
      const response = await fetch('/api/vapi/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: selectedContactIds,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`Started ${data.callsCreated} call(s)`)
        setCalls(data.calls)
        clearSelectedContactIds()
        // Refresh calls periodically
        startCallRefresh()
      } else {
        toast.error(data.error || 'Failed to start calls')
      }
    } catch (error) {
      console.error('Error starting calls:', error)
      toast.error('Failed to start calls')
    } finally {
      setIsStarting(false)
    }
  }

  const startCallRefresh = () => {
    const interval = setInterval(() => {
      fetchActiveCalls()
    }, 2000)
    return () => clearInterval(interval)
  }

  const fetchActiveCalls = async () => {
    try {
      const response = await fetch('/api/vapi/calls?status=in_progress')
      const data = await response.json()
      if (data.success) {
        const callMap = new Map()
        data.calls.forEach((call: any) => {
          callMap.set(call.id, call)
        })
        setActiveCalls(callMap)
      }
    } catch (error) {
      console.error('Error fetching active calls:', error)
    }
  }

  const handleControlCall = async (callId: string, action: 'pause' | 'resume' | 'stop') => {
    try {
      const response = await fetch(`/api/vapi/calls/${callId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`Call ${action}ed`)
        fetchActiveCalls()
      } else {
        toast.error(data.error || `Failed to ${action} call`)
      }
    } catch (error) {
      console.error(`Error ${action}ing call:`, error)
      toast.error(`Failed to ${action} call`)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Make AI Calls</h2>
        <p className="text-sm text-gray-600">Select contacts and start making AI-powered calls</p>
      </div>

      {/* Contact Selection */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Search Contacts</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Advanced Filters Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Advanced Filters {hasActiveFilters && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Active</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[600px] p-4" align="start">
                <AdvancedContactFilter
                  contacts={contacts}
                  onFilteredContactsChange={(filtered, hasFilters) => {
                    setFilteredContactsList(filtered)
                    setHasActiveFilters(hasFilters)
                  }}
                  selectedContacts={selectedContactIds.map(id => contacts.find(c => c.id === id)).filter(Boolean) as any[]}
                  onSelectedContactsChange={() => {}}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Selected: {selectedContactIds.length} contact(s)
              </label>
              {selectedContactIds.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelectedContactIds}
                  className="text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3 bg-white">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No contacts found</p>
              ) : (
                filteredContacts.map(contact => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          addSelectedContactId(contact.id)
                        } else {
                          removeSelectedContactId(contact.id)
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{contact.phone1}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <Button
            onClick={handleStartCalls}
            disabled={selectedContactIds.length === 0 || isStarting}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Phone className="w-4 h-4" />
            {isStarting ? 'Starting Calls...' : `Start Calls (${selectedContactIds.length})`}
          </Button>
        </div>
      </Card>

      {/* Active Calls */}
      {activeCalls.size > 0 && (
        <Card className="p-6 border-green-200 bg-green-50">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-600" />
            Active Calls ({activeCalls.size})
          </h3>

          <div className="space-y-3">
            {Array.from(activeCalls.values()).map(call => (
              <div key={call.id} className="flex items-center justify-between p-3 bg-white rounded border">
                <div className="flex-1">
                  <p className="font-medium">{call.name}</p>
                  <p className="text-xs text-gray-500">
                    Duration: {call.duration ? `${call.duration}s` : 'ongoing'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleControlCall(call.id, 'pause')}
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleControlCall(call.id, 'resume')}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleControlCall(call.id, 'stop')}
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

