"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Send, AtSign, Clock, Mail, MoreVertical, Reply, Forward, Archive, User, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import AssignContactModal from "@/components/admin/assign-contact-modal"
import ContactName from "@/components/contacts/contact-name"

import type { Contact } from "@/lib/types"

interface EmailConversationProps {
  contact: Contact
  emailAccounts: Array<{
    id: string
    emailAddress: string
    displayName: string
    isDefault: boolean
    status: string
  }>
}

interface EmailMessage {
  id: string
  messageId?: string
  fromEmail: string
  fromName?: string
  toEmails: string[]
  ccEmails: string[]
  bccEmails: string[]
  subject: string
  content: string
  textContent?: string
  direction: 'inbound' | 'outbound'
  status: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  createdAt: string
}

export default function EmailConversation({ contact, emailAccounts }: EmailConversationProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string>("")

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'
  const [subject, setSubject] = useState("")
  const [emailContent, setEmailContent] = useState("")
  const [ccEmails, setCcEmails] = useState("")
  const [bccEmails, setBccEmails] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Set default email account
  useEffect(() => {
    const defaultAccount = emailAccounts.find(acc => acc.isDefault) || emailAccounts[0]
    if (defaultAccount) {
      setSelectedAccount(defaultAccount.id)
    }
  }, [emailAccounts])

  // Check if we have email accounts for sending
  const canSendEmails = emailAccounts.length > 0

  // Load messages for this contact
  useEffect(() => {
    if (contact.id) {
      loadMessages()
      // Auto-sync emails when conversation opens
      syncEmails()
    }
  }, [contact.id])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/email/messages?contactId=${contact.id}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading email messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const syncEmails = async () => {
    try {
      console.log('Syncing emails...')
      const response = await fetch('/api/email/sync', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        console.log('Email sync result:', data)
        // Reload messages after sync
        setTimeout(() => loadMessages(), 1000)
      }
    } catch (error) {
      console.error('Error syncing emails:', error)
    }
  }

  const sendEmail = async () => {
    if (!emailContent.trim() || !subject.trim() || !selectedAccount) {
      toast({
        title: 'Error',
        description: 'Please fill in subject, message, and select an email account',
        variant: 'destructive',
      })
      return
    }

    const recipientEmail = contact.email1
    if (!recipientEmail) {
      toast({
        title: 'Error',
        description: 'Contact does not have an email address',
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
          emailAccountId: selectedAccount,
          contactId: contact.id,
          toEmails: [recipientEmail],
          ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
          bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
          subject: subject.trim(),
          content: emailContent.trim(),
        }),
      })

      let data: any = null
      try { data = await response.json() } catch {}

      if (response.ok || data?.success) {
        setEmailContent("")
        setSubject("")
        setCcEmails("")
        setBccEmails("")
        setShowCcBcc(false)
        loadMessages() // Reload to show sent message
        toast({
          title: 'Success',
          description: data?.message || 'Email sent successfully',
        })
      } else {
        toast({
          title: 'Error',
          description: data?.error || data?.message || 'Failed to send email',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      sendEmail()
    }
  }

  const formatEmailAddresses = (emails: string[]) => {
    return emails.join(', ')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {contact.firstName?.[0] || ""}
                {contact.lastName?.[0] || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">
                <ContactName contact={contact} clickMode="popup" />
              </h2>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <AtSign className="h-3 w-3" />
                <span>{contact.email1}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {messages.length} emails
            </Badge>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={syncEmails}
              title="Sync Emails"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className={`${
              message.direction === 'outbound'
                ? 'ml-8 bg-primary/5 border-primary/20'
                : 'mr-8'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {message.direction === 'outbound' ? 'You' :
                         (message.fromName?.[0] || message.fromEmail[0])}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">
                        {message.direction === 'outbound'
                          ? 'You'
                          : (message.fromName || message.fromEmail)
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">
                        To: {formatEmailAddresses(message.toEmails)}
                        {message.ccEmails.length > 0 && (
                          <span> • CC: {formatEmailAddresses(message.ccEmails)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {message.deliveredAt || message.sentAt || message.createdAt
                        ? format(new Date(message.deliveredAt || message.sentAt || message.createdAt), 'MMM d, h:mm a')
                        : 'Unknown time'
                      }
                    </span>
                    {message.status && (
                      <Badge variant="outline" className="text-xs">
                        {message.status}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2">{message.subject}</h4>
                </div>

                <div
                  className="prose prose-sm max-w-none whitespace-pre-wrap"
                  style={{ wordBreak: 'break-word' }}
                  dangerouslySetInnerHTML={{
                    __html: message.content
                      .replace(/\n/g, '<br>')
                      .replace(/On .+? wrote:/g, '<br><br><div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; background-color: #f9fafb; padding: 12px; border-radius: 6px; color: #6b7280;"><strong>$&</strong><br>')
                      .replace(/^>/gm, '<div style="border-left: 3px solid #ccc; padding-left: 10px; margin: 5px 0; color: #666;">')
                  }}
                />

                {message.direction === 'inbound' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <Reply className="h-3 w-3" />
                      Reply
                    </Button>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <Forward className="h-3 w-3" />
                      Forward
                    </Button>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <Archive className="h-3 w-3" />
                      Archive
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No email conversation yet</p>
              <p className="text-sm">Send the first email to start the conversation</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Compose Email */}
      <div className="border-t border-gray-200 p-4">
        {!canSendEmails ? (
          <div className="text-center py-6">
            <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">No email accounts configured</p>
            <p className="text-xs text-muted-foreground">
              Add an email account in the Email Center header to start sending emails
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Email Account Selection */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">From:</span>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-auto min-w-[200px]">
                  <SelectValue placeholder="Select email account" />
                </SelectTrigger>
                <SelectContent>
                  {emailAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span>{account.displayName}</span>
                        <span className="text-muted-foreground text-xs">
                          ({account.emailAddress})
                        </span>
                        {account.isDefault && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          {/* Subject */}
          <div>
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="font-medium"
            />
          </div>

          {/* CC/BCC */}
          {showCcBcc && (
            <div className="space-y-2">
              <Input
                placeholder="CC (comma separated)"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
              />
              <Input
                placeholder="BCC (comma separated)"
                value={bccEmails}
                onChange={(e) => setBccEmails(e.target.value)}
              />
            </div>
          )}

          {/* Message */}
          <div>
            <Textarea
              placeholder="Type your email message..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={4}
              className="resize-none"
            />
          </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                >
                  CC/BCC
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Ctrl+Enter to send
                </span>
                <Button
                  onClick={sendEmail}
                  disabled={isSending || !emailContent.trim() || !subject.trim()}
                  className="flex items-center gap-2"
                >
                  {isSending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
