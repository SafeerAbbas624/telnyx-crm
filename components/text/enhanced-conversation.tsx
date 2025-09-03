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
import { ArrowLeft, Phone, Mail, Info, Send, User, Building, MapPin, Calendar, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { useSession } from "next-auth/react"
import AssignContactModal from "@/components/admin/assign-contact-modal"
import type { Contact } from "@/lib/types"

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
}

export default function EnhancedConversation({ contact, onBack }: EnhancedConversationProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [selectedSenderNumber, setSelectedSenderNumber] = useState<string>("")
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    loadMessages()
    loadPhoneNumbers()
  }, [contact.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/conversations/${contact.id}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])

        // Use suggested sender number from API (most recent outbound message)
        if (data.suggestedSenderNumber) {
          setSelectedSenderNumber(data.suggestedSenderNumber)
          console.log(`Auto-selected sender number: ${data.suggestedSenderNumber} for contact ${contact.firstName} ${contact.lastName}`)
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        console.log('Available phone numbers:', data)
        const activeNumbers = data.phoneNumbers?.filter((num: TelnyxPhoneNumber) => num.isActive !== false) || data || []
        console.log('Filtered active numbers:', activeNumbers)
        setAvailableNumbers(activeNumbers)

        // Validate that the selected sender number is available
        if (selectedSenderNumber) {
          const isNumberAvailable = activeNumbers.some((num: TelnyxPhoneNumber) => num.phoneNumber === selectedSenderNumber)
          if (!isNumberAvailable) {
            console.warn(`Previously used number ${selectedSenderNumber} is no longer available, falling back to first available`)
            if (activeNumbers.length > 0) {
              setSelectedSenderNumber(activeNumbers[0].phoneNumber)
            }
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

      if (response.ok) {
        const data = await response.json()
        
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
        throw new Error('Failed to send message')
      }
    } catch (error) {
      toast({
        title: "Error sending message",
        description: "Failed to send the message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleCall = async () => {
    if (!selectedSenderNumber) {
      toast({
        title: "Cannot make call",
        description: "Please select a sender number",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/telnyx/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber: selectedSenderNumber,
          toNumber: contact.phone1 || contact.phone2 || contact.phone3,
          contactId: contact.id,
        }),
      })

      if (response.ok) {
        toast({
          title: "Call initiated",
          description: `Calling ${contact.firstName} ${contact.lastName}`,
        })
      } else {
        throw new Error('Failed to initiate call')
      }
    } catch (error) {
      toast({
        title: "Error making call",
        description: "Failed to initiate the call. Please try again.",
        variant: "destructive",
      })
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
            <h3 className="font-semibold truncate">
              {contact.firstName} {contact.lastName}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {contact.phone1} {contact.llcName && `• ${contact.llcName}`}
            </p>
          </div>
          
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCall}>
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleEmail}>
              <Mail className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <AssignContactModal
                contact={contact}
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

      {/* Sender Number Selection */}
      <div className="p-4 border-b" style={{backgroundColor: '#FFFFFF'}}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{color: '#333333'}}>Sending from:</span>
          {availableNumbers.length > 0 ? (
            <Select value={selectedSenderNumber} onValueChange={setSelectedSenderNumber}>
              <SelectTrigger className="w-auto min-w-[200px] bg-white">
                <SelectValue placeholder="Select sender number" />
              </SelectTrigger>
              <SelectContent>
                {availableNumbers.map(number => (
                  <SelectItem key={number.id || number.phoneNumber} value={number.phoneNumber}>
                    <div className="flex items-center gap-2">
                      <span>{number.phoneNumber}</span>
                      {number.friendlyName && (
                        <Badge variant="outline" className="text-xs">
                          {number.friendlyName}
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
    </div>
  )
}
