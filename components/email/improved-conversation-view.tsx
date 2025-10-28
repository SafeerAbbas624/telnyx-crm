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
  X,
  Image as ImageIcon,
  File
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import RichTextEditor from './rich-text-editor'
import { useEmailUpdates } from '@/lib/hooks/use-socket'
import { validateEmails, getEmailValidationError } from '@/lib/email-validation'

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
  attachments?: Array<{
    filename: string
    contentType: string
    size: number
    url?: string
  }>
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

interface EmailConversation {
  id: string
  isStarred: boolean
  isArchived: boolean
  deletedAt: string | null
}

interface ImprovedConversationViewProps {
  conversationId: string
  emailAccount: EmailAccount
  contact: Contact
  onBack: () => void
  onUpdate?: () => void
}

export default function ImprovedConversationView({
  conversationId,
  emailAccount,
  contact,
  onBack,
  onUpdate
}: ImprovedConversationViewProps) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [conversation, setConversation] = useState<EmailConversation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [replyContent, setReplyContent] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyTo, setReplyTo] = useState<string[]>([])
  const [replyCc, setReplyCc] = useState<string[]>([])
  const [replyBcc, setReplyBcc] = useState<string[]>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [replyType, setReplyType] = useState<'reply' | 'replyAll' | 'forward'>('reply')
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [replyBoxHeight, setReplyBoxHeight] = useState(300)
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)

  // Real-time updates
  const { newEmailCount } = useEmailUpdates(emailAccount.id)

  useEffect(() => {
    fetchConversation()
    fetchMessages()
  }, [conversationId, newEmailCount])

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load draft from localStorage when reply box opens
  useEffect(() => {
    if (showReplyBox && conversationId) {
      const draftKey = `reply-draft-${conversationId}`
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft)
          setReplyContent(draft.replyContent || '')
          setReplySubject(draft.replySubject || '')
          setReplyTo(draft.replyTo || [])
          setReplyCc(draft.replyCc || [])
          setReplyBcc(draft.replyBcc || [])
          setShowCc(draft.replyCc && draft.replyCc.length > 0)
          setShowBcc(draft.replyBcc && draft.replyBcc.length > 0)
        } catch (err) {
          console.error('Failed to load draft:', err)
        }
      }
    }
  }, [showReplyBox, conversationId])

  // Auto-save draft to localStorage every 5 seconds
  useEffect(() => {
    if (!showReplyBox || !conversationId) return

    const draftKey = `reply-draft-${conversationId}`
    const saveDraft = () => {
      const draft = {
        replyContent,
        replySubject,
        replyTo,
        replyCc,
        replyBcc,
        timestamp: Date.now()
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
    }

    const intervalId = setInterval(saveDraft, 5000) // Save every 5 seconds

    return () => clearInterval(intervalId)
  }, [showReplyBox, conversationId, replyContent, replySubject, replyTo, replyCc, replyBcc])

  // Resizable reply box with mouse events
  useEffect(() => {
    const resizeHandle = resizeHandleRef.current
    if (!resizeHandle) return

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
    }

    resizeHandle.addEventListener('mousedown', handleMouseDown)
    return () => {
      resizeHandle.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const newHeight = containerRect.bottom - e.clientY
      const clampedHeight = Math.max(200, Math.min(600, newHeight))
      setReplyBoxHeight(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/email/conversations/${conversationId}`)
      if (response.ok) {
        const data = await response.json()
        setConversation(data.conversation)
      }
    } catch (error) {
      console.error('Error fetching conversation:', error)
    }
  }

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/email/conversations/${conversationId}/messages?accountId=${emailAccount.id}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])

        // Expand the last message by default
        if (data.messages && data.messages.length > 0) {
          setExpandedMessages(new Set([data.messages[data.messages.length - 1].id]))
        }

        // Auto-mark all unread messages as read
        if (data.messages && data.messages.length > 0) {
          const unreadMessageIds = data.messages
            .filter((msg: EmailMessage) => !msg.openedAt && msg.direction === 'inbound')
            .map((msg: EmailMessage) => msg.id)

          if (unreadMessageIds.length > 0) {
            markMessagesAsRead(unreadMessageIds)
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error response:', errorData)
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to load messages',
          variant: 'destructive',
        })
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

  const markMessagesAsRead = async (messageIds: string[]) => {
    try {
      const response = await fetch('/api/email/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, isRead: true })
      })

      if (response.ok) {
        // Update local state
        setMessages(prev => prev.map(msg =>
          messageIds.includes(msg.id)
            ? { ...msg, openedAt: new Date().toISOString() }
            : msg
        ))
        // Notify parent to refresh conversation list
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error marking messages as read:', error)
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

  const handleReply = (message?: EmailMessage, type: 'reply' | 'replyAll' | 'forward' = 'reply') => {
    const targetMessage = message || messages[messages.length - 1]
    if (!targetMessage) return

    setReplyType(type)
    
    if (type === 'forward') {
      setReplySubject(targetMessage.subject.startsWith('Fwd:') ? targetMessage.subject : `Fwd: ${targetMessage.subject}`)
      setReplyTo([])
      setReplyCc([])
      const quotedContent = `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
        <p><strong>---------- Forwarded message ---------</strong></p>
        <p><strong>From:</strong> ${targetMessage.fromName || targetMessage.fromEmail}</p>
        <p><strong>Date:</strong> ${targetMessage.sentAt ? new Date(targetMessage.sentAt).toLocaleString() : ''}</p>
        <p><strong>Subject:</strong> ${targetMessage.subject}</p>
        <p><strong>To:</strong> ${targetMessage.toEmails.join(', ')}</p>
        <br>${targetMessage.content}</div>`
      setReplyContent(quotedContent)
    } else {
      setReplySubject(targetMessage.subject.startsWith('Re:') ? targetMessage.subject : `Re: ${targetMessage.subject}`)
      
      if (type === 'replyAll') {
        // Reply All: include all recipients except yourself
        const allRecipients = [...targetMessage.toEmails, ...(targetMessage.ccEmails || [])]
        const uniqueRecipients = Array.from(new Set(allRecipients))
          .filter(email => email !== emailAccount.emailAddress)
        setReplyTo([targetMessage.fromEmail])
        setReplyCc(uniqueRecipients.filter(email => email !== targetMessage.fromEmail))
      } else {
        // Reply: only to sender
        setReplyTo([targetMessage.fromEmail])
        setReplyCc([])
      }
      
      const quotedReply = `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
        <p>On ${targetMessage.sentAt ? new Date(targetMessage.sentAt).toLocaleString() : ''}, ${targetMessage.fromName || targetMessage.fromEmail} wrote:</p>
        ${targetMessage.content}</div>`
      setReplyContent(quotedReply)
    }

    // Show reply box
    setShowReplyBox(true)

    // Add signature
    if (emailAccount.signature) {
      setReplyContent(prev => `<br><br><div style="color: #666; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">${emailAccount.signature.replace(/\n/g, '<br>')}</div>${prev}`)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setAttachments(prev => [...prev, ...newFiles])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
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

    if (replyType === 'forward' && replyTo.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter at least one recipient',
        variant: 'destructive',
      })
      return
    }

    // Validate email addresses
    const emailsToValidate = replyTo.length > 0 ? replyTo : [contact.email1]
    const validation = validateEmails(emailsToValidate)

    if (!validation.allValid) {
      toast({
        title: 'Invalid Email Address',
        description: getEmailValidationError(validation.invalid),
        variant: 'destructive',
      })
      return
    }

    // Validate CC emails if present
    if (replyCc.length > 0) {
      const ccValidation = validateEmails(replyCc)
      if (!ccValidation.allValid) {
        toast({
          title: 'Invalid CC Email Address',
          description: getEmailValidationError(ccValidation.invalid),
          variant: 'destructive',
        })
        return
      }
    }

    // Validate BCC emails if present
    if (replyBcc.length > 0) {
      const bccValidation = validateEmails(replyBcc)
      if (!bccValidation.allValid) {
        toast({
          title: 'Invalid BCC Email Address',
          description: getEmailValidationError(bccValidation.invalid),
          variant: 'destructive',
        })
        return
      }
    }

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append('emailAccountId', emailAccount.id)
      formData.append('contactId', contact.id)
      formData.append('toEmails', JSON.stringify(replyTo.length > 0 ? replyTo : [contact.email1]))
      formData.append('ccEmails', JSON.stringify(replyCc))
      formData.append('bccEmails', JSON.stringify(replyBcc))
      formData.append('subject', replySubject)
      formData.append('content', replyContent)
      formData.append('textContent', replyContent.replace(/<[^>]*>/g, ''))

      // Add attachments
      attachments.forEach((file) => {
        formData.append('attachments', file)
      })

      const response = await fetch('/api/email/send', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast({
          title: '✅ Email Sent!',
          description: 'Your email has been sent successfully'
        })

        // Clear draft from localStorage
        if (conversationId) {
          const draftKey = `reply-draft-${conversationId}`
          localStorage.removeItem(draftKey)
        }

        // Clear form but keep reply box visible
        setReplyContent('')
        setReplySubject('')
        setReplyTo([])
        setReplyCc([])
        setReplyBcc([])
        setShowCc(false)
        setShowBcc(false)
        setAttachments([])
        setReplyType('reply')
        fetchMessages()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send email')
      }
    } catch (error: any) {
      toast({
        title: '❌ Failed to Send',
        description: error.message || 'Failed to send email',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

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

  const handleToggleStar = async () => {
    try {
      const response = await fetch(`/api/email/conversations/${conversationId}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !conversation?.isStarred })
      })

      if (response.ok) {
        fetchConversation()
        onUpdate?.()
        toast({
          title: conversation?.isStarred ? 'Unstarred' : 'Starred',
          description: conversation?.isStarred ? 'Conversation unstarred' : 'Conversation starred'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update conversation',
        variant: 'destructive',
      })
    }
  }

  const handleToggleArchive = async () => {
    try {
      const response = await fetch(`/api/email/conversations/${conversationId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !conversation?.isArchived })
      })

      if (response.ok) {
        fetchConversation()
        onUpdate?.()
        toast({
          title: conversation?.isArchived ? 'Unarchived' : 'Archived',
          description: conversation?.isArchived ? 'Conversation moved to inbox' : 'Conversation archived'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update conversation',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/email/conversations/${conversationId}/delete`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Deleted',
          description: 'Conversation moved to trash'
        })
        onBack()
        onUpdate?.()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      })
    }
  }

  const filteredMessages = messages.filter(msg =>
    searchQuery === '' ||
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleStar}
              className={cn(conversation?.isStarred && "text-yellow-500")}
            >
              <Star className={cn("h-4 w-4", conversation?.isStarred && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleArchive}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
            >
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

      {/* Messages - Scrollable area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-6 py-4">
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

                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            📎 {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {message.attachments.map((attachment, idx) => (
                              <a
                                key={idx}
                                href={attachment.url || `/api/email/attachments/download?url=${encodeURIComponent(attachment.url || '')}`}
                                download={attachment.filename}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                title={`Download ${attachment.filename}`}
                              >
                                {attachment.contentType?.startsWith('image/') ? (
                                  <ImageIcon className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <File className="h-4 w-4 text-blue-600" />
                                )}
                                <span className="text-sm font-medium text-blue-900">{attachment.filename}</span>
                                <span className="text-xs text-blue-600">
                                  ({(attachment.size / 1024).toFixed(1)} KB)
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReply(message, 'reply')
                          }}
                        >
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReply(message, 'replyAll')
                          }}
                        >
                          <ReplyAll className="h-4 w-4 mr-2" />
                          Reply All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReply(message, 'forward')
                          }}
                        >
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
      </div>

      {/* Reply Box */}
      {showReplyBox && (
        <div
          className="border-t bg-white flex-shrink-0 flex flex-col"
          style={{ height: `${replyBoxHeight}px` }}
        >
          {/* Resize Handle */}
          <div
            ref={resizeHandleRef}
            className="h-2 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center transition-colors"
          >
            <div className="w-12 h-1 bg-gray-400 rounded-full"></div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                {replyType === 'forward' ? 'Forward' : replyType === 'replyAll' ? 'Reply All' : 'Reply'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReplyBox(false)
                  setReplyType('reply')
                  setReplyContent('')
                  setReplySubject('')
                  setReplyTo([])
                  setReplyCc([])
                  setAttachments([])
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {replyType === 'forward' && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600">To</label>
                  <div className="flex gap-2">
                    {!showCc && (
                      <button
                        type="button"
                        onClick={() => setShowCc(true)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button
                        type="button"
                        onClick={() => setShowBcc(true)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Bcc
                      </button>
                    )}
                  </div>
                </div>
                <Input
                  value={replyTo.join(', ')}
                  onChange={(e) => setReplyTo(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="email@example.com"
                />
              </div>
            )}

            {showCc && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600">Cc</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCc(false)
                      setReplyCc([])
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Remove
                  </button>
                </div>
                <Input
                  value={replyCc.join(', ')}
                  onChange={(e) => setReplyCc(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Comma-separated email addresses..."
                />
              </div>
            )}

            {showBcc && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600">Bcc</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBcc(false)
                      setReplyBcc([])
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Remove
                  </button>
                </div>
                <Input
                  value={replyBcc.join(', ')}
                  onChange={(e) => setReplyBcc(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Comma-separated email addresses..."
                />
              </div>
            )}

            <Input
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              placeholder="Subject"
              className="mb-3"
            />

            <div className="flex-1 overflow-hidden mb-3">
              <RichTextEditor
                content={replyContent}
                onChange={setReplyContent}
                placeholder="Type your message..."
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
                    <Paperclip className="h-3 w-3" />
                    <span className="text-sm">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                      Send
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reply Button - Only show if reply box is not visible */}
      {!showReplyBox && (
        <div className="border-t bg-white p-4 flex-shrink-0">
          <Button
            onClick={() => handleReply(undefined, 'reply')}
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

