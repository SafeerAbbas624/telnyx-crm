'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Star,
  Archive,
  Trash2,
  MoreVertical,
  Search,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Send,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import RichTextEditor from './rich-text-editor'
import { useEmailUpdates } from '@/lib/hooks/use-socket'

interface EmailMessage {
  id: string
  messageId: string
  subject: string
  fromEmail: string
  fromName: string
  toEmails: string[]
  ccEmails?: string[]
  content: string
  textContent?: string
  direction: 'inbound' | 'outbound'
  status: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  createdAt: string
}

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  signature?: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email1: string
}

interface RedesignedConversationViewProps {
  conversationId: string
  emailAccount: EmailAccount
  contact: Contact
  onBack: () => void
}

export default function RedesignedConversationView({
  conversationId,
  emailAccount,
  contact,
  onBack
}: RedesignedConversationViewProps) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Real-time updates
  const { newEmailCount } = useEmailUpdates(emailAccount.id)

  useEffect(() => {
    fetchMessages()
  }, [conversationId, newEmailCount])

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/email/conversations/${conversationId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        
        // Expand the last message by default
        if (data.messages && data.messages.length > 0) {
          setExpandedMessages(new Set([data.messages[data.messages.length - 1].id]))
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMessageExpanded = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const handleReply = (message?: EmailMessage) => {
    if (message) {
      setReplySubject(message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`)
    } else {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage) {
        setReplySubject(lastMessage.subject.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject}`)
      }
    }
    
    // Add signature
    if (emailAccount.signature) {
      setReplyContent(`<br><br><div style="color: #666; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">${emailAccount.signature.replace(/\n/g, '<br>')}</div>`)
    }
    
    setShowReplyBox(true)
  }

  const handleSendReply = async () => {
    if (!replyContent.trim() || !replySubject.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a subject and message',
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAccountId: emailAccount.id,
          contactId: contact.id,
          toEmails: [contact.email1],
          ccEmails: [],
          bccEmails: [],
          subject: replySubject,
          content: replyContent,
          textContent: replyContent.replace(/<[^>]*>/g, '')
        })
      })

      if (response.ok) {
        toast({
          title: '✅ Reply Sent!',
          description: 'Your reply has been sent successfully'
        })
        setShowReplyBox(false)
        setReplyContent('')
        setReplySubject('')
        fetchMessages()
      } else {
        throw new Error('Failed to send reply')
      }
    } catch (error: any) {
      toast({
        title: '❌ Failed to Send',
        description: error.message || 'Failed to send reply',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const filteredMessages = messages.filter(msg =>
    searchQuery === '' ||
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getInitials = () => {
    return `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase() || 'U'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading conversation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-600 text-white font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {contact.firstName} {contact.lastName}
              </h2>
              <p className="text-sm text-gray-500">{contact.email1}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Star className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in conversation..."
            className="pl-10 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? 'No messages match your search' : 'No messages in this conversation'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMessages.map((message) => {
              const isExpanded = expandedMessages.has(message.id)
              const isOutbound = message.direction === 'outbound'
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    "border rounded-lg overflow-hidden transition-all",
                    isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"
                  )}
                >
                  {/* Message Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100"
                    onClick={() => toggleMessageExpanded(message.id)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={cn(
                          "text-white font-semibold text-sm",
                          isOutbound ? "bg-blue-600" : "bg-green-600"
                        )}>
                          {isOutbound ? 'Me' : getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {isOutbound ? 'You' : message.fromName || message.fromEmail}
                          </span>
                          {!isExpanded && (
                            <span className="text-sm text-gray-500 truncate">
                              {message.subject}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isOutbound ? `To: ${message.toEmails.join(', ')}` : `From: ${message.fromEmail}`}
                          {' • '}
                          {message.sentAt && formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {/* Message Content */}
                  {isExpanded && (
                    <div className="p-6 bg-white">
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-2">{message.subject}</h3>
                      </div>
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: message.content }}
                      />
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReply(message)
                          }}
                        >
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                        <Button variant="outline" size="sm">
                          <ReplyAll className="h-4 w-4 mr-2" />
                          Reply All
                        </Button>
                        <Button variant="outline" size="sm">
                          <Forward className="h-4 w-4 mr-2" />
                          Forward
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Reply Box */}
      {showReplyBox ? (
        <div className="border-t bg-white p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Reply</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReplyBox(false)
                setReplyContent('')
                setReplySubject('')
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Input
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            placeholder="Subject"
            className="mb-3"
          />
          
          <div className="mb-3">
            <RichTextEditor
              content={replyContent}
              onChange={setReplyContent}
              placeholder="Type your reply..."
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Button
              onClick={handleSendReply}
              disabled={isSending || !replyContent.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm">
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t bg-white p-4 flex-shrink-0">
          <Button
            onClick={() => handleReply()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Reply className="h-4 w-4 mr-2" />
            Reply to this conversation
          </Button>
        </div>
      )}
    </div>
  )
}

