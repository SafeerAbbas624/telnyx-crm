"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Contact {
  id: string
  name: string
  email: string
  role: string
}

interface BulkEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contacts: Contact[]
  onSendBulkEmail: (recipients: string[], subject: string, body: string) => Promise<void>
}

export default function BulkEmailDialog({
  open,
  onOpenChange,
  contacts,
  onSendBulkEmail,
}: BulkEmailDialogProps) {
  const { toast } = useToast()
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId)
    } else {
      newSelected.add(contactId)
    }
    setSelectedContacts(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)))
    }
  }

  const handleSend = async () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one recipient",
        variant: "destructive",
      })
      return
    }

    if (!subject.trim()) {
      toast({
        title: "Error",
        description: "Subject is required",
        variant: "destructive",
      })
      return
    }

    if (!body.trim()) {
      toast({
        title: "Error",
        description: "Email body is required",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    try {
      const recipients = contacts
        .filter(c => selectedContacts.has(c.id))
        .map(c => c.email)

      await onSendBulkEmail(recipients, subject, body)

      toast({
        title: "Success",
        description: `Email sent to ${recipients.length} recipient(s)`,
      })

      // Reset form
      setSelectedContacts(new Set())
      setSubject('')
      setBody('')
      onOpenChange(false)
    } catch (error) {
      console.error("Error sending bulk email:", error)
      toast({
        title: "Error",
        description: "Failed to send emails",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Send Bulk Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients Selection */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Recipients ({selectedContacts.size} selected)</Label>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <Checkbox
                  checked={selectedContacts.size === contacts.length && contacts.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">Select All</span>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-2 pr-4">
                  {contacts.map(contact => (
                    <div key={contact.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => handleSelectContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{contact.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{contact.email}</div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{contact.role}</div>
                    </div>
                  ))}
                  {contacts.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No contacts available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label className="text-sm">Subject *</Label>
            <Input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Body */}
          <div>
            <Label className="text-sm">Message *</Label>
            <textarea
              placeholder="Email body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full h-32 p-3 border rounded-md font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || selectedContacts.size === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSending ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Send to {selectedContacts.size}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

