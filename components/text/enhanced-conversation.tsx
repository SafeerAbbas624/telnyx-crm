"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, Phone, Mail, Info, Send, User, Building, MapPin, Calendar, MessageSquare, UserPlus, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { useSession } from "next-auth/react"
import AssignContactModal from "@/components/admin/assign-contact-modal"
import { useCallUI } from "@/lib/context/call-ui-context"
import type { Contact } from "@/lib/types"
import { SmsSegmentInfo } from "@/components/sms/sms-segment-info"
import AddContactDialog from "@/components/contacts/add-contact-dialog"
import { useContacts } from "@/lib/context/contacts-context"

import ContactName from "@/components/contacts/contact-name"

interface Message {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  status: string
  fromNumber: string
  toNumber: string
  createdAt: string
}

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  capabilities?: string[]
  totalSmsCount?: number
  totalCallCount?: number
  isActive?: boolean
}

interface EnhancedConversationProps {
  contact: Contact
  onBack?: () => void
  onConversationRead?: () => void  // Callback to refresh conversations list
}

export default function EnhancedConversation({ contact, onBack, onConversationRead }: EnhancedConversationProps) {
  const { data: session } = useSession()
  const { openCall } = useCallUI()
  const { refreshContacts } = useContacts()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [selectedSenderNumber, setSelectedSenderNumber] = useState<string>("")
  const [conversationOurNumber, setConversationOurNumber] = useState<string | null>(null) // The Telnyx line bound to this conversation
  const [selectionReason, setSelectionReason] = useState<string>('') // Why this number was selected
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showAddContactDialog, setShowAddContactDialog] = useState(false)
  const [currentContact, setCurrentContact] = useState<Contact>(contact)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false)  // Track if we've marked messages as read

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'

  // Check if contact is "unknown" (no real name set)
  const isUnknownContact = !currentContact.firstName || currentContact.firstName === 'Unknown' || currentContact.firstName.startsWith('Unknown ')

  // Update currentContact when contact prop changes
  useEffect(() => {
    setCurrentContact(contact)
  }, [contact])

  useEffect(() => {
    // Load messages first to get the suggested sender number, then pass it to loadPhoneNumbers
    // This avoids race condition where loadPhoneNumbers sets fallback before suggestedSenderNumber arrives
    const initialize = async () => {
      const suggestedNumber = await loadMessages()
      await loadPhoneNumbers(suggestedNumber)
    }
    initialize()
  }, [contact.id])

  // Handler for adding a new contact from conversation (for unknown callers)
  const handleAddContact = async (contactData: any) => {
    try {
      // Update the existing contact record with the new details
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          llcName: contactData.llcName,
          email1: contactData.email1,
          propertyAddress: contactData.propertyAddress,
          contactAddress: contactData.contactAddress,
          city: contactData.city,
          state: contactData.state,
          propertyType: contactData.propertyType,
          bedrooms: contactData.bedrooms,
          totalBathrooms: contactData.totalBathrooms,
          buildingSqft: contactData.buildingSqft,
          effectiveYearBuilt: contactData.effectiveYearBuilt,
          estValue: contactData.estValue,
          estEquity: contactData.estEquity,
          tags: contactData.tags,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update contact')
      }

      const updatedContact = await response.json()
      setCurrentContact(updatedContact)
      refreshContacts()

      toast({
        title: "Contact saved",
        description: `${contactData.firstName} ${contactData.lastName || ''} has been saved`,
      })

      setShowAddContactDialog(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save contact",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])


  // Live updates: listen to SSE and refresh/append messages when this contact gets a new SMS
  useEffect(() => {
    const es = new EventSource('/api/events')

    const onInboundSms = (evt: MessageEvent) => {
      try {
        const msg = JSON.parse(evt.data || '{}') as any
        if (!msg || msg.contactId !== contact.id) return
        // If payload has text, optimistically append; otherwise reload
        if (msg.text) {
          const newMsg: Message = {
            id: msg.messageId || `in-${Date.now()}`,
            content: String(msg.text || ''),
            direction: 'inbound',
            status: 'received',
            fromNumber: msg.from || msg.fromNumber || '',
            toNumber: msg.to || msg.toNumber || '',
            createdAt: new Date().toISOString(),
          }
          setMessages(prev => [...prev, newMsg])
        } else {
          loadMessages()
        }
      } catch {
        // ignore parse errors
      }
    }

    const onConversationUpdated = (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data || '{}') as any
        // Only refresh if this contact is affected
        if (payload?.contactId === contact.id) {
          loadMessages()
        }
      } catch {
        // ignore
      }
    }

    es.addEventListener('inbound_sms', onInboundSms as unknown as EventListener)
    es.addEventListener('conversation_updated', onConversationUpdated as unknown as EventListener)

    return () => {
      try {
        es.removeEventListener('inbound_sms', onInboundSms as unknown as EventListener)
        es.removeEventListener('conversation_updated', onConversationUpdated as unknown as EventListener)
        es.close()
      } catch {}
    }
  }, [contact.id])

  // Returns the suggested sender number from the API so we can pass it to loadPhoneNumbers
  const loadMessages = async (): Promise<string | null> => {
    setIsLoading(true)
    let suggestedNumber: string | null = null
    try {
      const response = await fetch(`/api/conversations/${contact.id}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])

        // Track the conversation's bound Telnyx line (for multi-number routing)
        if (data.conversationOurNumber) {
          setConversationOurNumber(data.conversationOurNumber)
        }

        // Track why this number was selected
        if (data.selectionReason) {
          setSelectionReason(data.selectionReason)
        }

        // Use suggested sender number from API (smart selection logic)
        if (data.suggestedSenderNumber) {
          setSelectedSenderNumber(data.suggestedSenderNumber)
          suggestedNumber = data.suggestedSenderNumber
          const reasonText = data.selectionReason === 'inbound_response'
            ? '(they responded to this number)'
            : data.selectionReason === 'last_outbound'
            ? '(last number you texted from)'
            : '(from conversation record)'
          console.log(`Auto-selected sender number: ${data.suggestedSenderNumber} for contact ${contact.firstName} ${contact.lastName} ${reasonText}`)
        }

        // FIX: Trigger callback to refresh conversations list after marking as read
        if (!hasMarkedAsRead && data.messages?.length > 0) {
          setHasMarkedAsRead(true)
          // Emit event to refresh conversations list
          if (onConversationRead) {
            onConversationRead()
          }
          // Also broadcast via SSE to update other components
          try {
            const event = new CustomEvent('conversationRead', { detail: { contactId: contact.id } })
            window.dispatchEvent(event)
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setIsLoading(false)
    }
    return suggestedNumber
  }

  // suggestedNumber is passed from loadMessages to avoid race condition with React state
  const loadPhoneNumbers = async (suggestedNumber?: string | null) => {
    try {
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        console.log('Available phone numbers:', data)
        const activeNumbers = data.phoneNumbers?.filter((num: TelnyxPhoneNumber) => num.isActive !== false) || data || []
        console.log('Filtered active numbers:', activeNumbers)
        setAvailableNumbers(activeNumbers)

        // Use the passed suggestedNumber (from loadMessages) to avoid stale state
        const currentSenderNumber = suggestedNumber || selectedSenderNumber
        console.log('Current sender number for validation:', currentSenderNumber)

        // Validate that the selected sender number is available
        if (currentSenderNumber) {
          const isNumberAvailable = activeNumbers.some((num: TelnyxPhoneNumber) => num.phoneNumber === currentSenderNumber)
          if (!isNumberAvailable) {
            console.warn(`Previously used number ${currentSenderNumber} is no longer available, falling back to first available`)
            if (activeNumbers.length > 0) {
              setSelectedSenderNumber(activeNumbers[0].phoneNumber)
            }
          } else {
            console.log(`Keeping suggested sender number: ${currentSenderNumber}`)
          }
        } else if (activeNumbers.length > 0) {
          // Set default sender number if none selected
          setSelectedSenderNumber(activeNumbers[0].phoneNumber)
          console.log(`Fallback to first available number: ${activeNumbers[0].phoneNumber}`)
        }
      } else {
        console.error('Failed to fetch phone numbers:', response.status)
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    }
  }

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSenderNumber) {
      toast({
        title: "Cannot send message",
        description: "Please enter a message and select a sender number",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/telnyx/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber: selectedSenderNumber,
          toNumber: contact.phone1 || contact.phone2 || contact.phone3,
          message: newMessage,
          contactId: contact.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Add message to local state immediately
        const newMsg: Message = {
          id: data.messageId,
          content: newMessage,
          direction: 'outbound',
          status: data.status || 'queued',
          fromNumber: selectedSenderNumber,
          toNumber: contact.phone1 || contact.phone2 || contact.phone3 || '',
          createdAt: new Date().toISOString(),
        }

        setMessages(prev => [...prev, newMsg])
        setNewMessage("")

        toast({
          title: "Message sent",
          description: "Your message has been sent successfully",
        })
      } else {
        // Show specific error from API
        toast({
          title: "Cannot send message",
          description: data.error || 'Failed to send message',
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error?.message || "Failed to send the message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleCall = async () => {
    if (!selectedSenderNumber) {
      toast({ title: "Cannot make call", description: "Please select a sender number", variant: "destructive" })
      return
    }

    const toNumber = contact.phone1 || contact.phone2 || contact.phone3
    if (!toNumber) {
      toast({ title: "No phone", description: "This contact has no phone number.", variant: "destructive" })
      return
    }

    try {
      // Try WebRTC first
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.ensureRegistered()
        const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber: selectedSenderNumber })

        // Log the call to database
        fetch('/api/telnyx/webrtc-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webrtcSessionId: sessionId,
            contactId: contact.id,
            fromNumber: selectedSenderNumber,
            toNumber,
          })
        }).catch(err => console.error('Failed to log call:', err))

        openCall({
          contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
          fromNumber: selectedSenderNumber,
          toNumber,
          mode: 'webrtc',
          webrtcSessionId: sessionId,
        })
        toast({ title: 'Calling (WebRTC)', description: `Calling ${contact.firstName} ${contact.lastName}` })
        return
      } catch (webrtcErr) {
        console.warn('WebRTC attempt failed, falling back to Call Control:', webrtcErr)
      }

      // Fallback to Call Control dial
      const response = await fetch('/api/telnyx/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromNumber: selectedSenderNumber, toNumber, contactId: contact.id }),
      })
      if (!response.ok) throw new Error('Failed to initiate call')
      const data = await response.json()
      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber: selectedSenderNumber,
        toNumber,
        mode: 'call_control',
        telnyxCallId: data.telnyxCallId,
      })
      toast({ title: 'Call initiated', description: `Calling ${contact.firstName} ${contact.lastName}` })
    } catch (error) {
      toast({ title: "Error making call", description: "Failed to initiate the call. Please try again.", variant: "destructive" })
    }
  }

  const handleEmail = () => {
    const email = contact.email1 || contact.email2 || contact.email3
    if (email) {
      window.open(`mailto:${email}`, '_blank')
    } else {
      toast({
        title: "No email address",
        description: "This contact doesn't have an email address",
        variant: "destructive",
      })
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ""
    }
  }

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString()
    } catch {
      return ""
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-400'
      case 'sent': return 'text-blue-200'
      case 'queued': return 'text-yellow-300'
      case 'failed': return 'text-red-300'
      default: return 'text-blue-200'
    }
  }

  const selectedNumber = availableNumbers.find(num => num.phoneNumber === selectedSenderNumber)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {contact.firstName?.[0] || ""}
              {contact.lastName?.[0] || ""}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="text-left w-full">
              <h3 className="font-semibold truncate">
                <ContactName contact={contact as any} clickMode="popup" stopPropagation={false} className="!no-underline underline-offset-2 hover:underline" />
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {contact.phone1} {contact.llcName && `• ${contact.llcName}`}
              </p>
              {conversationOurNumber && (
                <p className="text-xs text-blue-600 truncate">
                  Via: {availableNumbers.find(n => n.phoneNumber === conversationOurNumber)?.friendlyName || conversationOurNumber}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCall}>
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleEmail}>
              <Mail className="h-4 w-4" />
            </Button>
            {/* Add Contact button for unknown contacts */}
            {isUnknownContact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddContactDialog(true)}
                title="Add as Contact"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (
              <AssignContactModal
                contact={currentContact}
                onAssignmentComplete={() => {
                  toast({
                    title: "Success",
                    description: "Contact assigned successfully",
                  })
                }}
                buttonVariant="ghost"
                buttonSize="sm"
                buttonText=""
                trigger={
                  <Button variant="ghost" size="sm" title="Assign Contact to Team">
                    <User className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            <Dialog open={showContactInfo} onOpenChange={setShowContactInfo}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Contact Information</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {contact.firstName?.[0] || ""}
                        {contact.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {contact.firstName} {contact.lastName}
                      </h3>
                      {contact.llcName && (
                        <p className="text-muted-foreground">{contact.llcName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {contact.phone1 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.phone1}</span>
                      </div>
                    )}
                    {contact.email1 && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.email1}</span>
                      </div>
                    )}
                    {contact.llcName && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.llcName}</span>
                      </div>
                    )}
                    {contact.propertyAddress && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.propertyAddress}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => {
                      setShowContactInfo(false)
                      // Navigate to dashboard - you might want to implement this
                      window.location.href = `/dashboard?contact=${contact.id}`
                    }}
                  >
                    <User className="h-4 w-4 mr-2" />
                    View Full Profile
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Sender Number Selection - Enhanced with warnings */}
      <div className="p-4 border-b" style={{backgroundColor: '#FFFFFF'}}>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium" style={{color: '#333333'}}>Sending from:</span>
            {availableNumbers.length > 0 ? (
              <Select
                value={selectedSenderNumber}
                onValueChange={(newNumber) => {
                  // Warn if changing from the conversation's original number
                  if (conversationOurNumber && newNumber !== conversationOurNumber) {
                    toast({
                      title: "⚠️ Changing Sender Number",
                      description: `You're switching from ${conversationOurNumber} to ${newNumber}. The contact may receive messages from a different number.`,
                      variant: "default",
                      duration: 5000,
                    })
                  }
                  setSelectedSenderNumber(newNumber)
                }}
              >
                <SelectTrigger className="w-auto min-w-[200px] bg-white border-2">
                  <SelectValue placeholder="Select sender number" />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.map(number => (
                    <SelectItem key={number.id || number.phoneNumber} value={number.phoneNumber}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{number.phoneNumber}</span>
                        {number.friendlyName && (
                          <Badge variant="outline" className="text-xs">
                            {number.friendlyName}
                          </Badge>
                        )}
                        {conversationOurNumber === number.phoneNumber && (
                          <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                            {selectionReason === 'inbound_response'
                              ? 'They Replied To'
                              : selectionReason === 'last_outbound'
                              ? 'Last Sent'
                              : 'Original'}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded">
                Loading phone numbers...
              </div>
            )}
          </div>

          {/* Warning if using different number than the recommended one */}
          {conversationOurNumber && selectedSenderNumber &&
           // Compare normalized phone numbers (last 10 digits) to avoid false positives from formatting differences
           conversationOurNumber.replace(/\D/g, '').slice(-10) !== selectedSenderNumber.replace(/\D/g, '').slice(-10) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <strong>Warning:</strong> {selectionReason === 'inbound_response'
                  ? `They last responded to ${conversationOurNumber}`
                  : `Last message sent from ${conversationOurNumber}`}.
                You're now sending from <strong>{selectedSenderNumber}</strong>.
                They may be confused receiving messages from multiple numbers.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4" style={{backgroundColor: '#FFFFFF'}}>
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation by sending a message</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const prevMessage = messages[index - 1]
              const showDateSeparator = !prevMessage ||
                formatDate(message.createdAt) !== formatDate(prevMessage.createdAt)

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <div className="text-xs px-3 py-1 rounded-full" style={{backgroundColor: '#FFFFFF', color: '#666666', border: '1px solid #E5E5E5'}}>
                        {formatDate(message.createdAt)}
                      </div>
                    </div>
                  )}
                  <div className={`flex ${message.direction === 'inbound' ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.direction === 'inbound'
                          ? "border border-gray-200"
                          : ""
                      }`}
                      style={{
                        backgroundColor: message.direction === 'inbound' ? '#FFFFFF' : '#5896EB',
                        color: message.direction === 'inbound' ? '#333333' : '#FFFFFF'
                      }}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <div
                          className="text-xs"
                          style={{
                            color: message.direction === 'inbound' ? '#999999' : '#E6F2FF'
                          }}
                        >
                          {formatTime(message.createdAt)}
                        </div>
                        {message.direction === 'outbound' && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs" style={{color: '#E6F2FF', borderColor: '#E6F2FF'}}>
                              {message.fromNumber}
                            </Badge>
                            <span className={`text-xs ${getStatusColor(message.status)}`}>
                              {message.status}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            rows={2}
            className="flex-1 resize-none border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isSending || !newMessage.trim() || !selectedSenderNumber}
            size="sm"
            className="text-white hover:opacity-90"
            style={{backgroundColor: '#5896EB'}}
          >
            {isSending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {/* SMS Segment Info - shows character count, segments, encoding, and cost */}
        {newMessage && (
          <div className="mt-2">
            <SmsSegmentInfo message={newMessage} compact={true} showCost={true} />
          </div>
        )}
        {selectedNumber && (
          <div className="text-xs mt-2 flex items-center gap-1" style={{color: '#333333'}}>
            <span>Sending from</span>
            <Badge variant="outline" className="text-xs" style={{borderColor: '#5896EB', color: '#5896EB'}}>
              {selectedNumber.phoneNumber}
            </Badge>
            {selectedNumber.friendlyName && (
              <span style={{color: '#666666'}}>({selectedNumber.friendlyName})</span>
            )}
          </div>
        )}
      </div>

      {/* Add Contact Dialog - for unknown inbound texters */}
      <AddContactDialogWithPhone
        open={showAddContactDialog}
        onOpenChange={setShowAddContactDialog}
        onAddContact={handleAddContact}
        prefillPhone={contact.phone1 || contact.phone2 || contact.phone3 || ''}
      />
    </div>
  )
}

// Custom AddContactDialog that pre-fills phone number
function AddContactDialogWithPhone({
  open,
  onOpenChange,
  onAddContact,
  prefillPhone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddContact: (contact: any) => void
  prefillPhone: string
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    llcName: "",
    phone: prefillPhone,
    email: "",
    propertyAddress: "",
    contactAddress: "",
    city: "",
    state: "",
    propertyType: "",
    bedrooms: "",
    totalBathrooms: "",
    buildingSqft: "",
    effectiveYearBuilt: "",
    estValue: "",
    estEquity: "",
    tags: [] as any[],
  })

  // Reset form when dialog opens with prefilled phone
  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, phone: prefillPhone }))
    }
  }, [open, prefillPhone])

  const propertyTypes = [
    "Single-family (SFH)",
    "Duplex",
    "Triplex",
    "Quadplex",
    "Multi-family",
    "Townhouse",
    "Condo",
    "Mobile Home",
    "Land",
    "Commercial",
  ]

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    return digits
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fullName.trim()) {
      return
    }

    const toNumber = (v: string) => (v && v.trim() !== "" ? Number(v) : undefined)

    const nameParts = formData.fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || ""
    const lastName = nameParts.slice(1).join(" ") || ""

    const contactData: any = {
      firstName,
      lastName: lastName || undefined,
      llcName: formData.llcName || undefined,
      phone1: formData.phone,
      email1: formData.email || undefined,
      propertyAddress: formData.propertyAddress || undefined,
      contactAddress: formData.contactAddress || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      propertyType: formData.propertyType || undefined,
      bedrooms: toNumber(formData.bedrooms),
      totalBathrooms: toNumber(formData.totalBathrooms),
      buildingSqft: toNumber(formData.buildingSqft),
      effectiveYearBuilt: toNumber(formData.effectiveYearBuilt),
      estValue: toNumber(formData.estValue),
      estEquity: toNumber(formData.estEquity),
      tags: formData.tags,
    }

    onAddContact(contactData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Contact Details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name *</label>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">LLC Name</label>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.llcName}
              onChange={(e) => setFormData(p => ({ ...p, llcName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm bg-muted"
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                readOnly
              />
              <p className="text-xs text-muted-foreground">Pre-filled from conversation</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Property Address</label>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.propertyAddress}
              onChange={(e) => setFormData(p => ({ ...p, propertyAddress: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">City</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.city}
                onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">State</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="NY"
                value={formData.state}
                onChange={(e) => setFormData(p => ({ ...p, state: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Contact</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
