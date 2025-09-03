"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, MessageCircle, Phone } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { formatDistanceToNow } from "date-fns"
import { useContacts } from "@/lib/context/contacts-context"
import NewTextMessageModal from "./new-text-message-modal"
import type { Contact } from "@/lib/types"

interface ConversationData {
  id: string
  contact_id: string
  phone_number: string
  last_message_at?: string
  last_message_direction?: 'inbound' | 'outbound'
  last_sender_number?: string
  unread_count: number
  contact: {
    id: string
    firstName: string
    lastName: string
    email1?: string
    phone1?: string
    llcName?: string
    propertyAddress?: string
  }
  lastMessage?: {
    id: string
    content: string
    direction: 'inbound' | 'outbound'
    status: string
    fromNumber: string
    toNumber: string
    createdAt: string
  }
  hasUnread: boolean
  isNewMessage: boolean
}

interface EnhancedConversationsListProps {
  selectedContactId?: string
  onSelectContact: (contact: Contact) => void
}

export default function EnhancedConversationsList({
  selectedContactId,
  onSelectContact,
}: EnhancedConversationsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [conversations, setConversations] = useState<ConversationData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Load conversations with live search
  useEffect(() => {
    loadConversations()
  }, [debouncedSearchQuery])

  // Auto-refresh conversations every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations()
    }, 30000)
    return () => clearInterval(interval)
  }, [debouncedSearchQuery])

  const loadConversations = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearchQuery.trim()) {
        params.set('search', debouncedSearchQuery.trim())
      }
      
      const response = await fetch(`/api/conversations?${params}`)
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContactSelect = (conversation: ConversationData) => {
    const contact: Contact = {
      id: conversation.contact.id,
      firstName: conversation.contact.firstName,
      lastName: conversation.contact.lastName,
      email1: conversation.contact.email1,
      phone1: conversation.contact.phone1,
      llcName: conversation.contact.llcName,
      propertyAddress: conversation.contact.propertyAddress,
      // Add other required Contact fields with defaults
      email2: null,
      email3: null,
      phone2: null,
      phone3: null,
      email2: null,
      email3: null,
      city: null,
      state: null,
      propertyCity: null,
      propertyState: null,
      propertyZip: null,
      propertyCounty: null,
      propertyType: null,
      bedrooms: null,
      totalBathrooms: null,
      buildingSqft: null,
      effectiveYearBuilt: null,
      estValue: null,
      estEquity: null,
      dnc: null,
      dncReason: null,
      dealStatus: null,
      notes: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    onSelectContact(contact)
  }

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + "..."
  }

  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return ""
    }
  }

  const getMessagePreview = (conversation: ConversationData) => {
    if (!conversation.lastMessage) {
      return {
        text: "No messages yet",
        time: "",
        isInbound: false,
        senderNumber: ""
      }
    }

    const msg = conversation.lastMessage
    return {
      text: truncateMessage(msg.content),
      time: formatMessageTime(msg.createdAt),
      isInbound: msg.direction === 'inbound',
      senderNumber: msg.direction === 'outbound' ? msg.fromNumber : ""
    }
  }

  // Sort conversations: unread first, then by most recent message
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // Unread conversations first
      if (a.hasUnread && !b.hasUnread) return -1
      if (!a.hasUnread && b.hasUnread) return 1
      
      // Then by most recent message
      const aTime = a.lastMessage?.createdAt || a.last_message_at || ""
      const bTime = b.lastMessage?.createdAt || b.last_message_at || ""
      
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }, [conversations])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search conversations..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setShowNewMessageModal(true)}
            title="Send new message"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {isLoading && (
          <div className="text-sm text-muted-foreground">Searching...</div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {sortedConversations.map((conversation) => {
            const preview = getMessagePreview(conversation)
            const isSelected = selectedContactId === conversation.contact.id
            
            return (
              <div
                key={conversation.id}
                className={`p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-50 border-l-3 border-blue-500"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => handleContactSelect(conversation)}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                        {conversation.contact.firstName?.[0] || ""}
                        {conversation.contact.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.hasUnread && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-medium">
                          {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                        </span>
                      </div>
                    )}
                    {conversation.isNewMessage && (
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    {/* Header row with name and time */}
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-medium truncate pr-2 ${
                        conversation.hasUnread ? "font-semibold" : ""
                      }`}>
                        {conversation.contact.firstName} {conversation.contact.lastName}
                      </h3>
                      <div className="flex-shrink-0">
                        {preview.time && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {preview.time}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Phone number row */}
                    <div className="flex items-center gap-1 mb-2">
                      <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {conversation.contact.phone1}
                      </span>
                      {conversation.contact.llcName && (
                        <>
                          <span className="text-muted-foreground text-xs">•</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {conversation.contact.llcName}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Message preview row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {preview.isInbound ? (
                          <MessageCircle className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        ) : (
                          <div className="h-3 w-3 flex-shrink-0">
                            <div className="h-2 w-2 bg-gray-400 rounded-full ml-0.5" />
                          </div>
                        )}
                        <span className={`text-sm truncate ${
                          conversation.hasUnread && preview.isInbound
                            ? "font-medium text-gray-900"
                            : "text-muted-foreground"
                        }`}>
                          {preview.text}
                        </span>
                      </div>

                      {preview.senderNumber && (
                        <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                          {preview.senderNumber}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          
          {sortedConversations.length === 0 && !isLoading && (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">No conversations found</p>
              <p className="text-sm">
                {searchQuery.trim() 
                  ? "Try adjusting your search terms" 
                  : "Start a conversation by sending a message"
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New Message Modal */}
      <NewTextMessageModal
        open={showNewMessageModal}
        onOpenChange={setShowNewMessageModal}
        onMessageSent={() => {
          // Refresh conversations after sending message
          loadConversations()
        }}
      />
    </div>
  )
}
