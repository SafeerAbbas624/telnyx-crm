"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import {
  Phone,
  PhoneCall,
  Search,
  Clock,
  DollarSign,
  Play,
  Download,
  User,
  Calendar,
  MapPin
} from "lucide-react"
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
  is_active: boolean
  capabilities: string[]
  usage_count: number
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  phone1?: string
  phone2?: string
  phone3?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
}

export default function TeamCallsCenter() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [assignedContacts, setAssignedContacts] = useState<Contact[]>([])
  const [assignedPhoneNumbers, setAssignedPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [recentCalls, setRecentCalls] = useState<TelnyxCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialing, setIsDialing] = useState(false)
  const [activeCall, setActiveCall] = useState<TelnyxCall | null>(null)

  useEffect(() => {
    loadTeamData()
  }, [])


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

  // Clear local activeCall banner when backend shows no active call
  useEffect(() => {
    if (!hasActiveCall && activeCall) setActiveCall(null)
  }, [hasActiveCall])

  const loadTeamData = async () => {
    setIsLoading(true)
    try {
      // Load assigned contacts
      const contactsResponse = await fetch('/api/team/assigned-contacts')
      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json()
        setAssignedContacts(contactsData.contacts || [])
      }

      // Load assigned phone numbers
      try {
        const phoneResponse = await fetch('/api/team/assigned-phone-numbers')
        if (phoneResponse.ok) {
          const phoneData = await phoneResponse.json()
          console.log('Phone API response:', phoneData)

          if (phoneData.phoneNumbers && phoneData.phoneNumbers.length > 0) {
            setAssignedPhoneNumbers(phoneData.phoneNumbers)
            setSelectedPhoneNumber(phoneData.phoneNumbers[0])
            console.log('Set phone numbers:', phoneData.phoneNumbers)
          } else {
            console.log('No phone numbers in response')
            setAssignedPhoneNumbers([])
          }
        } else {
          console.error('Phone API error:', phoneResponse.status)
        }
      } catch (error) {
        console.error('Phone API fetch error:', error)
      }

      // Load recent calls for assigned contacts
      const callsResponse = await fetch('/api/team/calls')
      if (callsResponse.ok) {
        const callsData = await callsResponse.json()
        setRecentCalls(callsData.calls || [])
      }
    } catch (error) {
      console.error('Error loading team data:', error)
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatPhoneNumberForDisplay = (phone: string | undefined | null): string => {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const getBestPhoneNumber = (contact: Contact): string => {
    return contact.phone1 || contact.phone2 || contact.phone3 || ''
  }

  const makeCall = async (contact: Contact) => {
    if (!selectedPhoneNumber) {
      toast({
        title: "Error",
        description: "Please select a phone number first",
        variant: "destructive",
      })
      return
    }

    const phoneToCall = getBestPhoneNumber(contact)
    if (!phoneToCall) {
      toast({
        title: "Error",
        description: "Contact has no phone number",
        variant: "destructive",
      })
      return
    }

    setIsDialing(true)
    try {
      const response = await fetch('/api/telnyx/make-call', {
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

      if (response.ok) {
        const data = await response.json()
        setActiveCall(data.call)
        toast({
          title: "Call Initiated",
          description: `Calling ${contact.firstName} ${contact.lastName}`,
        })
        // Refresh calls list
        loadTeamData()
      } else {
        throw new Error('Failed to make call')
      }
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        title: "Error",
        description: "Failed to make call",
        variant: "destructive",
      })
    } finally {
      setIsDialing(false)
    }
  }

  const filteredContacts = assignedContacts.filter(contact =>
    `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getBestPhoneNumber(contact).includes(searchQuery)
  )

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatCost = (cost: number): string => {
    return `$${(cost / 100).toFixed(4)}`
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
          <label className="text-sm font-medium mb-2 block">Your Assigned Phone Numbers</label>
          <div className="flex gap-2 flex-wrap">
            {assignedPhoneNumbers.map((phoneNumber) => (
              <Button
                key={phoneNumber.id}
                variant={selectedPhoneNumber?.id === phoneNumber.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPhoneNumber(phoneNumber)}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {phoneNumber.number}
                {phoneNumber.is_active && (
                  <span className="text-xs">(Active)</span>
                )}
              </Button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Debug: {assignedPhoneNumbers.length} phone numbers loaded
          </div>
          {assignedPhoneNumbers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No phone numbers assigned to you. Contact your administrator.
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
                placeholder="Search assigned contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No contacts match your search" : "No contacts assigned to you"}
                    </p>
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
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
                            disabled={isDialing || !selectedPhoneNumber || !getBestPhoneNumber(contact)}
                          >
                            <PhoneCall className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
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
                      <Button
                        onClick={() => makeCall(selectedContact)}
                        disabled={isDialing || !selectedPhoneNumber || !getBestPhoneNumber(selectedContact)}
                        className="flex items-center gap-2"
                      >
                        <PhoneCall className="h-4 w-4" />
                        {isDialing ? 'Calling...' : 'Call Now'}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p>{selectedContact.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Address</p>
                      <p>
                        {selectedContact.address ?
                          `${selectedContact.address}, ${selectedContact.city || ''} ${selectedContact.state || ''} ${selectedContact.zipCode || ''}`.trim() :
                          'Not provided'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Call Status */}
              {activeCall && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                        <div>
                          <p className="font-medium">Active Call</p>
                          <p className="text-sm text-muted-foreground">
                            {activeCall.fromNumber} → {activeCall.toNumber}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {activeCall.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Calls for Selected Contact */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {recentCalls
                      .filter(call => call.contactId === selectedContact.id)
                      .length === 0 ? (
                      <div className="text-center py-8">
                        <PhoneCall className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No call history with this contact</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentCalls
                          .filter(call => call.contactId === selectedContact.id)
                          .slice(0, 10)
                          .map((call) => (
                            <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${
                                  call.direction === 'inbound' ? 'bg-blue-500' : 'bg-green-500'
                                }`} />
                                <div>
                                  <p className="font-medium text-sm">
                                    {call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(call.createdAt), 'MMM d, yyyy h:mm a')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <Badge variant={call.status === 'completed' ? 'default' : 'secondary'}>
                                    {call.status}
                                  </Badge>
                                  {call.duration > 0 && (
                                    <span className="text-sm text-muted-foreground">
                                      {formatDuration(call.duration)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatCost(call.cost)}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Contact</h3>
                <p className="text-muted-foreground">
                  Choose a contact from your assigned list to view call details and make calls
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Recent Calls Summary */}
      <div className="border-t p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                All Recent Calls
              </div>
              <Badge variant="outline">
                {recentCalls.length} total calls
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              {recentCalls.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No call history found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentCalls.slice(0, 5).map((call) => {
                    const contact = assignedContacts.find(c => c.id === call.contactId)
                    return (
                      <div key={call.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            call.direction === 'inbound' ? 'bg-blue-500' : 'bg-green-500'
                          }`} />
                          <span className="text-sm">
                            {contact ? `${contact.firstName} ${contact.lastName}` : call.toNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(call.createdAt), 'MMM d, h:mm a')}</span>
                          {call.duration > 0 && <span>{formatDuration(call.duration)}</span>}
                          <Badge variant="outline" className="text-xs">
                            {call.status}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
