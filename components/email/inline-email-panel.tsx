"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { X, Minimize2, Send, Mail, FileText, ChevronDown } from "lucide-react"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { toast } from "sonner"

interface EmailAccount {
  id: string
  emailAddress: string
  displayName?: string
  isDefault?: boolean
  status?: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  category?: string
}

export default function InlineEmailPanel() {
  const { emailSession, minimize, maximize, close } = useEmailUI()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (emailSession) {
      loadAccounts()
      loadTemplates()
    }
  }, [emailSession])

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/email/accounts')
      if (response.ok) {
        const data = await response.json()
        const accts = data.accounts || []
        setAccounts(accts.filter((a: EmailAccount) => a.status === 'active'))
        const defaultAcct = accts.find((a: EmailAccount) => a.isDefault)
        if (defaultAcct) setSelectedAccountId(defaultAcct.id)
        else if (accts.length > 0) setSelectedAccountId(accts[0].id)
      }
    } catch (error) {
      console.error('[Email Panel] Failed to load accounts:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/email/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('[Email Panel] Failed to load templates:', error)
    }
  }

  const applyTemplate = (template: EmailTemplate) => {
    let content = template.content
    let subj = template.subject
    
    if (emailSession?.contact) {
      const contact = emailSession.contact
      const replacements: Record<string, string> = {
        '{firstName}': contact.firstName || '',
        '{lastName}': contact.lastName || '',
        '{fullName}': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        '{email}': contact.email1 || '',
        '{address}': contact.propertyAddress || '',
        '{propertyAddress}': contact.propertyAddress || '',
        '{city}': contact.city || '',
        '{state}': contact.state || '',
      }
      
      Object.entries(replacements).forEach(([key, value]) => {
        const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'gi')
        content = content.replace(regex, value)
        subj = subj.replace(regex, value)
      })
    }
    
    setSubject(subj)
    setBody(content.replace(/<[^>]*>/g, '')) // Strip HTML for plain text
    setShowTemplates(false)
    toast.success(`Template "${template.name}" applied`)
  }

  const handleSend = async () => {
    if (!selectedAccountId) {
      toast.error('Please select an email account')
      return
    }
    if (!emailSession?.email) {
      toast.error('No recipient email')
      return
    }
    if (!subject.trim()) {
      toast.error('Please enter a subject')
      return
    }
    if (!body.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAccountId: selectedAccountId,
          toEmails: [emailSession.email],
          subject,
          content: `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
          textContent: body,
          contactId: emailSession.contact?.id,
        }),
      })

      if (response.ok) {
        toast.success('Email sent successfully!')
        setSubject("")
        setBody("")
        close()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send email')
      }
    } catch (error) {
      console.error('[Email Panel] Send error:', error)
      toast.error('Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  if (!emailSession) return null

  const contactName = emailSession.contact
    ? `${emailSession.contact.firstName || ''} ${emailSession.contact.lastName || ''}`.trim()
    : emailSession.email

  // Minimized state - show tab at bottom right
  if (emailSession.isMinimized) {
    return (
      <div className="fixed bottom-0 right-4 z-50">
        <Button
          onClick={maximize}
          className="bg-green-600 hover:bg-green-700 rounded-b-none h-8 text-sm"
        >
          <Mail className="h-4 w-4 mr-2" />
          {contactName || 'Email'}
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-4 z-50 w-[400px] shadow-2xl rounded-t-lg overflow-hidden border border-green-200">
      <div className="bg-green-600 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            Email to {contactName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-green-700" onClick={minimize}>
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-green-700" onClick={close}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="bg-white p-3 space-y-3">
        {/* From Account */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-12">From:</span>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acct) => (
                <SelectItem key={acct.id} value={acct.id} className="text-xs">
                  {acct.displayName || acct.emailAddress}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* To */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-12">To:</span>
          <Input value={emailSession.email} disabled className="h-8 text-xs flex-1 bg-gray-50" />
        </div>

        {/* Subject */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-12">Subject:</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject..."
            className="h-8 text-xs flex-1"
          />
        </div>

        {/* Template Selector */}
        {templates.length > 0 && (
          <Popover open={showTemplates} onOpenChange={setShowTemplates}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <FileText className="h-3 w-3" />
                Templates
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="max-h-48 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 border-b last:border-b-0"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-xs text-gray-500 truncate">{template.subject}</div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Body */}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message..."
          className="min-h-[120px] text-sm resize-none"
        />

        {/* Send Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending ? 'Sending...' : 'Send'}
            <Send className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}

