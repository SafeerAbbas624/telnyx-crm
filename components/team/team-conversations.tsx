"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Search, Send, MessageSquare, Phone, Plus, Filter, Calendar, X } from "lucide-react"
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
  const debouncedSearch = useDebounce(searchQuery, 500)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  const cacheRef = useRef<Map<string, any>>(new Map())
  const [isSearching, setIsSearching] = useState(false)
  const [messageContent, setMessageContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  // FIX: Store scroll position to preserve it during auto-refresh
  const scrollPositionRef = useRef<number>(0)

  // Date/time filter state
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const debouncedStartDate = useDebounce(customStartDate, 800)
  const debouncedEndDate = useDebounce(customEndDate, 800)
  const [showDateFilter, setShowDateFilter] = useState(false)

  // Stats from API (for ALL conversations, not just paginated)
  const [apiStats, setApiStats] = useState<{
    total: number
    unread: number
    read: number
  }>({ total: 0, unread: 0, read: 0 })

  // Infinite scroll state
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // UX Enhancement: Conversation filters
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all')

  // UX Enhancement: Bulk actions
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set())
  const [bulkActionMode, setBulkActionMode] = useState(false)

  // Track user activity to prevent auto-refresh collision
  const [lastUserActivity, setLastUserActivity] = useState<number>(Date.now())
  const userActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
  }, [debouncedSearch, dateFilter, debouncedStartDate, debouncedEndDate, conversationFilter, directionFilter])

  // FIX: Auto-refresh conversations every 30 seconds while preserving scroll position
  // BUT: Pause auto-refresh if user is actively filtering/scrolling (within last 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastUserActivity

      // Only auto-refresh if user hasn't been active in the last 5 seconds
      if (timeSinceActivity > 5000) {
        // Save current scroll position before refresh
        const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollElement) {
          scrollPositionRef.current = scrollElement.scrollTop
        }
        loadConversations(false, true) // Pass false for loadMore, true for preserveScroll
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [debouncedSearch, dateFilter, debouncedStartDate, debouncedEndDate, lastUserActivity])

  // Infinite scroll: Load more when scrolling near bottom
  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement

      // Mark user as active when scrolling
      setLastUserActivity(Date.now())

      // Load more when user scrolls within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !isLoadingMore && !isLoading) {
        console.log('Loading more conversations...')
        loadConversations(true) // Pass true for loadMore
      }
    }

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [hasMore, isLoadingMore, isLoading])

  // Track user activity when filters change (use debounced dates to avoid flickering)
  useEffect(() => {
    setLastUserActivity(Date.now())
  }, [conversationFilter, directionFilter, dateFilter, debouncedStartDate, debouncedEndDate])

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
                // Unified navigation - go to dashboard messaging section
                try {
                  const url = new URL(window.location.href)
                  url.pathname = '/dashboard'
                  url.searchParams.set('section', 'messaging')
                  url.searchParams.set('contactId', contactId)
                  window.location.assign(url.toString())
                } catch {}
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
                // Unified navigation - go to dashboard email section
                try {
                  const url = new URL(window.location.href)
                  url.pathname = '/dashboard'
                  url.searchParams.set('section', 'email')
                  url.searchParams.set('contactId', contactId)
                  window.location.assign(url.toString())
                } catch {}
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

  const loadConversations = async (loadMore = false, preserveScroll = false) => {
    // Skip reload if custom date filter is selected but dates are incomplete
    if (dateFilter === 'custom' && (!debouncedStartDate || !debouncedEndDate)) {
      return
    }

    if (loadMore) {
      setIsLoadingMore(true)
    } else if (!preserveScroll) {
      setIsSearching(true)
      setIsLoading(true)
    }

    try {
      const params = new URLSearchParams()

      // Set limit and offset for pagination
      const limit = 50
      const offset = loadMore ? conversations.length : 0
      params.set('limit', limit.toString())
      params.set('offset', offset.toString())

      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }

      // Add conversation filter params (read/unread)
      if (conversationFilter !== 'all') {
        params.set('filter', conversationFilter) // 'unread' or 'read'
      }

      // Add direction filter params
      if (directionFilter !== 'all') {
        params.set('direction', directionFilter) // 'inbound' or 'outbound'
      }

      // Add date filter params
      if (dateFilter !== 'all') {
        const now = new Date()
        let startDate: Date | null = null
        let endDate: Date | null = null

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            break
          case 'yesterday':
            const yesterday = new Date(now)
            yesterday.setDate(yesterday.getDate() - 1)
            startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
            endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
            break
          case 'week':
            startDate = new Date(now)
            startDate.setDate(startDate.getDate() - 7)
            endDate = now
            break
          case 'month':
            startDate = new Date(now)
            startDate.setDate(startDate.getDate() - 30)
            endDate = now
            break
          case 'custom':
            if (debouncedStartDate) {
              startDate = new Date(debouncedStartDate)
            }
            if (debouncedEndDate) {
              endDate = new Date(debouncedEndDate)
              endDate.setHours(23, 59, 59)
            }
            break
        }

        if (startDate) params.set('startDate', startDate.toISOString())
        if (endDate) params.set('endDate', endDate.toISOString())
      }

      if (fetchAbortRef.current) { try { fetchAbortRef.current.abort() } catch {} }
      const controller = new AbortController()
      fetchAbortRef.current = controller

      const response = await fetch(`/api/team/conversations?${params}`, { signal: controller.signal })
      if (response.ok && !controller.signal.aborted) {
        const data = await response.json()

        if (!controller.signal.aborted) {
          if (loadMore) {
            setConversations(prev => [...prev, ...(data.conversations || [])])
          } else {
            setConversations(data.conversations || [])
          }
          setHasMore(data.hasMore || false)
          setApiStats({
            total: data.total || 0,
            unread: data.unread || 0,
            read: data.read || 0
          })

          // Restore scroll position if this was a background refresh
          if (preserveScroll && scrollPositionRef.current > 0) {
            setTimeout(() => {
              const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
              if (scrollElement) {
                scrollElement.scrollTop = scrollPositionRef.current
              }
            }, 0)
          }
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      if (loadMore) {
        setIsLoadingMore(false)
      } else {
        setIsLoading(false)
        setIsSearching(false)
        setIsInitialLoad(false)
      }
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

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex max-h-full overflow-hidden">
      {/* Conversations List */}
      <div className={`${isMobile ? "w-full" : "w-1/3 border-r"} flex flex-col relative`}>
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

          {/* Date Filter */}
          <div className="flex gap-2 mt-3 items-center">
            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger className="w-40 h-9">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Range Picker */}
            {dateFilter === 'custom' && (
              <Popover open={showDateFilter} onOpenChange={setShowDateFilter}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Calendar className="h-4 w-4 mr-2" />
                    Pick Dates
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Start Date</label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">End Date</label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={() => setShowDateFilter(false)}
                      className="w-full"
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Clear filters button */}
            {(dateFilter !== 'all' || conversationFilter !== 'all' || directionFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter('all')
                  setCustomStartDate('')
                  setCustomEndDate('')
                  setConversationFilter('all')
                  setDirectionFilter('all')
                }}
                className="h-9"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Stats Display */}
          <div className="flex gap-2 mt-3 px-2">
            <div
              className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                conversationFilter === 'all'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConversationFilter('all')}
            >
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{apiStats.total}</div>
            </div>

            <div
              className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                conversationFilter === 'unread'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConversationFilter('unread')}
            >
              <div className="text-xs text-muted-foreground">Unread</div>
              <div className="text-lg font-semibold text-red-600">{apiStats.unread}</div>
            </div>

            <div
              className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                conversationFilter === 'read'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConversationFilter('read')}
            >
              <div className="text-xs text-muted-foreground">Read</div>
              <div className="text-lg font-semibold text-green-600">{apiStats.read}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden relative">
          {/* Loading overlay - only shows during filter updates, not initial load */}
          {isLoading && !isInitialLoad && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}

          <ScrollArea className="h-full" ref={scrollAreaRef}>
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
