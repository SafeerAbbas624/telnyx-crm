"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AdvancedContactFilter from "./advanced-contact-filter"
import SenderNumberSelection from "./sender-number-selection"
import TemplateManager from "./template-manager"
import { useContacts } from "@/lib/context/contacts-context"
import { getBestPhoneNumber, formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import {
  Play,
  Pause,
  Square,
  Users,
  MessageSquare,
  Clock,
  Repeat,
  Settings,
  CheckCircle,
  AlertCircle,
  Timer
} from "lucide-react"
import { format } from "date-fns"

interface Contact {
  id: string
  firstName: string
  lastName: string
  phone1?: string
  email1?: string
  propertyAddress?: string
  city?: string
  state?: string
}

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  capabilities?: string[]
  totalSmsCount?: number
  totalCallCount?: number
}

interface MessageTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  description?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

interface TextAutomation {
  id: string
  name?: string
  message: string
  totalContacts: number
  currentCycle: number
  totalCycles?: number
  isIndefinite: boolean
  status: 'draft' | 'running' | 'paused' | 'completed' | 'stopped'
  messageDelay: number // seconds
  loopDelay: number
  loopDelayUnit: 'hours' | 'days' | 'weeks' | 'months'
  senderNumbers: string[]
  selectedContacts: string[]
  contactFilters?: any
  currentIndex: number
  sentCount: number
  deliveredCount: number
  failedCount: number
  nextRunAt?: string
  startedAt?: string
  lastRunAt?: string
  createdAt: string
  updatedAt: string
}

