'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { X, Send } from 'lucide-react'
import { isValidEmail, getEmailValidationError } from '@/lib/email-validation'

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
}

interface NewEmailModalProps {
  isOpen: boolean
  onClose: () => void
  emailAccount: EmailAccount | null
  onEmailSent: () => void
  prefilledContact?: Contact | null
  prefilledEmail?: string
}

export function NewEmailModal({ isOpen, onClose, emailAccount, onEmailSent, prefilledContact, prefilledEmail }: NewEmailModalProps) {
  const [toEmail, setToEmail] = useState('')
  const [ccEmail, setCcEmail] = useState('')
  const [bccEmail, setBccEmail] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { toast } = useToast()

  // Load draft from localStorage on mount and prefill contact if provided
  useEffect(() => {
    if (isOpen && emailAccount) {
      // First, try to prefill with provided contact or email
      if (prefilledContact?.email1) {
        setToEmail(prefilledContact.email1)
      } else if (prefilledEmail) {
        setToEmail(prefilledEmail)
      } else {
        // Otherwise, load draft from localStorage
        const draftKey = `email-draft-${emailAccount.id}`
        const savedDraft = localStorage.getItem(draftKey)
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft)
            setToEmail(draft.toEmail || '')
            setCcEmail(draft.ccEmail || '')
            setBccEmail(draft.bccEmail || '')
            setSubject(draft.subject || '')
            setMessage(draft.message || '')
            setShowCc(!!draft.ccEmail)
            setShowBcc(!!draft.bccEmail)
          } catch (err) {
            console.error('Failed to load draft:', err)
          }
        }
      }
    }
  }, [isOpen, emailAccount, prefilledContact, prefilledEmail])

  // Auto-save draft to localStorage every 5 seconds
  useEffect(() => {
    if (!isOpen || !emailAccount) return

    const draftKey = `email-draft-${emailAccount.id}`
    const saveDraft = () => {
      const draft = {
        toEmail,
        ccEmail,
        bccEmail,
        subject,
        message,
        timestamp: Date.now()
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
    }

    const intervalId = setInterval(saveDraft, 5000) // Save every 5 seconds

    return () => clearInterval(intervalId)
  }, [isOpen, emailAccount, toEmail, ccEmail, bccEmail, subject, message])

  // Live suggestions from database (debounced query)
  useEffect(() => {
    const q = toEmail.trim()
    if (q.length < 2) {
      setFilteredContacts([])
      setShowSuggestions(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal })
        if (resp.ok) {
          const data = await resp.json()
          const contacts = (data.contacts || []) as Contact[]
          setFilteredContacts(contacts)
          setShowSuggestions(contacts.length > 0)
        } else {
          setFilteredContacts([])
          setShowSuggestions(false)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Suggestion fetch error:', err)
        }
      }
    }, 250)

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

    if (!toEmail.trim() || !subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      })
      return
    }

    // Validate email addresses
    const emailToValidate = toEmail.trim()
    if (!isValidEmail(emailToValidate)) {
      toast({
        title: "Invalid Email",
        description: getEmailValidationError([emailToValidate]),
        variant: "destructive"
      })
      return
    }

    // Validate CC emails if present
    const ccEmails = ccEmail.trim() ? ccEmail.split(',').map(e => e.trim()).filter(e => e) : []
    for (const email of ccEmails) {
      if (!isValidEmail(email)) {
        toast({
          title: "Invalid CC Email",
          description: getEmailValidationError([email]),
          variant: "destructive"
        })
        return
      }
    }

    // Validate BCC emails if present
    const bccEmails = bccEmail.trim() ? bccEmail.split(',').map(e => e.trim()).filter(e => e) : []
    for (const email of bccEmails) {
      if (!isValidEmail(email)) {
        toast({
          title: "Invalid BCC Email",
          description: getEmailValidationError([email]),
          variant: "destructive"
        })
        return
      }
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
          toEmails: [toEmail.trim()],
          ccEmails,
          bccEmails,
          subject: subject.trim(),
          content: message.replace(/\n/g, '<br>'),
          textContent: message.trim()
        })
      })

      let data: any = null
      try { data = await response.json() } catch {}

      if (response.ok || data?.success) {
        toast({
          title: "Success",
          description: data?.message || "Email sent successfully"
        })

        // Clear draft from localStorage
        if (emailAccount) {
          const draftKey = `email-draft-${emailAccount.id}`
          localStorage.removeItem(draftKey)
        }

        // Reset form
        setToEmail('')
        setCcEmail('')
        setBccEmail('')
        setShowCc(false)
        setShowBcc(false)
        setSubject('')
        setMessage('')
        onEmailSent()
        onClose()
      } else {
        throw new Error(data?.error || data?.message || 'Failed to send email')
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
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
    setSubject('')
    setMessage('')
    setShowSuggestions(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            New Email
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* From Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From
            </label>
            <Input
              value={emailAccount ? `${emailAccount.displayName} <${emailAccount.emailAddress}>` : ''}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* To Field with Suggestions */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                To
              </label>
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
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="Enter email address..."
              className="w-full"
            />

            {/* Email Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => selectContact(contact)}
                  >
                    <div className="font-medium text-sm">
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {contact.email1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CC Field */}
          {showCc && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Cc
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCc(false)
                    setCcEmail('')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Remove
                </button>
              </div>
              <Input
                type="email"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="Comma-separated email addresses..."
                className="w-full"
              />
            </div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Bcc
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowBcc(false)
                    setBccEmail('')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Remove
                </button>
              </div>
              <Input
                type="email"
                value={bccEmail}
                onChange={(e) => setBccEmail(e.target.value)}
                placeholder="Comma-separated email addresses..."
                className="w-full"
              />
            </div>
          )}

          {/* Subject Field */}}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full"
            />
          </div>

          {/* Message Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <Textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={isSending || !toEmail.trim() || !subject.trim() || !message.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
