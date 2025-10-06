'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Settings,
  User,
  Clock,
  Trash2,
  Plus,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { NewEmailModal } from './new-email-modal'
import EnhancedEmailModal from './enhanced-email-modal'
import EnhancedEmailConversation from './enhanced-email-conversation'
import { useEmailUpdates } from '@/lib/hooks/use-socket'

// Format email content to handle quoted replies properly
function formatEmailContent(content: string): string {
  if (!content) return ''

  // Handle HTML content
  if (content.includes('<') && content.includes('>')) {
    // For HTML content, add proper line breaks and formatting
    return content
      .replace(/\n/g, '<br>')
      .replace(/On .+? wrote:/g, '<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; margin: 10px 0; color: #666;"><strong>$&</strong><br>')
      .replace(/^>/gm, '<div style="border-left: 3px solid #ccc; padding-left: 10px; margin: 5px 0; color: #666;">')
      .replace(/<div style="border-left[^>]*>$/gm, '$&</div>')
  }

  // Split content by common email reply patterns
  const lines = content.split('\n')
  let formattedLines: string[] = []
  let inQuotedSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect quoted sections (lines starting with > or common reply patterns)
    if (line.match(/^>/) ||
        line.match(/^On .* wrote:/) ||
        line.match(/^From:/) ||
        line.match(/^Sent:/) ||
        line.match(/^To:/) ||
        line.match(/^Subject:/)) {

      if (!inQuotedSection) {
        // Start quoted section with better styling
        formattedLines.push('<div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; background-color: #f9fafb; padding: 12px; border-radius: 6px; color: #6b7280;">')
        inQuotedSection = true
      }

      // Clean up the quoted line and add proper line breaks
      const cleanLine = line.replace(/^>+\s*/, '').trim()
      if (cleanLine) {
        formattedLines.push(cleanLine + '<br>')
      }

    } else if (inQuotedSection && line.trim() === '') {
      // Empty line in quoted section
      formattedLines.push('<br>')
    } else if (inQuotedSection && !line.match(/^>/)) {
      // End of quoted section
      formattedLines.push('</div>')
      inQuotedSection = false
      if (line.trim()) {
        formattedLines.push(line + '<br>')
      }
    } else {
      // Regular line - add line breaks for better formatting
      if (line.trim()) {
        formattedLines.push(line + '<br>')
      } else {
        formattedLines.push('<br>')
      }
    }
  }

  // Close quoted section if still open
  if (inQuotedSection) {
    formattedLines.push('</div>')
  }

  // Join lines with proper line breaks
  return formattedLines.join('<br>').replace(/<br><br>/g, '<br>')
}

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  isDefault: boolean
  status: string
}

interface EmailConversation {
  id: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email1: string
  }
  emailAddress: string
  lastMessage?: {
    id: string
    subject: string
    content: string
    direction: 'inbound' | 'outbound'
    createdAt: string
  }
  messageCount: number
  unreadCount: number
  hasUnread: boolean
}

interface EmailMessage {
  id: string
  messageId: string
  from: string
  fromName: string
  to: string[]
  subject: string
  content: string
  textContent: string
  direction: 'inbound' | 'outbound'
  createdAt: string
  isRead: boolean
}

interface EmailConversationsGmailProps {
  emailAccounts: EmailAccount[]
}