export default function TextAutomation() {
  const { contacts } = useContacts()
  const [automations, setAutomations] = useState<TextAutomation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectionMode, setSelectionMode] = useState<"single" | "multiple" | "all">("single")
  const [rotationEnabled, setRotationEnabled] = useState(true)
  const [message, setMessage] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [messageDelay, setMessageDelay] = useState(1)
  const [loopDelay, setLoopDelay] = useState(1)
  const [loopDelayUnit, setLoopDelayUnit] = useState<'hours' | 'days' | 'weeks' | 'months'>('weeks')
  const [cycleType, setCycleType] = useState<'indefinite' | 'limited'>('indefinite')
  const [totalCycles, setTotalCycles] = useState(5)
  const [showContactSelection, setShowContactSelection] = useState(false)
  const { toast } = useToast()



  useEffect(() => {
    loadAutomations()
    loadAvailableNumbers()
  }, [])

  const loadAutomations = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/text/automations')
      if (response.ok) {
        const data = await response.json()
        setAutomations(data.automations || [])
      }
    } catch (error) {
      console.error('Error loading automations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailableNumbers = async () => {
    try {
      console.log('🔄 Text Automation: Loading available numbers...')
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        console.log('📞 Text Automation: Loaded phone numbers:', data)

        // Handle both array response and object with phoneNumbers property
        const phoneNumbersArray = Array.isArray(data) ? data : (data.phoneNumbers || [])
        console.log('📞 Text Automation: Phone numbers array:', phoneNumbersArray)

        const numbers = phoneNumbersArray.map((p: any) => ({
          id: p.id,
          phoneNumber: p.phoneNumber,
          friendlyName: p.friendlyName,
          capabilities: p.capabilities,
          totalSmsCount: p.totalSmsCount,
          totalCallCount: p.totalCallCount,
        }))

        console.log('✅ Text Automation: Processed phone numbers:', numbers)
        console.log('✅ Text Automation: Setting available numbers count:', numbers.length)
        setAvailableNumbers(numbers)
      } else {
        console.error('❌ Text Automation: Failed to load phone numbers:', response.status)
      }
    } catch (error) {
      console.error('❌ Text Automation: Error loading available numbers:', error)
    }
  }

  const handleTemplateSelect = (template: MessageTemplate | null) => {
    setSelectedTemplate(template)
  }

  const handleTemplateApply = (content: string) => {
    setMessage(content)
  }

  const formatMessage = (template: string, contact: Contact): string => {
    return template
      .replace(/\{firstName\}/g, contact.firstName || '')
      .replace(/\{lastName\}/g, contact.lastName || '')
      .replace(/\{fullName\}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim())
      .replace(/\{email\}/g, contact.email1 || contact.email2 || contact.email3 || '')
      .replace(/\{phone\}/g, getBestPhoneNumber(contact) || '')
      .replace(/\{llcName\}/g, contact.llcName || '')
      .replace(/\{propertyAddress\}/g, contact.propertyAddress || '')
  }

  const handleStartAutomation = async () => {
    if (!message.trim() || selectedContacts.length === 0 || selectedNumbers.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select contacts, enter a message, and choose sender numbers.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/text/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          messageDelay,
          loopDelay,
          loopDelayUnit,
          isIndefinite: cycleType === 'indefinite',
          totalCycles: cycleType === 'limited' ? totalCycles : null,
          senderNumbers: selectedNumbers.map(n => n.phoneNumber),
          selectedContacts: selectedContacts.map(c => c.id),
          totalContacts: selectedContacts.length,
        }),
      })

      if (response.ok) {
        toast({
          title: "Automation Started",
          description: "Text automation has been started successfully.",
        })
        loadAutomations()
        // Reset form
        setMessage("")
        setSelectedContacts([])
        setSelectedNumbers([])
        setSelectedTemplate(null)
      } else {
        throw new Error('Failed to start automation')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start automation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePauseAutomation = async (id: string) => {
    try {
      const response = await fetch(`/api/text/automations/${id}/pause`, {
        method: 'POST',
      })
      if (response.ok) {
        toast({ title: "Automation Paused" })
        loadAutomations()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to pause automation.",
        variant: "destructive",
      })
    }
  }

  const handleResumeAutomation = async (id: string) => {
    try {
      const response = await fetch(`/api/text/automations/${id}/resume`, {
        method: 'POST',
      })
      if (response.ok) {
        toast({ title: "Automation Resumed" })
        loadAutomations()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resume automation.",
        variant: "destructive",
      })
    }
  }

  const handleStopAutomation = async (id: string) => {
    try {
      const response = await fetch(`/api/text/automations/${id}/stop`, {
        method: 'POST',
      })
      if (response.ok) {
        toast({ title: "Automation Stopped" })
        loadAutomations()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop automation.",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'completed': return 'bg-blue-500'
      case 'stopped': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="h-4 w-4" />
      case 'paused': return <Pause className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'stopped': return <Square className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const formatNextRun = (nextRunAt?: string) => {
    if (!nextRunAt) return 'Not scheduled'
    return format(new Date(nextRunAt), 'MMM dd, yyyy hh:mm a')
  }

  return (
    <div className="h-full flex flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Text Automation</h2>
          <p className="text-muted-foreground">
            Set up recurring text messages that run automatically
          </p>
        </div>
      </div>

      {/* Active Automations */}
      {automations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Active Automations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {automations.map((automation) => (
                  <div key={automation.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge className={`${getStatusColor(automation.status)} text-white`}>
                          {getStatusIcon(automation.status)}
                          <span className="ml-1 capitalize">{automation.status}</span>
                        </Badge>
                        <div>
                          <p className="font-medium">
                            Cycle {automation.currentCycle}
                            {automation.isIndefinite ? ' of ∞' : ` of ${automation.totalCycles}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {automation.totalContacts} contacts
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {automation.status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePauseAutomation(automation.id)}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {automation.status === 'paused' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResumeAutomation(automation.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStopAutomation(automation.id)}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{automation.sentCount}</p>
                        <p className="text-sm text-muted-foreground">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{automation.deliveredCount}</p>
                        <p className="text-sm text-muted-foreground">Delivered</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{automation.failedCount}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{automation.sentCount} / {automation.totalContacts}</span>
                      </div>
                      <Progress 
                        value={(automation.sentCount / automation.totalContacts) * 100} 
                        className="h-2"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Next run: {formatNextRun(automation.nextRunAt)}</span>
                      <span>
                        Delay: {automation.messageDelay}s / {automation.loopDelay} {automation.loopDelayUnit}
                      </span>
                    </div>

                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <strong>Message:</strong> {automation.message.substring(0, 100)}
                      {automation.message.length > 100 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Contact Selection & Templates */}
        <div className="space-y-6">
          {/* Contact Selection (Advanced) */}
          <AdvancedContactFilter
            contacts={contacts}
            selectedContacts={selectedContacts}
            onSelectedContactsChange={setSelectedContacts}
            onFilteredContactsChange={() => {}}
          />

          {/* Template Manager */}
          <TemplateManager
            selectedTemplate={selectedTemplate}
            onTemplateSelect={handleTemplateSelect}
            onTemplateApply={handleTemplateApply}
          />

          {/* Message Composition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Hi {firstName}, this is a message from our team..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Available variables: {"{firstName}"}, {"{lastName}"}, {"{fullName}"}, {"{email}"}, {"{phone}"}, {"{llcName}"}, {"{propertyAddress}"}
                </div>
              </div>

              {/* Message Preview */}
              {message && selectedContacts.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium">Preview (first contact):</Label>
                  <div className="text-sm mt-1 whitespace-pre-wrap">
                    {formatMessage(message, selectedContacts[0])}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings */}
        <div className="space-y-6">
          {/* Message Delay Settings Card - CUSTOM FOR AUTOMATION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Message Delay Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Message Delay */}
                <div>
                  <Label htmlFor="messageDelay">Message Delay (between messages)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="messageDelay"
                      type="number"
                      min="1"
                      max="60"
                      value={messageDelay}
                      onChange={(e) => setMessageDelay(parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">seconds</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Delay between individual messages (1-60 seconds)
                  </p>
                </div>

                <Separator />

                {/* Loop Run Delay */}
                <div>
                  <Label htmlFor="loopDelay">Loop Run Delay (between cycles)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="loopDelay"
                      type="number"
                      min="1"
                      value={loopDelay}
                      onChange={(e) => setLoopDelay(parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <Select value={loopDelayUnit} onValueChange={(value: any) => setLoopDelayUnit(value)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time to wait before starting the next cycle
                  </p>
                </div>

                <Separator />

                {/* Total Cycles */}
                <div>
                  <Label>Total Cycles</Label>
                  <ToggleGroup type="single" value={cycleType} onValueChange={(value: any) => value && setCycleType(value)} className="mt-2 gap-2">
                    <ToggleGroupItem value="indefinite" aria-label="Run indefinitely">Indefinite</ToggleGroupItem>
                    <div className="flex items-center space-x-2">
                      <ToggleGroupItem value="limited" aria-label="Limited cycles">Limited</ToggleGroupItem>
                      <Input
                        type="number"
                        min="1"
                        value={totalCycles}
                        onChange={(e) => setTotalCycles(parseInt(e.target.value) || 1)}
                        className="w-20"
                        disabled={cycleType !== 'limited'}
                      />
                      <span className="text-sm text-muted-foreground">cycles</span>
                    </div>
                  </ToggleGroup>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sender Numbers */}
          <SenderNumberSelection
            availableNumbers={availableNumbers}
            selectedNumbers={selectedNumbers}
            onSelectedNumbersChange={setSelectedNumbers}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            rotationEnabled={rotationEnabled}
            onRotationEnabledChange={setRotationEnabled}
          />

          {/* Start Automation Button */}
          <Button
            onClick={handleStartAutomation}
            disabled={isLoading || !message.trim() || selectedContacts.length === 0 || selectedNumbers.length === 0}
            className="w-full"
            size="lg"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Automation
          </Button>
        </div>
      </div>

      {/* Contact Selection Dialog */}
      <Dialog open={showContactSelection} onOpenChange={setShowContactSelection}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Contacts for Automation</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <AdvancedContactFilter
              contacts={contacts}
              selectedContacts={selectedContacts}
              onSelectedContactsChange={setSelectedContacts}
              onFilteredContactsChange={() => {}}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
