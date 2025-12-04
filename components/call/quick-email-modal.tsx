"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { isValidEmail } from "@/lib/email-validation"
import type { Contact } from "@/lib/types"

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
}

interface QuickEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  email: string
  emailAccounts: EmailAccount[]
  onEmailSent?: () => void
}

export function QuickEmailModal({
  open,
  onOpenChange,
  contact,
  email,
  emailAccounts,
  onEmailSent
}: QuickEmailModalProps) {
  const { toast } = useToast()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [isSending, setIsSending] = useState(false)

  // Set default account when modal opens
  useEffect(() => {
    if (open && emailAccounts.length > 0 && !selectedAccount) {
      setSelectedAccount(emailAccounts[0].id)
    }
  }, [open, emailAccounts, selectedAccount])

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({ title: 'Error', description: 'Please enter a subject', variant: 'destructive' })
      return
    }

    if (!message.trim()) {
      toast({ title: 'Error', description: 'Please enter a message', variant: 'destructive' })
      return
    }

    if (!isValidEmail(email)) {
      toast({ title: 'Error', description: 'Invalid email address', variant: 'destructive' })
      return
    }

    if (!selectedAccount) {
      toast({ title: 'Error', description: 'Please select an email account', variant: 'destructive' })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject,
          message,
          emailAccountId: selectedAccount,
          contactId: contact?.id
        })
      })

      if (response.ok) {
        toast({ title: 'Success', description: 'Email sent successfully' })
        setSubject("")
        setMessage("")
        onOpenChange(false)
        onEmailSent?.()
      } else {
        const error = await response.json()
        toast({ title: 'Error', description: error.message || 'Failed to send email', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error sending email:', error)
      toast({ title: 'Error', description: 'Failed to send email', variant: 'destructive' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">To:</p>
            <p className="font-semibold">
              {contact?.firstName} {contact?.lastName}
            </p>
            <p className="text-sm text-gray-600">{email}</p>
          </div>

          {/* From Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium">From:</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select email account" />
              </SelectTrigger>
              <SelectContent>
                {emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.displayName} ({account.emailAddress})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject:</label>
            <Input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message:</label>
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim() || !message.trim()}>
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