export function EmailConversationsGmail({ emailAccounts }: EmailConversationsGmailProps) {
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<EmailConversation | null>(null)
  const [conversations, setConversations] = useState<EmailConversation[]>([])
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [isAccountsVisible, setIsAccountsVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [replySubject, setReplySubject] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isNewEmailModalOpen, setIsNewEmailModalOpen] = useState(false)
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [replyCardHeight, setReplyCardHeight] = useState(200) // Default height
  const [isDragging, setIsDragging] = useState(false)
  const replyCardRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Real-time email updates via Socket.IO
  const { newEmailCount, resetCount } = useEmailUpdates(selectedAccount?.id)

  // Reload conversations when new emails arrive
  useEffect(() => {
    if (newEmailCount > 0 && selectedAccount) {
      console.log(`📧 [REAL-TIME] ${newEmailCount} new email(s) received, reloading conversations...`)
      loadConversations()
      resetCount()
    }
  }, [newEmailCount, selectedAccount])

  // Handle reply card resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !replyCardRef.current) return

    const rect = replyCardRef.current.getBoundingClientRect()
    const newHeight = rect.bottom - e.clientY

    // Set minimum and maximum heights - more flexible
    const minHeight = 120
    const maxHeight = 600

    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setReplyCardHeight(newHeight)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Add event listeners for drag functionality
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  // Auto-select first account
  useEffect(() => {
    if (emailAccounts.length > 0 && !selectedAccount) {
      const defaultAccount = emailAccounts.find(acc => acc.isDefault) || emailAccounts[0]
      setSelectedAccount(defaultAccount)
    }
  }, [emailAccounts, selectedAccount])

  // Load conversations when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadConversations()
    }
  }, [selectedAccount])

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages()
    }
  }, [selectedConversation])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight
    }
  }

  // Auto-sync emails like Gmail
  useEffect(() => {
    if (!selectedAccount || !isAutoSyncEnabled) return

    // Initial sync when account changes
    syncEmails(false)

    // Set up polling for new emails every 30 seconds
    const interval = setInterval(() => {
      syncEmails(false) // Silent sync, only show toast for new emails
    }, 30000) // 30 seconds like Gmail

    return () => clearInterval(interval)
  }, [selectedAccount, isAutoSyncEnabled])

  // Sync function (both manual and auto)
  const syncEmails = async (showToast = true) => {
    if (!selectedAccount || isSyncing) return

    try {
      setIsSyncing(true)

      // Add timeout to fetch request - reduced to 25 seconds
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

      const response = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount.id
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setLastSyncTime(new Date())

        if (showToast && data.synced > 0) {
          toast({
            title: 'New Emails',
            description: `${data.synced} new emails received`,
            duration: 3000
          })
        }

        // Refresh conversations
        await loadConversations()

        // If viewing a conversation, refresh its messages
        if (selectedConversation) {
          loadMessages()
        }
      } else if (response.status === 504) {
        // Gateway timeout - sync is still running in background
        console.log('Sync timeout - will complete in background')
        setLastSyncTime(new Date())

        // Still refresh conversations after a delay
        setTimeout(async () => {
          await loadConversations()
          if (selectedConversation) {
            loadMessages()
          }
        }, 5000)

        if (showToast) {
          toast({
            title: 'Sync In Progress',
            description: 'Email sync is taking longer than usual. Emails will appear shortly.',
            duration: 5000
          })
        }
      } else {
        throw new Error('Sync failed')
      }
    } catch (error: any) {
      console.error('Sync error:', error)

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        console.log('Sync timeout - will complete in background')
        setLastSyncTime(new Date())

        // Still refresh conversations after a delay
        setTimeout(async () => {
          await loadConversations()
          if (selectedConversation) {
            loadMessages()
          }
        }, 5000)

        if (showToast) {
          toast({
            title: 'Sync In Progress',
            description: 'Email sync is taking longer than usual. Emails will appear shortly.',
            duration: 5000
          })
        }
      } else if (showToast) {
        toast({
          title: 'Error',
          description: 'Failed to sync emails. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSyncing(false)
    }
  }

  // Manual sync function
  const handleManualSync = () => syncEmails(true)

  const loadConversations = async () => {
    if (!selectedAccount) return
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/email/conversations?accountId=${selectedAccount.id}`)
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!selectedConversation) return

    try {
      setIsLoadingMessages(true)
      const response = await fetch(`/api/email/conversations/${selectedConversation.id}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      } else {
        throw new Error('Failed to load messages')
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const filteredConversations = conversations.filter(conv =>
    conv.contact.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.email1.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.lastMessage?.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-200px)] max-h-[800px]">
      {/* Email Accounts Sidebar */}
      <div className={cn(
        "transition-all duration-300 border-r bg-muted/30",
        isAccountsVisible ? "w-64" : "w-12"
      )}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            {isAccountsVisible && (
              <h3 className="font-semibold text-sm">Email Accounts</h3>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAccountsVisible(!isAccountsVisible)}
            >
              {isAccountsVisible ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2">
              {emailAccounts.map((account) => (
                <div
                  key={account.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    selectedAccount?.id === account.id 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedAccount(account)}
                >
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail className="h-4 w-4" />
                  </div>
                  {isAccountsVisible && (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{account.displayName}</p>
                      <p className="text-xs opacity-70 truncate">{account.emailAddress}</p>
                      {account.isDefault && (
                        <Badge variant="outline" className="text-xs mt-1">Default</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Conversations List */}
      <div className="w-80 border-r bg-background">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              <h2 className="font-semibold">
                {selectedAccount ? selectedAccount.displayName : 'Select Account'}
              </h2>
              {isSyncing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              )}
              {/* Compact status info */}
              {lastSyncTime && (
                <div className="text-xs text-muted-foreground">
                  Last sync: {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Auto-sync status indicator */}
              <div className={cn(
                "w-2 h-2 rounded-full",
                isAutoSyncEnabled ? "bg-green-500" : "bg-gray-400"
              )} />

              {/* Manual sync button with auto-sync toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="relative"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", isSyncing && "animate-spin")} />
                {isSyncing ? 'Syncing...' : 'Sync'}
              </Button>

              {/* Auto-sync toggle (small) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                className="h-8 w-8 p-0"
                title={isAutoSyncEnabled ? 'Disable auto-sync' : 'Enable auto-sync'}
              >
                {isAutoSyncEnabled ? '⏸️' : '▶️'}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setIsNewEmailModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Email
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading conversations...</p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Conversations</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? 'No conversations match your search.' : 'No email conversations found.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors",
                    selectedConversation?.id === conversation.id 
                      ? "bg-muted" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {conversation.contact.firstName[0]}{conversation.contact.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">
                          {conversation.contact.firstName} {conversation.contact.lastName}
                        </p>
                        <div className="flex items-center gap-2">
                          {conversation.hasUnread && (
                            <Badge variant="default" className="text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{conversation.contact.email1}</p>
                      {conversation.lastMessage && (
                        <>
                          <p className="font-medium text-sm truncate mb-1">
                            {conversation.lastMessage.subject || 'No Subject'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage.content}
                          </p>
                        </>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {conversation.messageCount} messages
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Message Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    {selectedConversation.contact.firstName} {selectedConversation.contact.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground">{selectedConversation.contact.email1}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this conversation?')) {
                        try {
                          const response = await fetch(`/api/email/conversations/${selectedConversation?.id}`, {
                            method: 'DELETE'
                          })

                          if (response.ok) {
                            toast({
                              title: "Success",
                              description: "Conversation deleted successfully"
                            })
                            // Remove from conversations list
                            setConversations(prev => prev.filter(c => c.id !== selectedConversation?.id))
                            setSelectedConversation(null)
                            setMessages([])
                          } else {
                            throw new Error('Failed to delete conversation')
                          }
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to delete conversation",
                            variant: "destructive"
                          })
                        }
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesScrollRef}
              className="flex-1 p-4 overflow-y-auto"
            >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Messages</h3>
                    <p className="text-muted-foreground text-sm">
                      No messages found in this conversation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                  <Card key={message.id} className={cn(
                    "max-w-4xl",
                    message.direction === 'outbound' ? "ml-auto bg-primary/5" : ""
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {message.direction === 'outbound' ? 'Me' : message.fromName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {message.direction === 'outbound' ? 'Me' : message.fromName}
                            </p>
                            <p className="text-xs text-muted-foreground">{message.from}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </p>
                          <Badge variant={message.direction === 'outbound' ? 'default' : 'secondary'} className="text-xs mt-1">
                            {message.direction === 'outbound' ? 'Sent' : 'Received'}
                          </Badge>
                        </div>
                      </div>
                      {/* Subject Box */}
                      {message.subject && message.subject !== 'No Subject' && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3 rounded">
                          <div className="text-sm font-medium text-blue-800">Subject:</div>
                          <div className="text-blue-700">{message.subject}</div>
                        </div>
                      )}

                      {/* Message Content - Full height, no scrolling */}
                      <div className="prose prose-sm max-w-none">
                        <div
                          className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{ wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{
                            __html: formatEmailContent(message.textContent || message.content)
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Reply/Compose Card - Outside ScrollArea */}
            <div
              ref={replyCardRef}
              className="p-4 pt-0 pb-16 bg-background relative"
              style={{ height: `${replyCardHeight}px` }}
            >
              {/* Drag Handle - More Visible */}
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-3 cursor-ns-resize bg-transparent hover:bg-blue-100 transition-colors border-t border-gray-200",
                  isDragging && "bg-blue-200"
                )}
                onMouseDown={handleMouseDown}
                title="Drag to resize reply area"
              >
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-1">
                  <div className="w-6 h-0.5 bg-gray-400 rounded-full" />
                  <div className="w-6 h-0.5 bg-gray-400 rounded-full" />
                  <div className="w-6 h-0.5 bg-gray-400 rounded-full" />
                </div>
              </div>

              <Card className="bg-gray-50 h-full">
                <CardContent className="p-4 h-full overflow-y-auto">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={selectedConversation ? "Reply subject..." : "Email subject..."}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message
                      </label>
                      <textarea
                        rows={4}
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={selectedConversation ? "Type your reply..." : "Type your message..."}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        {selectedConversation ? `Replying to: ${selectedConversation.contact.email1}` : 'New Email'}
                      </div>
                      <div className="space-x-2">
                        <button
                          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                          onClick={() => {
                            setReplySubject('')
                            setReplyMessage('')
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          disabled={isSending || !replySubject.trim() || !replyMessage.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={async () => {
                            if (!selectedAccount) {
                              toast({
                                title: "Error",
                                description: "No email account selected",
                                variant: "destructive"
                              })
                              return
                            }

                            setIsSending(true)
                            try {
                              const response = await fetch('/api/email/send', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  emailAccountId: selectedAccount.id,
                                  contactId: selectedConversation?.contact.id,
                                  toEmails: [selectedConversation?.contact.email1 || ''],
                                  subject: replySubject,
                                  content: replyMessage.replace(/\n/g, '<br>'),
                                  textContent: replyMessage
                                })
                              })

                              let data: any = null
                              try { data = await response.json() } catch {}
                              if (response.ok || data?.success) {
                                toast({
                                  title: "Success",
                                  description: data?.message || (selectedConversation ? "Reply sent successfully" : "Email sent successfully")
                                })
                                setReplySubject('')
                                setReplyMessage('')
                                // Refresh messages if replying
                                if (selectedConversation) {
                                  fetchMessages(selectedConversation.id)
                                }
                              } else {
                                throw new Error(data?.error || data?.message || 'Failed to send email')
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to send email",
                                variant: "destructive"
                              })
                            } finally {
                              setIsSending(false)
                            }
                          }}
                        >
                          {isSending ? 'Sending...' : (selectedConversation ? 'Send Reply' : 'Send Email')}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Conversation</h3>
              <p className="text-muted-foreground">
                Choose a conversation from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Email Modal */}
      <EnhancedEmailModal
        isOpen={isNewEmailModalOpen}
        onClose={() => setIsNewEmailModalOpen(false)}
        emailAccount={selectedAccount}
        onEmailSent={() => {
          // Refresh conversations after sending email
          if (selectedAccount) {
            loadConversations()
          }
        }}
      />
    </div>
  )
}
