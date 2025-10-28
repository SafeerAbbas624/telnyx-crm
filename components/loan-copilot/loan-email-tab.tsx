"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mail, Send, X, Copy, AlertCircle, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import EmailTrackingStats from "./email-tracking-stats"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface LoanEmailTabProps {
  loanId: string
  templates: EmailTemplate[]
  onSendEmail: (to: string, subject: string, body: string) => void
}

export default function LoanEmailTab({ loanId, templates, onSendEmail }: LoanEmailTabProps) {
  const { toast } = useToast()
  const [isComposing, setIsComposing] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    body: '',
    cc: '',
    bcc: '',
  })

  const handleUseTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setFormData({
      to: '',
      subject: template.subject,
      body: template.body,
    })
    setIsComposing(true)
  }

  const handleSendEmail = async () => {
    if (!formData.to || !formData.subject || !formData.body) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (To, Subject, Body)",
        variant: "destructive",
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.to)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/loans/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formData.to,
          subject: formData.subject,
          body: formData.body,
          cc: formData.cc || undefined,
          bcc: formData.bcc || undefined,
          loanId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: "Email sent successfully",
        })
        onSendEmail(formData.to, formData.subject, formData.body)
        setFormData({ to: '', subject: '', body: '', cc: '', bcc: '' })
        setIsComposing(false)
        setSelectedTemplate(null)
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to send email",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error sending email:", error)
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyTemplate = (template: EmailTemplate) => {
    const text = `Subject: ${template.subject}\n\n${template.body}`
    navigator.clipboard.writeText(text)
  }

  if (isComposing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Compose Email</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsComposing(false)
              setSelectedTemplate(null)
              setFormData({ to: '', subject: '', body: '' })
            }}
          >
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="text-sm">To *</Label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">CC</Label>
                <Input
                  type="email"
                  placeholder="cc@example.com"
                  value={formData.cc}
                  onChange={(e) => setFormData({ ...formData, cc: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">BCC</Label>
                <Input
                  type="email"
                  placeholder="bcc@example.com"
                  value={formData.bcc}
                  onChange={(e) => setFormData({ ...formData, bcc: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Subject *</Label>
              <Input
                placeholder="Email subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Message</Label>
              <textarea
                placeholder="Email body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="mt-1 w-full h-64 p-3 border rounded-md font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSendEmail}
                disabled={isSending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Send Email
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsComposing(false)
                  setSelectedTemplate(null)
                  setFormData({ to: '', subject: '', body: '', cc: '', bcc: '' })
                }}
                className="flex-1"
                disabled={isSending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Email Templates</h3>
        <Button onClick={() => setIsComposing(true)}>
          <Mail className="mr-2 h-4 w-4" /> Compose Email
        </Button>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-3 pr-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">Subject: {template.subject}</p>
                  </div>
                  <Badge variant="outline" className="ml-2">Template</Badge>
                </div>

                <div className="bg-slate-50 p-3 rounded text-xs text-muted-foreground mb-3 max-h-24 overflow-hidden">
                  {template.body}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1"
                  >
                    <Mail className="mr-2 h-3 w-3" /> Use Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyTemplate(template)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {templates.length === 0 && (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No email templates available.</p>
              <Button size="sm" className="mt-4" onClick={() => setIsComposing(true)}>
                <Mail className="mr-2 h-4 w-4" /> Compose Email
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Email Tracking Stats */}
      <EmailTrackingStats loanId={loanId} />
    </div>
  )
}

