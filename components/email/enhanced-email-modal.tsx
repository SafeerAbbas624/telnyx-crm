'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { X, Send, Paperclip, ChevronDown, ChevronUp, Star, Archive } from 'lucide-react'
import RichTextEditor from './rich-text-editor'
import { useEmailUpdates } from '@/lib/hooks/use-socket'

interface Contact {
  id: string
  firstName: string
  lastName: string
  email1: string
  email2?: string
}

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  signature?: string
}

interface EnhancedEmailModalProps {
  isOpen: boolean
  onClose: () => void
  emailAccount: EmailAccount | null
  onEmailSent: () => void
  replyTo?: {
    messageId: string
    subject: string
    from: string
    content: string
  }
  contactId?: string
  contactEmail?: string
}

export default function EnhancedEmailModal({
  isOpen,
  onClose,
  emailAccount,
  onEmailSent,
  replyTo,
  contactId,
  contactEmail
}: EnhancedEmailModalProps) {
  const { toast } = useToast()
  const [toEmail, setToEmail] = useState('')
  const [ccEmails, setCcEmails] = useState('')
  const [bccEmails, setBccEmails] = useState('')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  // Real-time email updates
  const { newEmailCount } = useEmailUpdates(emailAccount?.id)

  // Initialize with reply data or contact email
  useEffect(() => {
    if (replyTo) {
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
      setToEmail(replyTo.from)
      
      // Add quoted reply
      const quotedReply = `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 10px; color: #666;"><p><strong>On ${new Date().toLocaleDateString()}, ${replyTo.from} wrote:</strong></p>${replyTo.content}</div>`
      setContent(quotedReply)
    } else if (contactEmail) {
      setToEmail(contactEmail)
    }
  }, [replyTo, contactEmail])

  // Add signature when account changes
  useEffect(() => {
    if (emailAccount?.signature && !replyTo) {
      setContent(`<br><br><div style="color: #666; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">${emailAccount.signature.replace(/\n/g, '<br>')}</div>`)
    }
  }, [emailAccount, replyTo])

  // Search contacts
  useEffect(() => {
    if (!toEmail.trim() || toEmail.includes('@')) {
      setShowSuggestions(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoadingContacts(true)
      try {
        const response = await fetch(`/api/contacts?search=${encodeURIComponent(toEmail)}&limit=5`, {
          signal: controller.signal
        })
        if (response.ok) {
          const data = await response.json()
          setContacts(data.contacts || [])
          setShowSuggestions(data.contacts?.length > 0)
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching contacts:', error)
        }
      } finally {
        setIsLoadingContacts(false)
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [toEmail])

  const handleSendEmail = async () => {
    if (!emailAccount) {
      toast({
        title: "Error",
        description: "No email account selected",
        variant: "destructive"
      })
      return
    }

    if (!toEmail.trim() || !subject.trim() || !content.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
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
          emailAccountId: emailAccount.id,
          contactId: contactId || null,
          toEmails: toEmail.split(',').map(e => e.trim()).filter(Boolean),
          ccEmails: ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(Boolean) : [],
          bccEmails: bccEmails ? bccEmails.split(',').map(e => e.trim()).filter(Boolean) : [],
          subject: subject.trim(),
          content: content,
          textContent: content.replace(/<[^>]*>/g, '')
        })
      })

      let data: any = null
      try { data = await response.json() } catch {}

      if (response.ok || data?.success) {
        toast({
          title: "✅ Email Sent!",
          description: data?.message || "Your email has been sent successfully"
        })

        // Reset form
        handleClose()
        onEmailSent()
      } else {
        throw new Error(data?.error || data?.message || 'Failed to send email')
      }
    } catch (error: any) {
      console.error('Send email error:', error)
      toast({
        title: "❌ Failed to Send",
        description: error.message || "Failed to send email. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSending(false)
    }
  }

  const selectContact = (contact: Contact) => {
    setToEmail(contact.email1 || contact.email2 || '')
    setShowSuggestions(false)
  }

  const handleClose = () => {
    setToEmail('')
    setCcEmails('')
    setBccEmails('')
    setSubject('')
    setContent('')
    setShowCc(false)
    setShowBcc(false)
    setShowSuggestions(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {replyTo ? 'Reply to Email' : 'New Email'}
            </span>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {/* From */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 w-16">From:</label>
            <div className="flex-1 text-sm text-gray-800">
              {emailAccount?.displayName} &lt;{emailAccount?.emailAddress}&gt;
            </div>
          </div>

          {/* To */}
          <div className="flex items-center gap-3 relative">
            <label className="text-sm font-medium text-gray-600 w-16">To:</label>
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1"
              />
              {!showCc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCc(true)}
                  className="text-xs"
                >
                  Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBcc(true)}
                  className="text-xs"
                >
                  Bcc
                </Button>
              )}
            </div>

            {/* Contact Suggestions */}
            {showSuggestions && contacts.length > 0 && (
              <div className="absolute top-full left-16 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{contact.email1}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cc */}
          {showCc && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600 w-16">Cc:</label>
              <Input
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCc(false)
                  setCcEmails('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Bcc */}
          {showBcc && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600 w-16">Bcc:</label>
              <Input
                value={bccEmails}
                onChange={(e) => setBccEmails(e.target.value)}
                placeholder="bcc@example.com"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowBcc(false)
                  setBccEmails('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 w-16">Subject:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1"
            />
          </div>

          {/* Rich Text Editor */}
          <div className="mt-4">
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Compose your email..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSendEmail}
              disabled={isSending || !toEmail.trim() || !subject.trim() || !content.trim()}
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
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm">
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

