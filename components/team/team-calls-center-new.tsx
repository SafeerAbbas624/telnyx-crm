"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  phoneNumber: string
  state?: string
  isActive: boolean
  capabilities: string[]
  totalCallCount: number
  totalSmsCount: number
}

export default function TeamCallsCenter() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [assignedContacts, setAssignedContacts] = useState<Contact[]>([])

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [recentCalls, setRecentCalls] = useState<TelnyxCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialing, setIsDialing] = useState(false)
  const [activeCall, setActiveCall] = useState<TelnyxCall | null>(null)
  const [showActivityDialog, setShowActivityDialog] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [phoneNumbersRes, callsRes, contactsRes] = await Promise.all([
        fetch('/api/team/assigned-phone-numbers'),
        fetch('/api/team/calls'),
        fetch('/api/team/assigned-contacts')
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

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        setAssignedContacts(contactsData.contacts || [])
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
      // Open quick activity dialog while in progress
      setShowActivityDialog(true)


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
            {phoneNumbers.map((phoneNumber) => (
              <Button
                key={phoneNumber.id}
                variant={selectedPhoneNumber?.id === phoneNumber.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPhoneNumber(phoneNumber)}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {phoneNumber.number}
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

      <div className="flex-1 flex">
        {/* Contacts List */}
        <div className="w-1/3 border-r">
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
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
                              {contact.firstName[0]}{contact.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {contact.firstName} {contact.lastName}
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
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Call Details & Recent Calls */}
        <div className="w-2/3 p-4">
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
                          {selectedContact.firstName} {selectedContact.lastName}
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
                      {/* Active Call Banner */}
                      {recentCalls.some(c => ['initiated','ringing','answered','bridged'].includes(c.status)) && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                          <div className="flex items-center gap-2 text-amber-800 text-sm">
                            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Active call in progress</span>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <Button type="button" onClick={hangupActiveCall} size="sm" variant="destructive">
                              <PhoneOff className="h-4 w-4 mr-1" /> Hang Up
                            </Button>
                          </div>
                        </div>
                      )}

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
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {recentCalls
                        .filter(call => call.contactId === selectedContact.id)
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
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={getStatusColor(call.status)}>
                                {call.status}
                              </Badge>
                              {call.duration > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {formatDuration(call.duration)}
                                </p>
                              )}
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
