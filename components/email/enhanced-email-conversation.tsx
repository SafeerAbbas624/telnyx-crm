'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Paperclip
} from 'lucide-react'
import EnhancedEmailModal from './enhanced-email-modal'
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

interface EnhancedEmailConversationProps {
  conversationId: string
  emailAccount: EmailAccount
  onBack: () => void
}

export default function EnhancedEmailConversation({
  conversationId,
  emailAccount,
  onBack
}: EnhancedEmailConversationProps) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState<EmailMessage | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Real-time updates
  const { newEmailCount } = useEmailUpdates(emailAccount.id)

  useEffect(() => {
    fetchMessages()
  }, [conversationId, newEmailCount])

  useEffect(() => {
    // Auto-scroll to bottom on new messages
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
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
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

  const handleReply = (message: EmailMessage) => {
    setReplyToMessage(message)
    setShowReplyModal(true)
  }

  const filteredMessages = messages.filter(msg =>
    searchQuery === '' ||
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getContactEmail = () => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) return ''
    return lastMessage.direction === 'inbound' ? lastMessage.fromEmail : lastMessage.toEmails[0]
  }

  const getContactName = () => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) return 'Unknown'
    return lastMessage.direction === 'inbound' ? lastMessage.fromName : lastMessage.toEmails[0]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
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
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{messages[0]?.subject || 'Conversation'}</h2>
              <p className="text-sm text-gray-500">{getContactName()}</p>
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
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in conversation..."
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? 'No messages match your search' : 'No messages in this conversation'}
            </p>
          </div>
        ) : (
          filteredMessages.map((message, index) => {
            const isExpanded = expandedMessages.has(message.id)
            const isOutbound = message.direction === 'outbound'
            
            return (
              <div
                key={message.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  isExpanded ? 'shadow-md' : 'shadow-sm hover:shadow-md'
                }`}
              >
                {/* Message Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100"
                  onClick={() => toggleMessageExpanded(message.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                      isOutbound ? 'bg-blue-600' : 'bg-green-600'
                    }`}>
                      {isOutbound ? 'Me' : (message.fromName?.[0] || 'U')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {isOutbound ? 'You' : message.fromName || message.fromEmail}
                        </span>
                        {!isExpanded && (
                          <span className="text-sm text-gray-500">
                            {message.subject}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {isOutbound ? `To: ${message.toEmails.join(', ')}` : `From: ${message.fromEmail}`}
                        {' • '}
                        {new Date(message.sentAt || message.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {message.openedAt && (
                      <span className="text-xs text-green-600 font-medium">Read</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Message Content */}
                {isExpanded && (
                  <div className="p-6 bg-white">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReply(message)}
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
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Button */}
      <div className="border-t bg-white px-6 py-4">
        <Button
          onClick={() => {
            const lastMessage = messages[messages.length - 1]
            if (lastMessage) {
              handleReply(lastMessage)
            }
          }}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Reply className="h-4 w-4 mr-2" />
          Reply to this conversation
        </Button>
      </div>

      {/* Reply Modal */}
      {showReplyModal && replyToMessage && (
        <EnhancedEmailModal
          isOpen={showReplyModal}
          onClose={() => {
            setShowReplyModal(false)
            setReplyToMessage(null)
          }}
          emailAccount={emailAccount}
          onEmailSent={() => {
            fetchMessages()
            setShowReplyModal(false)
            setReplyToMessage(null)
          }}
          replyTo={{
            messageId: replyToMessage.messageId,
            subject: replyToMessage.subject,
            from: replyToMessage.fromEmail,
            content: replyToMessage.content
          }}
        />
      )}
    </div>
  )
}

