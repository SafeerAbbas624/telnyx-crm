"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { X, Minimize2, Send, Mail, FileText, ChevronDown, Clock, RefreshCw } from "lucide-react"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { toast } from "sonner"
import { format } from "date-fns"
import { ScheduleSendModal } from "@/components/ui/schedule-send-modal"
import * as Portal from "@radix-ui/react-portal"

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
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false)

  // Helper to get display text for account dropdown
  const getAccountDisplayText = (acct: EmailAccount) => {
    if (acct.displayName && acct.displayName !== acct.emailAddress) {
      return `${acct.displayName} (${acct.emailAddress})`
    }
    return acct.emailAddress
  }

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

  // Schedule send handler
  const handleScheduleSend = async (scheduledAt: Date) => {
    if (!selectedAccountId) {
      throw new Error('Please select an email account')
    }
    if (!emailSession?.email) {
      throw new Error('No recipient email')
    }
    if (!subject.trim()) {
      throw new Error('Please enter a subject')
    }
    if (!body.trim()) {
      throw new Error('Please enter a message')
    }
    if (!emailSession.contact?.id) {
      throw new Error('No contact selected')
    }

    // Get the selected email account to get fromEmail
    const selectedAccount = accounts.find(a => a.id === selectedAccountId)
    if (!selectedAccount) {
      throw new Error('Selected email account not found')
    }

    const response = await fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'EMAIL',
        contactId: emailSession.contact.id,
        scheduledAt: scheduledAt.toISOString(),
        fromEmail: selectedAccount.emailAddress,
        toEmail: emailSession.email,
        subject: subject,
        body: `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
        metadata: { source: 'manual_email' },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to schedule email')
    }

    toast.success(`Email scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}`)
    setSubject("")
    setBody("")
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
              <SelectValue placeholder="Select account">
                {selectedAccountId && accounts.find(a => a.id === selectedAccountId) && (
                  <span className="truncate">
                    {getAccountDisplayText(accounts.find(a => a.id === selectedAccountId)!)}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acct) => (
                <SelectItem key={acct.id} value={acct.id} className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">{acct.displayName || acct.emailAddress}</span>
                    {acct.displayName && acct.displayName !== acct.emailAddress && (
                      <span className="text-gray-500 text-[10px]">{acct.emailAddress}</span>
                    )}
                  </div>
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

        {/* Send Button with Schedule Option */}
        <div className="flex justify-end gap-1">
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
            className="bg-green-600 hover:bg-green-700 rounded-r-none"
          >
            {isSending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Send
                <Send className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
          <DropdownMenu open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isSending || !subject.trim() || !body.trim()}
                className="bg-green-600 hover:bg-green-700 rounded-l-none border-l border-green-500 px-2"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setScheduleMenuOpen(false) // Close dropdown first
                // Use setTimeout to let dropdown close before modal opens
                setTimeout(() => setShowScheduleModal(true), 100)
              }}>
                <Clock className="h-4 w-4 mr-2" />
                Schedule send...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Schedule Send Modal - rendered in portal to avoid aria-hidden issues */}
      {showScheduleModal && (
        <Portal.Root>
          <ScheduleSendModal
            isOpen={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSchedule={async (date) => {
              await handleScheduleSend(date)
              setShowScheduleModal(false)
            }}
            channel="EMAIL"
            preview={{
              to: emailSession.email,
              subject: subject,
              bodyPreview: body.substring(0, 100),
            }}
          />
        </Portal.Root>
      )}
    </div>
  )
}

