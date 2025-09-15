"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Mail, AtSign } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { formatDistanceToNow } from "date-fns"
import type { Contact } from "@/lib/types"

interface EmailConversationsListProps {
  selectedContactId?: string
  onSelectContact: (contact: Contact) => void
}

interface EmailConversationData {
  id: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email1: string
    email2?: string
    email3?: string
    llcName?: string
  }
  emailAddress: string
  lastMessage?: {
    id: string
    subject: string
    content: string
    direction: 'inbound' | 'outbound'
    createdAt: string
  }
  last_message_at?: string
  last_message_content?: string
  last_message_direction?: 'inbound' | 'outbound'
  message_count: number
  unread_count: number
  hasUnread: boolean
  isNewMessage: boolean
}

export default function EmailConversationsList({
  selectedContactId,
  onSelectContact,
}: EmailConversationsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [conversations, setConversations] = useState<EmailConversationData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debouncedSearchQuery = useDebounce(searchQuery, 150)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<Map<string, any>>(new Map())
  const [isSearching, setIsSearching] = useState(false)

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

  const loadConversations = async () => { setIsSearching(true)
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearchQuery.trim()) {
        params.set('search', debouncedSearchQuery.trim())
      }
      
      if (fetchAbortRef.current) { try { fetchAbortRef.current.abort() } catch {} }
      const controller = new AbortController()
      fetchAbortRef.current = controller

      const cacheKey = params.toString()
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setConversations(cached.conversations || [])
      }

      const response = await fetch(`/api/email/conversations?${params}`, { signal: controller.signal })
      if (response.ok && !controller.signal.aborted) {
        const data = await response.json()
        if (!controller.signal.aborted) {
          setConversations(data.conversations || [])
          cacheRef.current.set(cacheKey, { conversations: data.conversations || [] })
        }
      }
    } catch (error) {
      console.error('Error loading email conversations:', error)
    } finally {
      setIsLoading(false)
      setIsSearching(false)
    }
  }

  const handleContactSelect = (conversation: EmailConversationData) => {
    const contact: Contact = {
      id: conversation.contact.id,
      firstName: conversation.contact.firstName,
      lastName: conversation.contact.lastName,
      email1: conversation.contact.email1,
      email2: conversation.contact.email2,
      email3: conversation.contact.email3,
      llcName: conversation.contact.llcName,
      // Add other required Contact fields with defaults
      phone1: null,
      phone2: null,
      phone3: null,
      propertyAddress: null,
      contactAddress: null,
      city: null,
      state: null,
      propertyCounty: null,
      zip: null,
      propertyValue: null,
      debtOwed: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onSelectContact(contact)
  }

  const getMessagePreview = (conversation: EmailConversationData) => {
    const lastMessage = conversation.lastMessage || {
      subject: conversation.last_message_content || 'No messages yet',
      direction: conversation.last_message_direction || 'outbound',
      createdAt: conversation.last_message_at || new Date().toISOString(),
    }

    const time = lastMessage.createdAt 
      ? formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: true })
      : ''

    return {
      subject: lastMessage.subject || 'No subject',
      time,
      isInbound: lastMessage.direction === 'inbound',
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
              placeholder="Search email conversations..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (<div className="text-xs text-muted-foreground mt-1">Searching...</div>)}
          </div>
          <Button size="icon" variant="outline">
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
                    
                    {/* Email address row */}
                    <div className="flex items-center gap-1 mb-2">
                      <AtSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {conversation.emailAddress}
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
                    
                    {/* Subject preview row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {preview.isInbound ? (
                          <Mail className="h-3 w-3 text-blue-500 flex-shrink-0" />
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
                          {preview.subject}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {conversation.message_count}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          
          {sortedConversations.length === 0 && !isLoading && (
            <div className="p-8 text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">No email conversations found</p>
              <p className="text-sm">
                {searchQuery.trim() 
                  ? "Try adjusting your search terms" 
                  : "Start a conversation by sending an email"
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
