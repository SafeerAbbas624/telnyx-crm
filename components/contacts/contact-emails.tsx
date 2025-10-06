"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PlusCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import type { Email } from "@/lib/types"

interface ContactEmailsProps {
  contactId: string
}

const getEmailIcon = (direction: string) => {
  if (direction === "inbound") {
    return <ArrowDownLeft className="h-4 w-4 text-green-500" />
  }
  return <ArrowUpRight className="h-4 w-4 text-blue-500" />
}

export default function ContactEmails({ contactId }: ContactEmailsProps) {
  const [emails, setEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: ''
  })
  const [sending, setSending] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/emails?contactId=${contactId}`)
        if (response.ok) {
          const data = await response.json()
          setEmails(data)
        } else {
          setError('Failed to fetch emails')
        }
      } catch (err) {
        setError('Error fetching emails')
        console.error('Error fetching emails:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEmails()
  }, [contactId])

  // Now using real data from API

  const handleSendEmail = async () => {
    try {
      // Get contact info to find email
      const contactResponse = await fetch(`/api/contacts/${contactId}`)
      if (!contactResponse.ok) {
        toast({
          title: "Error",
          description: "Could not find contact information",
          variant: "destructive",
        })
        return
      }

      const contact = await contactResponse.json()
      const contactEmail = contact.email1 || contact.email2 || contact.email3

      if (!contactEmail) {
        toast({
          title: "No Email Address",
          description: "This contact doesn't have an email address.",
          variant: "destructive",
        })
        return
      }

      // Navigate to Email Center Conversations tab with this contact's email
      router.push(`/dashboard?tab=email&subtab=conversations&email=${encodeURIComponent(contactEmail)}`)

    } catch (error) {
      console.error('Error navigating to email conversation:', error)
      toast({
        title: "Error",
        description: "Failed to prepare email",
        variant: "destructive",
      })
    }
  }

  const handleSubmitEmail = async () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.body) {
      toast({
        title: "Missing Information",
        description: "Please fill in all email fields",
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)

      // Send email via API
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact_id: contactId,
          direction: 'outbound',
          to_email: emailForm.to,
          subject: emailForm.subject,
          body: emailForm.body,
          status: 'sent'
        }),
      })

      if (response.ok) {
        toast({
          title: "Email Sent",
          description: "Your email has been sent successfully",
        })

        // Refresh emails list
        const emailsResponse = await fetch(`/api/emails?contactId=${contactId}`)
        if (emailsResponse.ok) {
          const data = await emailsResponse.json()
          setEmails(data)
        }

        // Reset form and close dialog
        setEmailForm({ to: '', subject: '', body: '' })
        setShowEmailDialog(false)
      } else {
        throw new Error('Failed to send email')
      }

    } catch (error) {
      console.error('Error sending email:', error)
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Emails</CardTitle>
        <Button variant="default" size="sm" onClick={handleSendEmail} className="bg-purple-600 hover:bg-purple-700">
          <PlusCircle className="h-4 w-4 mr-2" /> Email
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading emails...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : emails.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No emails found for this contact.</div>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4">
              {emails.map((email) => (
                <div key={email.id} className="flex items-start space-x-3 p-3 border rounded-md">
                  <div className="flex-shrink-0 mt-1">{getEmailIcon(email.direction)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{email.subject}</h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(email.timestamp || email.createdAt), "MMM dd, yyyy hh:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{email.body || email.content}</p>
                    <p className="text-xs text-gray-500 mt-1 capitalize">Status: {email.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>

    {/* Email Compose Dialog */}
    <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              value={emailForm.to}
              onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={emailForm.subject}
              onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={emailForm.body}
              onChange={(e) => setEmailForm(prev => ({ ...prev, body: e.target.value }))}
              placeholder="Type your message here..."
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmitEmail} disabled={sending}>
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  )
}
