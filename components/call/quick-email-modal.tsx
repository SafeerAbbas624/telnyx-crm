"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { isValidEmail } from "@/lib/email-validation"
import { ScheduleSendModal } from "@/components/ui/schedule-send-modal"
import { ChevronDown, Clock } from "lucide-react"
import { format } from "date-fns"
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
  const [showScheduleModal, setShowScheduleModal] = useState(false)

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

  // Schedule send handler
  const handleScheduleSend = async (scheduledAt: Date) => {
    if (!subject.trim()) {
      throw new Error('Please enter a subject')
    }
    if (!message.trim()) {
      throw new Error('Please enter a message')
    }
    if (!selectedAccount) {
      throw new Error('Please select an email account')
    }
    if (!contact?.id) {
      throw new Error('No contact selected')
    }

    const account = emailAccounts.find(a => a.id === selectedAccount)
    if (!account) {
      throw new Error('Email account not found')
    }

    const response = await fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'EMAIL',
        contactId: contact.id,
        scheduledAt: scheduledAt.toISOString(),
        fromEmail: account.emailAddress,
        toEmail: email,
        subject: subject,
        body: `<p>${message.replace(/\n/g, '</p><p>')}</p>`,
        metadata: { source: 'quick_email_modal' },
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to schedule email')
    }

    toast({ title: 'Success', description: `Email scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}` })
    setSubject("")
    setMessage("")
    onOpenChange(false)
    onEmailSent?.()
  }

  return (
    <>
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
            <div className="flex">
              <Button
                onClick={handleSend}
                disabled={isSending || !subject.trim() || !message.trim()}
                className="rounded-r-none"
              >
                {isSending ? 'Sending...' : 'Send Email'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={isSending || !subject.trim() || !message.trim()}
                    className="rounded-l-none border-l border-blue-400 px-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowScheduleModal(true)}>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule send...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Send Modal */}
      {showScheduleModal && (
        <ScheduleSendModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleSend}
          channel="EMAIL"
          preview={{
            to: email,
            subject: subject,
            bodyPreview: message.substring(0, 100),
          }}
        />
      )}
    </>
  )
}

