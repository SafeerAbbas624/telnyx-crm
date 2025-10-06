"use client"

import { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useNotifications } from "@/lib/context/notifications-context"
import { Search, Send, MessageSquare, Phone, Plus } from "lucide-react"
import SimpleAddActivityDialog from "@/components/activities/simple-add-activity-dialog"
import ContactName from "@/components/contacts/contact-name"
import NewTextMessageModal from "@/components/text/new-text-message-modal"

import { formatDistanceToNow } from "date-fns"

interface Conversation {
  id: string
  contact: {
    id: string
    firstName: string
    lastName: string
    phone1?: string
    llcName?: string
  }
  phoneNumber: string
  lastMessage?: {
    id: string
    content: string
    direction: 'inbound' | 'outbound'
    timestamp: string
  }
  lastMessageAt?: string
  lastMessageContent?: string
  lastMessageDirection?: 'inbound' | 'outbound'
  messageCount: number
  unreadCount: number
  hasUnread: boolean
}

interface Message {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  timestamp: string
  status: string
}

export default function TeamConversations() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { add: addNotification } = useNotifications()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 150)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  const cacheRef = useRef<Map<string, any>>(new Map())
  const [isSearching, setIsSearching] = useState(false)
  const [messageContent, setMessageContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    loadConversations()
  }, [debouncedSearch])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
    }
  }, [selectedConversation])

  // If redirected here via toast click, auto-open the intended conversation
  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('openConvContactId') : null
    if (!id) return
    ;(async () => {
      try {
        await loadConversations()
        const target = conversationsRef.current.find(c => c.contact.id === id)
        if (target) setSelectedConversation(target)
      } finally {
        try { localStorage.removeItem('openConvContactId') } catch {}
      }
    })()
  }, [])

  // Real-time updates via SSE
  useEffect(() => {
    const es = new EventSource('/api/events')

    const checkAccess = async (contactId?: string) => {
      if (!contactId) return false
      try {
        const res = await fetch(`/api/contacts/${contactId}`)
        return res.ok
      } catch { return false }
    }

    const onInboundSms = async (evt: MessageEvent) => {
      let msg: any = null
      try { msg = JSON.parse(evt.data || '{}') } catch {}
      loadConversations()
      if (selectedConversation && msg?.contactId === selectedConversation.contact.id) {
        loadMessages(selectedConversation.id)
      }
      if (await checkAccess(msg?.contactId)) {
        const name = msg?.contactName || 'Unknown'
        const preview = (msg?.text || '').toString().slice(0, 60)
        const contactId: string | undefined = msg?.contactId
        const globalActive = (typeof window !== 'undefined' && (window as any).__GLOBAL_SSE_ACTIVE)
        if (!globalActive) {
          addNotification({ kind: 'sms', contactId, contactName: name, preview })
          toast({
            title: `New message from ${name}`,
            description: preview || 'New SMS received',
            className: 'cursor-pointer',
            onClick: () => {
              if (contactId) {
                try { localStorage.setItem('openConvContactId', contactId) } catch {}
                try { window.location.assign('/team-dashboard') } catch {}
              }
            }
          })
        }
      }
    }

    const onInboundEmail = async (evt: MessageEvent) => {
      let em: any = null
      try { em = JSON.parse(evt.data || '{}') } catch {}
      if (await checkAccess(em?.contactId)) {
        const name = em?.contactName || em?.fromEmail || 'Unknown'
        const preview = (em?.subject || em?.preview || '').toString().slice(0, 80)
        const contactId: string | undefined = em?.contactId
        const globalActive = (typeof window !== 'undefined' && (window as any).__GLOBAL_SSE_ACTIVE)
        if (!globalActive) {
          addNotification({ kind: 'email', contactId, contactName: name, preview, fromEmail: em?.fromEmail })
          toast({
            title: `New email from ${name}`,
            description: preview || 'New email received',
            className: 'cursor-pointer',
            onClick: () => {
              if (contactId) {
                try { localStorage.setItem('openEmailContactId', contactId) } catch {}
                try { window.location.assign('/team-dashboard') } catch {}
              }
            }
          })
        }
      }
    }

    const onConvUpdate = () => loadConversations()

    es.addEventListener('inbound_sms', onInboundSms as any)
    es.addEventListener('conversation_updated', onConvUpdate as any)
    es.addEventListener('inbound_email', onInboundEmail as any)

    return () => {
      es.removeEventListener('inbound_sms', onInboundSms as any)
      es.removeEventListener('conversation_updated', onConvUpdate as any)
      es.removeEventListener('inbound_email', onInboundEmail as any)
      es.close()
    }
  }, [selectedConversation])

  const loadConversations = async () => { setIsSearching(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }

      if (fetchAbortRef.current) { try { fetchAbortRef.current.abort() } catch {} }
      const controller = new AbortController()
      fetchAbortRef.current = controller

      const cacheKey = params.toString()
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setConversations(cached.conversations || [])
      }

      const response = await fetch(`/api/team/conversations?${params}`, { signal: controller.signal })
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
        cacheRef.current.set(cacheKey, { conversations: data.conversations || [] })
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoading(false)
      setIsSearching(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/team/conversations/${conversationId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const sendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation || !session?.user?.assignedPhoneNumber) {
      toast({
        title: 'Error',
        description: 'Please enter a message and ensure you have an assigned phone number',
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/team/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedConversation.contact.id,
          conversationId: selectedConversation.id,
          message: messageContent.trim(),
          phoneNumber: selectedConversation.phoneNumber,
        }),
      })

      if (response.ok) {
        // Optimistically update UI: move the conversation to top with latest message
        const nowIso = new Date().toISOString()
        setConversations(prev => {
          const updated = prev.map(c => c.id === selectedConversation.id ? {
            ...c,
            lastMessageContent: messageContent.trim(),
            lastMessageAt: nowIso,
            lastMessageDirection: 'outbound',
            messageCount: (c.messageCount || 0) + 1
          } : c)
          // Put the updated conversation at the top
          const current = updated.find(c => c.id === selectedConversation.id)
          const others = updated.filter(c => c.id !== selectedConversation.id)
          const resorted = [current!, ...others]
          return resorted
        })
        // Also update selectedConversation in state
        setSelectedConversation(prev => prev ? {
          ...prev,
          lastMessageContent: messageContent.trim(),
          lastMessageAt: nowIso,
          lastMessageDirection: 'outbound',
          messageCount: (prev.messageCount || 0) + 1
        } : prev)

        setMessageContent("")
        loadMessages(selectedConversation.id)
        loadConversations() // Refresh conversation list from server to confirm order
        toast({
          title: 'Success',
          description: 'Message sent successfully',
        })
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'Failed to send message',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleActivityAdded = () => {
    // Refresh conversations to show updated activity count
    loadConversations()
    toast({
      title: 'Success',
      description: 'Activity added successfully',
    })
  }

  const getMessagePreview = (conversation: Conversation) => {
    const lastMessage = conversation.lastMessage || {
      content: conversation.lastMessageContent || 'No messages yet',
      direction: conversation.lastMessageDirection || 'outbound',
      timestamp: conversation.lastMessageAt || new Date().toISOString(),
    }

    const time = lastMessage.timestamp
      ? formatDistanceToNow(new Date(lastMessage.timestamp), { addSuffix: true })
      : ''

    return {
      content: lastMessage.content,
      time,
      isInbound: lastMessage.direction === 'inbound',
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex max-h-full overflow-hidden">
      {/* Conversations List */}
      <div className={`${isMobile ? "w-full" : "w-1/3 border-r"} flex flex-col`}>
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex gap-2 items-start">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search conversations..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (<div className="text-xs text-muted-foreground mt-1">Searching...</div>)}
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
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="divide-y">
            {conversations.map((conversation) => {
              const preview = getMessagePreview(conversation)
              const isSelected = selectedConversation?.id === conversation.id

              return (
                <div
                  key={conversation.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-l-3 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
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
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-medium truncate pr-2 ${conversation.hasUnread ? "font-semibold" : ""}`}>
                          <ContactName contact={{...conversation.contact} as any} clickMode="popup" />
                        </h3>
                        {preview.time && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {preview.time}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          {conversation.phoneNumber}
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

                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${
                          conversation.hasUnread && preview.isInbound
                            ? "font-medium text-gray-900"
                            : "text-muted-foreground"
                        }`}>
                          {preview.isInbound ? "" : "You: "}{preview.content}
                        </span>
                        <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                          {conversation.messageCount}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {conversations.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">No conversations found</p>
                <p className="text-sm">
                  {searchQuery.trim()
                    ? "Try adjusting your search terms"
                    : "Conversations with your assigned contacts will appear here"
                  }
                </p>
              </div>
            )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Messages View */}
      {!isMobile && (
        <div className="w-2/3 flex flex-col h-full max-h-full overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {selectedConversation.contact.firstName?.[0] || ""}
                        {selectedConversation.contact.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">
                        <ContactName contact={{...selectedConversation.contact} as any} clickMode="popup" />
                      </h2>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{selectedConversation.phoneNumber}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowActivityDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Activity
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <div
                  ref={messagesScrollRef}
                  className="h-full p-4 overflow-y-auto"
                >
                  <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.direction === 'outbound'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.direction === 'outbound'
                            ? 'text-primary-foreground/70'
                            : 'text-gray-500'
                        }`}>
                          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {messages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Send the first message to start the conversation</p>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Message Input */}
              <div className="border-t p-4 flex-shrink-0">
                {!session?.user?.assignedPhoneNumber ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      No phone number assigned. Contact your admin to assign a phone number.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyDown={handleKeyPress}
                      rows={2}
                      className="resize-none"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={isSending || !messageContent.trim()}
                      className="flex items-center gap-2"
                    >
                      {isSending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
                {session?.user?.assignedPhoneNumber && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Sending from: {session.user.assignedPhoneNumber} • Ctrl+Enter to send
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Activity Dialog */}
      {selectedConversation && (
        <SimpleAddActivityDialog
          open={showActivityDialog}
          onOpenChange={setShowActivityDialog}
          contactId={selectedConversation.contact.id}
          contactName={`${selectedConversation.contact.firstName} ${selectedConversation.contact.lastName}`}
          onActivityAdded={handleActivityAdded}
        />
      )}

      {/* New Message Modal (same as admin text center) */}
      <NewTextMessageModal
        open={showNewMessageModal}
        onOpenChange={setShowNewMessageModal}
        onMessageSent={() => {
          loadConversations()
        }}
      />
    </div>
  )
}
