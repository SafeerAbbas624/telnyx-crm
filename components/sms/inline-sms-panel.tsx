"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { X, Minimize2, Send, MessageSquare, RefreshCw, FileText, ChevronDown, Pencil, Plus, Clock, Maximize2, GripVertical } from "lucide-react"
import { useSmsUI, SmsSession } from "@/lib/context/sms-ui-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { toast } from "sonner"
import { format } from "date-fns"
import { TemplateVariableSelector } from "@/components/ui/template-variable-selector"
import { ScheduleSendModal } from "@/components/ui/schedule-send-modal"
import * as Portal from "@radix-ui/react-portal"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  state?: string
  city?: string
  isActive: boolean
}

interface SmsMessage {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  status: string
  createdAt: string
  fromNumber: string
  toNumber: string
}

interface SmsTemplate {
  id: string
  name: string
  content: string
  variables?: string[]
}

// Main component that renders all SMS panels
export default function InlineSmsPanel() {
  const { smsSessions, minimizeSession, maximizeSession, closeSession } = useSmsUI()

  if (smsSessions.length === 0) return null

  return (
    <>
      {smsSessions.map((session, index) => (
        <SingleSmsPanel
          key={session.sessionId}
          session={session}
          index={index}
          onMinimize={() => minimizeSession(session.sessionId)}
          onMaximize={() => maximizeSession(session.sessionId)}
          onClose={() => closeSession(session.sessionId)}
        />
      ))}
    </>
  )
}

