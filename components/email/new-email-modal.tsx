'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { X, Send } from 'lucide-react'

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
}

export function NewEmailModal({ isOpen, onClose, emailAccount, onEmailSent }: NewEmailModalProps) {
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { toast } = useToast()

  // Fetch contacts for email suggestions
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await fetch('/api/contacts')
        if (response.ok) {
          const data = await response.json()
          setContacts(data.contacts || [])
        }
      } catch (error) {
        console.error('Error fetching contacts:', error)
      }
    }

    if (isOpen) {
      fetchContacts()
    }
  }, [isOpen])

  // Filter contacts based on email input
  useEffect(() => {
    if (toEmail.length > 0) {
      const filtered = contacts.filter(contact => 
        contact.email1?.toLowerCase().includes(toEmail.toLowerCase()) ||
        contact.email2?.toLowerCase().includes(toEmail.toLowerCase()) ||
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(toEmail.toLowerCase())
      ).slice(0, 5) // Limit to 5 suggestions
      
      setFilteredContacts(filtered)
      setShowSuggestions(filtered.length > 0 && toEmail.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [toEmail, contacts])

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
          subject: subject.trim(),
          content: message.replace(/\n/g, '<br>'),
          textContent: message.trim()
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Email sent successfully"
        })
        
        // Reset form
        setToEmail('')
        setSubject('')
        setMessage('')
        onEmailSent()
        onClose()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send email')
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To
            </label>
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

          {/* Subject Field */}
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
