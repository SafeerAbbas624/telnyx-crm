"use client"

import React, { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Phone, X, Clipboard, Mic, MicOff, Clock, User, Mail, Home, Tag } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"
import { useActivities } from "@/lib/context/activities-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import { Textarea } from "@/components/ui/textarea"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import type { Contact } from "@/lib/types"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  state?: string
  city?: string
  isActive: boolean
}

export default function ManualCalling() {
  const { contacts } = useContacts()
  const { activities } = useActivities()
  const [activeTab, setActiveTab] = useState("contacts")
  const [searchQuery, setSearchQuery] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isCallActive, setIsCallActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null)
  const [callNotes, setCallNotes] = useState("")
  const [matchedContact, setMatchedContact] = useState<Contact | null>(null)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Caller ID selection
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedCallerId, setSelectedCallerId] = useState<string>("")

  // Load available phone numbers on mount
  useEffect(() => {
    const loadAvailableNumbers = async () => {
      try {
        const response = await fetch('/api/telnyx/phone-numbers')
        if (response.ok) {
          const data = await response.json()
          const numbers = Array.isArray(data) ? data : data.phoneNumbers || []
          const activeNumbers = numbers.filter((n: TelnyxPhoneNumber) => n.isActive)
          setAvailableNumbers(activeNumbers)
          if (activeNumbers.length > 0 && !selectedCallerId) {
            setSelectedCallerId(activeNumbers[0].phoneNumber)
          }
        }
      } catch (error) {
        console.error('Failed to load phone numbers:', error)
      }
    }
    loadAvailableNumbers()
  }, [])

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
    const query = searchQuery.toLowerCase()

    return (
      fullName.includes(query) ||
      (contact.email && contact.email.toLowerCase().includes(query)) ||
      (contact.phone && contact.phone.includes(query)) ||
      (contact.propertyAddress && contact.propertyAddress.toLowerCase().includes(query))
    )
  })

  // Function to normalize phone numbers for comparison
  const normalizePhoneNumber = (number: string) => {
    // Remove all non-digit characters
    return number.replace(/\D/g, "")
  }

  // Find contact by phone number (with normalization)
  const findContactByPhone = (number: string) => {
    const normalizedInput = normalizePhoneNumber(number)

    // Only proceed if we have at least 7 digits
    if (normalizedInput.length < 7) return null

    return contacts.find((contact) => {
      if (!contact.phone) return false
      const normalizedContact = normalizePhoneNumber(contact.phone)

      // Check if the normalized numbers match at the end (to handle country codes)
      return normalizedContact.endsWith(normalizedInput) || normalizedInput.endsWith(normalizedContact)
    })
  }

  // Get recent activities for a contact
  const getContactActivities = (contactId: string) => {
    return activities
      .filter((activity) => activity.contactId === contactId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }

  const handleCall = (number: string) => {
    setPhoneNumber(number)

    // Check if the number matches a contact
    const contact = findContactByPhone(number)
    if (contact) {
      setMatchedContact(contact)
      setSelectedContact(contact.id)
      setShowContactInfo(true)
    } else {
      setMatchedContact(null)
    }

    setIsCallActive(true)

    // Start call timer
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    setCallTimer(timer)
  }

  const handleEndCall = () => {
    setIsCallActive(false)

    // Clear timer
    if (callTimer) {
      clearInterval(callTimer)
      setCallTimer(null)
    }

    setCallDuration(0)
    setCallNotes("")
  }

  const handleContactSelect = (contactId: string) => {
    setSelectedContact(contactId)
    const contact = contacts.find((c) => c.id === contactId)
    if (contact && contact.phone) {
      setPhoneNumber(contact.phone)
    }
  }

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit)
  }

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1))
  }

  const handlePasteNumber = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setPhoneNumber(text)
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && phoneNumber) {
      e.preventDefault()
      handleCall(phoneNumber)
    }
  }

  // Focus the input when the dialer tab is selected
  useEffect(() => {
    if (activeTab === "dialer" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [activeTab])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (callTimer) {
        clearInterval(callTimer)
      }
    }
  }, [callTimer])

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="contacts" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="dialer">Dialer</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="contacts" className="h-full flex flex-col">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="divide-y">
                {filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No contacts found</div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-4 hover:bg-muted/20 cursor-pointer ${selectedContact === contact.id ? "bg-muted/30" : ""}`}
                      onClick={() => handleContactSelect(contact.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="mt-0.5">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {contact.firstName?.[0] || "?"}
                              {contact.lastName?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-medium">
                              {contact.firstName} {contact.lastName}
                            </h3>
                            <p className="text-sm text-muted-foreground">{contact.phone}</p>
                            {contact.propertyAddress && (
                              <p className="text-sm text-muted-foreground mt-1">{contact.propertyAddress}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {contact.tags &&
                                contact.tags.slice(0, 3).map((tag) => (
                                  <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className="text-xs"
                                    style={{
                                      backgroundColor: `${tag.color}20`,
                                      color: tag.color,
                                      border: `1px solid ${tag.color}40`,
                                    }}
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                              {contact.tags && contact.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{contact.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (contact.phone) handleCall(contact.phone)
                          }}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="dialer" className="h-full flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="text-center">Dialer</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Caller ID Selection */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Call From:</label>
                  <Select value={selectedCallerId} onValueChange={setSelectedCallerId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select caller ID" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableNumbers.map((num) => (
                        <SelectItem key={num.id} value={num.phoneNumber}>
                          <div className="flex flex-col">
                            <span>{formatPhoneNumberForDisplay(num.phoneNumber)}</span>
                            {num.friendlyName && (
                              <span className="text-xs text-muted-foreground">{num.friendlyName}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="text-xl text-center font-mono py-6"
                      placeholder="Enter phone number"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex">
                      {phoneNumber && (
                        <Button variant="ghost" size="icon" onClick={handleBackspace}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={handlePasteNumber} title="Paste from clipboard">
                        <Clipboard className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      className="h-16 text-xl"
                      onClick={() => handleDigitPress(digit.toString())}
                    >
                      {digit}
                    </Button>
                  ))}
                </div>

                <div className="flex justify-center mt-auto">
                  {isCallActive ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-center mb-2">
                        <p className="text-lg font-medium">{phoneNumber}</p>
                        {matchedContact && (
                          <p className="text-sm text-primary">
                            Calling: {matchedContact.firstName} {matchedContact.lastName}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">Call duration: {formatDuration(callDuration)}</p>
                      </div>
                      <div className="flex gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className={`rounded-full ${isMuted ? "bg-red-100 text-red-600" : "bg-muted"}`}
                          onClick={() => setIsMuted(!isMuted)}
                        >
                          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="rounded-full h-12 w-12"
                          onClick={handleEndCall}
                        >
                          <Phone className="h-6 w-6 rotate-135" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      disabled={!phoneNumber}
                      variant="default"
                      size="icon"
                      className="rounded-full h-12 w-12 bg-green-600 hover:bg-green-700"
                      onClick={() => handleCall(phoneNumber)}
                    >
                      <Phone className="h-6 w-6" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Contact Info Dialog */}
      <Dialog open={showContactInfo} onOpenChange={setShowContactInfo}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{matchedContact && `${matchedContact.firstName} ${matchedContact.lastName}`}</span>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isCallActive ? "default" : "outline"}
                  className={isCallActive ? "bg-green-100 text-green-800 border-green-200" : ""}
                >
                  {isCallActive ? "Active Call" : "Call Ended"}
                </Badge>
                <span className="text-sm font-normal">{formatDuration(callDuration)}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info" className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="info">Contact Info</TabsTrigger>
              <TabsTrigger value="history">Recent Activity</TabsTrigger>
              <TabsTrigger value="notes">Call Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="flex-1 overflow-auto">
              {matchedContact && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <User size={14} />
                          <span>Name</span>
                        </div>
                        <div className="font-medium">
                          {matchedContact.firstName} {matchedContact.lastName}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone size={14} />
                          <span>Phone</span>
                        </div>
                        <div className="font-medium">{matchedContact.phone}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail size={14} />
                          <span>Email</span>
                        </div>
                        <div className="font-medium">{matchedContact.email}</div>
                      </div>

                      {matchedContact.propertyAddress && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Home size={14} />
                            <span>Property Address</span>
                          </div>
                          <div className="font-medium">{matchedContact.propertyAddress}</div>
                        </div>
                      )}
                    </div>

                    {matchedContact.tags && matchedContact.tags.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Tag size={14} />
                          <span>Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {matchedContact.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                border: `1px solid ${tag.color}40`,
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchedContact.notes && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Notes</div>
                        <div className="text-sm p-2 bg-muted/30 rounded-md">{matchedContact.notes}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-auto">
              <ScrollArea className="h-[300px]">
                {matchedContact ? (
                  <>
                    {getContactActivities(matchedContact.id).length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No recent activities found for this contact.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {getContactActivities(matchedContact.id).map((activity) => (
                          <Card key={activity.id}>
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium">{activity.title}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock size={12} />
                                      {format(new Date(activity.createdAt), "MMM d, yyyy")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-2">{activity.description}</p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">No contact selected.</div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notes" className="flex-1 overflow-auto">
              <div className="space-y-4">
                <Textarea
                  placeholder="Add notes about this call..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  These notes will be saved with the call record when the call ends.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setShowContactInfo(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={handleEndCall}
              disabled={!isCallActive}
            >
              <Phone className="h-6 w-6 rotate-135" />
              End Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