// Individual SMS panel
function SingleSmsPanel({
  session,
  index,
  onMinimize,
  onMaximize,
  onClose
}: {
  session: SmsSession
  index: number
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}) {
  const [message, setMessage] = useState("")
  const [selectedSenderNumber, setSelectedSenderNumber] = useState<string>("")
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isSending, setIsSending] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<SmsMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  // Template editing state
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateContent, setTemplateContent] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  // Schedule send state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null)
  const templateContentRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Dragging state - default position is bottom-left, offset by index for stacking
  const defaultX = 16 + (index * 30)
  const defaultY = window.innerHeight - 616 - (index * 30) // 600px height + 16px margin
  const [position, setPosition] = useState({ x: defaultX, y: Math.max(16, defaultY) })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 })

  // Dragging handlers
  const handleDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return
    setIsDragging(true)
    const rect = panelRef.current.getBoundingClientRect()
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    e.preventDefault()
  }

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStartPos.current.x
    const newY = e.clientY - dragStartPos.current.y
    const maxX = window.innerWidth - 520
    const maxY = window.innerHeight - 620
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach/detach global mouse handlers for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Load available phone numbers, conversation history, and templates
  useEffect(() => {
    loadAvailableNumbers()
    loadConversationHistory()
    loadTemplates()
  }, [session.phoneNumber])

  // Auto-refresh conversation every 3 seconds
  useEffect(() => {
    if (!session.isMinimized) {
      autoRefreshRef.current = setInterval(() => {
        loadConversationHistory(true) // silent refresh
      }, 3000)
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [session.isMinimized, selectedSenderNumber])

  // Reload conversation when sender number changes
  useEffect(() => {
    if (selectedSenderNumber && session.phoneNumber) {
      loadConversationHistory()
    }
  }, [selectedSenderNumber])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationHistory])

  const loadConversationHistory = useCallback(async (silent = false) => {
    if (!session.phoneNumber) return

    if (!silent) setLoadingHistory(true)
    try {
      // Get the last 10 digits of phone numbers for matching
      const contactDigits = session.phoneNumber.replace(/\D/g, '').slice(-10)
      const senderDigits = selectedSenderNumber ? selectedSenderNumber.replace(/\D/g, '').slice(-10) : ''

      // Build query with both numbers to filter conversation between specific pair
      let url = `/api/telnyx/messages?phoneNumber=${contactDigits}&limit=100`
      if (senderDigits) {
        url += `&ourNumber=${senderDigits}`
      }

      const response = await fetch(url)

      if (response.ok) {
        const data = await response.json()
        const messages = Array.isArray(data) ? data : data.messages || []

        // Filter to show only messages between selected sender and contact
        const filteredMessages = senderDigits
          ? messages.filter((msg: SmsMessage) => {
              const msgFrom = msg.fromNumber.replace(/\D/g, '').slice(-10)
              const msgTo = msg.toNumber.replace(/\D/g, '').slice(-10)
              // Include messages where our number is either from or to
              return (msgFrom === senderDigits && msgTo === contactDigits) ||
                     (msgTo === senderDigits && msgFrom === contactDigits)
            })
          : messages

        // Sort by date ascending (oldest first)
        const sortedMessages = filteredMessages.sort((a: SmsMessage, b: SmsMessage) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        setConversationHistory(sortedMessages)
      }
    } catch (error) {
      console.error('[SMS Panel] Failed to load conversation history:', error)
    } finally {
      if (!silent) setLoadingHistory(false)
    }
  }, [session.phoneNumber, selectedSenderNumber])

  const loadAvailableNumbers = async () => {
    try {
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        const numbers = Array.isArray(data) ? data : data.phoneNumbers || []
        const activeNumbers = numbers.filter((n: TelnyxPhoneNumber) => n.isActive)
        console.log('[SMS Panel] Loaded numbers:', activeNumbers.length, 'active out of', numbers.length)
        setAvailableNumbers(activeNumbers)
        if (activeNumbers.length > 0 && !selectedSenderNumber) {
          // Priority: 1) session.fromNumber (from call), 2) first available number
          if (session.fromNumber) {
            // Find matching number in available numbers (compare last 10 digits)
            const fromDigits = session.fromNumber.replace(/\D/g, '').slice(-10)
            const matchingNumber = activeNumbers.find((n: TelnyxPhoneNumber) =>
              n.phoneNumber.replace(/\D/g, '').slice(-10) === fromDigits
            )
            if (matchingNumber) {
              console.log('[SMS Panel] Using fromNumber from call:', matchingNumber.phoneNumber)
              setSelectedSenderNumber(matchingNumber.phoneNumber)
            } else {
              console.log('[SMS Panel] fromNumber not found in available numbers, using first:', activeNumbers[0].phoneNumber)
              setSelectedSenderNumber(activeNumbers[0].phoneNumber)
            }
          } else {
            console.log('[SMS Panel] Setting default sender:', activeNumbers[0].phoneNumber)
            setSelectedSenderNumber(activeNumbers[0].phoneNumber)
          }
        }
      } else {
        console.error('[SMS Panel] Failed to load numbers, status:', response.status)
      }
    } catch (error) {
      console.error('[SMS Panel] Failed to load phone numbers:', error)
      toast.error('Failed to load phone numbers')
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('[SMS Panel] Failed to load templates:', error)
    }
  }

  // Apply template with variable replacement
  const applyTemplate = (template: SmsTemplate) => {
    let content = template.content

    // Replace variables with contact data
    if (session.contact) {
      const contact = session.contact
      const replacements: Record<string, string> = {
        '{firstName}': contact.firstName || '',
        '{lastName}': contact.lastName || '',
        '{fullName}': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        '{phone}': (contact as any).phone1 || '',
        '{email}': (contact as any).email1 || '',
        '{address}': (contact as any).propertyAddress || '',
        '{propertyAddress}': (contact as any).propertyAddress || '',
        '{city}': (contact as any).city || '',
        '{state}': (contact as any).state || '',
      }

      Object.entries(replacements).forEach(([key, value]) => {
        content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'gi'), value)
      })
    }

    setMessage(content)
    setShowTemplates(false)
    toast.success(`Template "${template.name}" applied`)
  }

  // Open template for editing
  const openEditTemplate = (template: SmsTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateContent(template.content)
    setShowTemplates(false)
  }

  // Open create new template dialog
  const openCreateTemplate = () => {
    setIsCreatingTemplate(true)
    setTemplateName("")
    setTemplateContent("")
    setShowTemplates(false)
  }

  // Save template (create or update)
  const saveTemplate = async () => {
    if (!templateName.trim() || !templateContent.trim()) {
      toast.error("Name and content are required")
      return
    }

    setSavingTemplate(true)
    try {
      const isEditing = !!editingTemplate
      const url = isEditing ? `/api/templates/${editingTemplate.id}` : '/api/templates'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          content: templateContent.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save template')
      }

      toast.success(isEditing ? 'Template updated' : 'Template created')
      setEditingTemplate(null)
      setIsCreatingTemplate(false)
      setTemplateName("")
      setTemplateContent("")
      loadTemplates() // Refresh templates list
    } catch (error) {
      console.error('[SMS Panel] Failed to save template:', error)
      toast.error('Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  // Close template dialog
  const closeTemplateDialog = () => {
    setEditingTemplate(null)
    setIsCreatingTemplate(false)
    setTemplateName("")
    setTemplateContent("")
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (!selectedSenderNumber) {
      toast.error('Please select a sender number')
      return
    }

    setIsSending(true)
    const payload = {
      toNumber: session.phoneNumber,
      fromNumber: selectedSenderNumber,
      message: message,
      contactId: session.contact?.id
    }
    console.log('[SMS Panel] Sending SMS with payload:', payload)

    try {
      const response = await fetch('/api/telnyx/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success('SMS sent successfully')
        setMessage("")
        // Add optimistic update to conversation
        const newMessage: SmsMessage = {
          id: `temp-${Date.now()}`,
          content: message,
          direction: 'outbound',
          status: 'sent',
          createdAt: new Date().toISOString(),
          fromNumber: selectedSenderNumber,
          toNumber: session.phoneNumber || '',
        }
        setConversationHistory(prev => [...prev, newMessage])
        // Refresh history after a short delay
        setTimeout(() => loadConversationHistory(), 2000)
      } else {
        const error = await response.json()
        console.error('[SMS Panel] Send error response:', error)
        toast.error(error.error || error.message || 'Failed to send SMS')
      }
    } catch (error) {
      console.error('[SMS Panel] Error sending SMS:', error)
      toast.error('Failed to send SMS')
    } finally {
      setIsSending(false)
    }
  }

  // Schedule send handler
  const handleScheduleSend = async (scheduledAt: Date) => {
    if (!message.trim()) {
      throw new Error('Please enter a message')
    }

    if (!selectedSenderNumber) {
      throw new Error('Please select a sender number')
    }

    if (!session.contact?.id) {
      throw new Error('No contact selected')
    }

    const response = await fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'SMS',
        contactId: session.contact.id,
        scheduledAt: scheduledAt.toISOString(),
        fromNumber: selectedSenderNumber,
        toNumber: session.phoneNumber,
        body: message,
        metadata: { source: 'manual_sms' },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to schedule message')
    }

    toast.success(`SMS scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}`)
    setMessage("")
  }

  const contactName = session.contact
    ? `${session.contact.firstName || ''} ${session.contact.lastName || ''}`.trim()
    : 'Unknown Contact'

  // Minimized view
  if (session.isMinimized) {
    return (
      <div
        className="fixed z-40"
        style={{ bottom: '16px', left: `${16 + (index * 140)}px` }}
      >
        <div
          className="bg-blue-600 text-white border-2 border-blue-700 rounded-lg p-2 shadow-lg flex items-center gap-2 cursor-pointer hover:bg-blue-700 transition max-w-[130px]"
          onClick={onMaximize}
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs font-medium truncate">{contactName}</span>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-white hover:bg-blue-800 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  // Full panel view - draggable
  return (
    <div
      ref={panelRef}
      className="fixed z-40 w-[500px] h-[600px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div className="bg-white border-4 border-blue-600 rounded-lg shadow-2xl h-full flex flex-col">
        {/* Draggable Header */}
        <div
          className="bg-blue-600 text-white p-3 rounded-t-md flex-shrink-0 cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 opacity-60" />
              <MessageSquare className="h-5 w-5" />
              <span className="text-base font-semibold">SMS Conversation</span>
            </div>
            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-blue-700"
                onClick={() => loadConversationHistory()}
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white hover:bg-blue-700" onClick={onMinimize}>
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white hover:bg-blue-700" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{contactName}</div>
              <div className="text-xs text-blue-100">{formatPhoneNumberForDisplay(session.phoneNumber)}</div>
            </div>
            {/* Sender Number Selector - Compact */}
            <Select value={selectedSenderNumber} onValueChange={setSelectedSenderNumber}>
              <SelectTrigger className="h-8 w-[180px] bg-blue-700 border-blue-500 text-white text-xs">
                <SelectValue placeholder="From..." />
              </SelectTrigger>
              <SelectContent>
                {availableNumbers.map((num) => (
                  <SelectItem key={num.id} value={num.phoneNumber} className="text-xs">
                    {formatPhoneNumberForDisplay(num.phoneNumber)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conversation History */}
        <ScrollArea className="flex-1 p-3 bg-gray-50">
          {loadingHistory && conversationHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Loading conversation...
            </div>
          ) : conversationHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
              <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-xs">Start the conversation below</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversationHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.direction === 'outbound'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${
                      msg.direction === 'outbound' ? 'text-blue-100' : 'text-gray-400'
                    }`}>
                      <span className="text-[10px]">
                        {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                      </span>
                      {msg.direction === 'outbound' && (
                        <span className="text-[10px]">
                          {msg.status === 'delivered' ? '✓✓' : msg.status === 'sent' ? '✓' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="p-3 border-t bg-white flex-shrink-0">
          {/* Template Selector */}
          <div className="mb-2">
            <Popover open={showTemplates} onOpenChange={setShowTemplates}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  Templates
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="max-h-48 overflow-y-auto">
                  {templates.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-gray-500">
                      No templates yet
                    </div>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 border-b last:border-b-0 group"
                      >
                        <button
                          className="flex-1 text-left text-sm"
                          onClick={() => applyTemplate(template)}
                        >
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500 truncate pr-2">{template.content.substring(0, 40)}...</div>
                        </button>
                        <button
                          className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => openEditTemplate(template, e)}
                          title="Edit template"
                        >
                          <Pencil className="h-3 w-3 text-gray-500" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {/* Create New Template Button */}
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs gap-1 justify-start"
                    onClick={openCreateTemplate}
                  >
                    <Plus className="h-3 w-3" />
                    Create New Template
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[60px] max-h-[100px] flex-1 resize-none text-sm"
              onKeyDown={(e) => {
                // Enter to send, Shift+Enter for new line
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              autoFocus
            />
            {/* Send button with dropdown for schedule */}
            <div className="flex gap-1">
              <Button
                onClick={handleSend}
                disabled={isSending || !message.trim()}
                className="bg-blue-600 hover:bg-blue-700 h-[60px] w-[50px] p-0 rounded-r-none"
              >
                {isSending ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
              <DropdownMenu open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={isSending || !message.trim()}
                    className="bg-blue-600 hover:bg-blue-700 h-[60px] w-[30px] p-0 rounded-l-none border-l border-blue-500"
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
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-400">{message.length} chars</p>
            <p className="text-xs text-gray-400">Enter to send • Shift+Enter for new line</p>
          </div>
        </div>
      </div>

      {/* Template Edit/Create Dialog */}
      <Dialog open={!!editingTemplate || isCreatingTemplate} onOpenChange={(open) => !open && closeTemplateDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            <DialogDescription>
              Click &quot;Insert Variable&quot; to add dynamic content at cursor position
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Follow-up Message"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="template-content">Message Content</Label>
                <TemplateVariableSelector
                  onSelect={(variable) => {
                    const element = templateContentRef.current;
                    if (element) {
                      const start = element.selectionStart || 0;
                      const end = element.selectionEnd || 0;
                      const newValue = templateContent.substring(0, start) + variable + templateContent.substring(end);
                      setTemplateContent(newValue);
                      // Set cursor position after inserted variable
                      setTimeout(() => {
                        element.focus();
                        element.setSelectionRange(start + variable.length, start + variable.length);
                      }, 0);
                    } else {
                      setTemplateContent(templateContent + variable);
                    }
                  }}
                />
              </div>
              <Textarea
                ref={templateContentRef}
                id="template-content"
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                placeholder="Hi {firstName}, ..."
                rows={5}
              />
              <p className="text-xs text-gray-500">
                Use {'{firstName}'} or {'{propertyAddress}'} to insert dynamic values. Use the Variables dropdown to see all options.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTemplateDialog} disabled={savingTemplate}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={savingTemplate}>
              {savingTemplate ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Send Modal - rendered in portal to avoid aria-hidden issues */}
      {showScheduleModal && (
        <Portal.Root>
          <ScheduleSendModal
            isOpen={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            onSchedule={handleScheduleSend}
            channel="SMS"
            preview={{
              to: formatPhoneNumberForDisplay(session.phoneNumber || ''),
              bodyPreview: message.substring(0, 100),
            }}
          />
        </Portal.Root>
      )}
    </div>
  )
}
