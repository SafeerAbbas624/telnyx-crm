"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Send, Users, MessageSquare, Play, Pause, Square, RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import AdvancedContactFilter from "./advanced-contact-filter"
import SenderNumberSelection from "./sender-number-selection"
import MessageDelaySettings from "./message-delay-settings"
import TemplateManager from "./template-manager"
import { useContacts } from "@/lib/context/contacts-context"
import { getBestPhoneNumber, formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import type { Contact } from "@/lib/types"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  capabilities?: string[]
  totalSmsCount?: number
  totalCallCount?: number
  totalCost?: string | number
  isActive?: boolean
  telnyxId?: string | null
  state?: string
  city?: string | null
  country?: string
  monthlyPrice?: string | null
  setupPrice?: string | null
  purchasedAt?: string
  lastUsedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

interface TextBlast {
  id: string
  name?: string
  message: string
  totalContacts: number
  sentCount: number
  deliveredCount: number
  failedCount: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  senderNumbers: string
  delaySeconds: number
  currentIndex: number
  isPaused: boolean
  startedAt?: string
  completedAt?: string
  pausedAt?: string
  resumedAt?: string
  createdAt: string
  updatedAt: string
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

export default function EnhancedTextBlast() {
  const { contacts } = useContacts()
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [selectionMode, setSelectionMode] = useState<"single" | "multiple" | "all">("single")
  const [rotationEnabled, setRotationEnabled] = useState(true)
  const [delaySeconds, setDelaySeconds] = useState(2)
  const [message, setMessage] = useState("")
  const [blastName, setBlastName] = useState("")
  const [currentBlast, setCurrentBlast] = useState<TextBlast | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [currentProcessingContact, setCurrentProcessingContact] = useState<Contact | null>(null)
  const [blastProgress, setBlastProgress] = useState<{
    currentIndex: number
    totalContacts: number
    sentCount: number
    failedCount: number
    remainingCount: number
    currentMessage: string
    estimatedTimeRemaining: number
  } | null>(null)
  const { toast } = useToast()

  // Debug logging
  console.log('EnhancedTextBlast - availableNumbers:', availableNumbers)
  console.log('EnhancedTextBlast - selectedNumbers:', selectedNumbers)



  // Load data on component mount
  useEffect(() => {
    loadPhoneNumbers()
    checkForActiveBlast()
  }, [])

  // Poll for blast updates when there's an active blast
  useEffect(() => {
    if (currentBlast && ['running', 'paused'].includes(currentBlast.status)) {
      const interval = setInterval(() => {
        refreshBlastStatus()
      }, 1000) // Update every second for real-time progress
      return () => clearInterval(interval)
    }
  }, [currentBlast])



  const loadPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded phone numbers:', data)
        setAvailableNumbers(Array.isArray(data) ? data : data.phoneNumbers || [])
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    }
  }

  const checkForActiveBlast = async () => {
    try {
      const response = await fetch('/api/text-blast')
      if (response.ok) {
        const data = await response.json()
        const activeBlast = data.blasts?.find((blast: TextBlast) =>
          ['running', 'paused'].includes(blast.status)
        )
        if (activeBlast) {
          setCurrentBlast(activeBlast)
          // Restore blast settings
          setMessage(activeBlast.message)
          setBlastName(activeBlast.name || "")
          setDelaySeconds(activeBlast.delaySeconds)
          const senderNumbers = JSON.parse(activeBlast.senderNumbers)
          setSelectedNumbers(senderNumbers)

          // Restore selected contacts
          const selectedContactIds = JSON.parse(activeBlast.selectedContacts)
          const restoredContacts = contacts.filter(c => selectedContactIds.includes(c.id))
          setSelectedContacts(restoredContacts)

          // Trigger immediate status refresh to get current progress
          setTimeout(() => {
            refreshBlastStatus()
          }, 500)
        }
      }
    } catch (error) {
      console.error('Error checking for active blast:', error)
    }
  }

  const refreshBlastStatus = async () => {
    if (!currentBlast) return

    try {
      const response = await fetch(`/api/text-blast/${currentBlast.id}`)
      if (response.ok) {
        const data = await response.json()
        const blast = data.blast
        setCurrentBlast(blast)

        // Update detailed progress
        const remainingCount = blast.totalContacts - blast.sentCount
        const estimatedTimeRemaining = remainingCount * blast.delaySeconds

        setBlastProgress({
          currentIndex: blast.currentIndex || 0,
          totalContacts: blast.totalContacts,
          sentCount: blast.sentCount,
          failedCount: blast.failedCount || 0,
          remainingCount,
          currentMessage: blast.message,
          estimatedTimeRemaining
        })

        // Get current processing contact if blast is running
        if (blast.status === 'running' && blast.currentIndex < blast.totalContacts) {
          const selectedContactIds = JSON.parse(blast.selectedContacts)
          const currentContactId = selectedContactIds[blast.currentIndex]
          const currentContact = contacts.find(c => c.id === currentContactId)
          setCurrentProcessingContact(currentContact || null)
        } else {
          setCurrentProcessingContact(null)
        }
      }
    } catch (error) {
      console.error('Error refreshing blast status:', error)
    }
  }

  const handleTemplateSelect = (template: MessageTemplate | null) => {
    setSelectedTemplate(template)
  }

  const handleTemplateApply = (content: string) => {
    setMessage(content)
  }

  const handleStartBlast = async () => {
    if (!message.trim() || selectedContacts.length === 0 || selectedNumbers.length === 0) {
      toast({
        title: "Cannot start blast",
        description: "Please select contacts, sender numbers, and enter a message",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Create blast
      const createResponse = await fetch('/api/text-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: blastName || `Text Blast ${new Date().toLocaleString()}`,
          message,
          selectedContacts,
          senderNumbers: selectedNumbers,
          delaySeconds,
        }),
      })

      if (!createResponse.ok) {
        throw new Error('Failed to create blast')
      }

      const createData = await createResponse.json()
      setCurrentBlast(createData.blast)

      // Start blast
      const startResponse = await fetch(`/api/text-blast/${createData.blast.id}/start`, {
        method: 'POST',
      })

      if (!startResponse.ok) {
        throw new Error('Failed to start blast')
      }

      const startData = await startResponse.json()
      setCurrentBlast(startData.blast)

      toast({
        title: "Text blast started",
        description: `Sending messages to ${selectedContacts.length} contacts`,
      })
    } catch (error) {
      toast({
        title: "Error starting blast",
        description: "Failed to start the text blast. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePauseBlast = async () => {
    if (!currentBlast) return

    try {
      const response = await fetch(`/api/text-blast/${currentBlast.id}/pause`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentBlast(data.blast)
        toast({
          title: "Blast paused",
          description: "Message sending has been paused",
        })
      }
    } catch (error) {
      toast({
        title: "Error pausing blast",
        description: "Failed to pause the blast",
        variant: "destructive",
      })
    }
  }

  const handleResumeBlast = async () => {
    if (!currentBlast) return

    try {
      const response = await fetch(`/api/text-blast/${currentBlast.id}/resume`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentBlast(data.blast)
        toast({
          title: "Blast resumed",
          description: "Message sending has been resumed",
        })
      }
    } catch (error) {
      toast({
        title: "Error resuming blast",
        description: "Failed to resume the blast",
        variant: "destructive",
      })
    }
  }

  const getProgress = () => {
    if (!currentBlast) return 0
    return (currentBlast.sentCount / currentBlast.totalContacts) * 100
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

  return (
    <div className="space-y-6">
      {/* Completed Blast Status */}
      {currentBlast && currentBlast.status === 'completed' && (
        <Alert className="border-green-200 bg-green-50">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-green-800">{currentBlast.name || 'Text Blast'} Completed!</strong>
                <div className="text-sm text-green-700">
                  ✅ {currentBlast.sentCount} messages sent successfully
                  {currentBlast.failedCount > 0 && (
                    <span className="text-red-600"> • {currentBlast.failedCount} failed</span>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCurrentBlast(null)}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Blast Status */}
      {currentBlast && ['running', 'paused'].includes(currentBlast.status) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${currentBlast.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <CardTitle className="text-lg">
                  {currentBlast.name || 'Text Blast'} - {currentBlast.status.toUpperCase()}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                {currentBlast.status === 'running' && (
                  <Button size="sm" variant="outline" onClick={handlePauseBlast}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                {currentBlast.status === 'paused' && (
                  <Button size="sm" variant="outline" onClick={handleResumeBlast}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={refreshBlastStatus}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress: {currentBlast.sentCount} of {currentBlast.totalContacts} sent</span>
                <span>{Math.round(getProgress())}% complete</span>
              </div>
              <Progress value={getProgress()} className="h-2" />
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium text-green-600">Sent</div>
                <div className="text-xl font-bold">{currentBlast.sentCount}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium text-red-600">Failed</div>
                <div className="text-xl font-bold">{currentBlast.failedCount || 0}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium text-blue-600">Remaining</div>
                <div className="text-xl font-bold">{blastProgress?.remainingCount || (currentBlast.totalContacts - currentBlast.sentCount)}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium text-purple-600">Est. Time</div>
                <div className="text-lg font-bold">
                  {blastProgress?.estimatedTimeRemaining ?
                    `${Math.ceil(blastProgress.estimatedTimeRemaining / 60)}m` :
                    'Calculating...'
                  }
                </div>
              </div>
            </div>

            {/* Current Processing */}
            {currentBlast.status === 'running' && currentProcessingContact && (
              <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                <div className="font-medium text-sm text-gray-600 mb-2">Currently Processing:</div>
                <div className="font-semibold">
                  {currentProcessingContact.firstName} {currentProcessingContact.lastName}
                </div>
                <div className="text-sm text-gray-600">
                  {formatPhoneNumberForDisplay(getBestPhoneNumber(currentProcessingContact))} •
                  {currentProcessingContact.llcName || 'No company'}
                </div>
              </div>
            )}

            {/* Current Message Preview */}
            {blastProgress?.currentMessage && (
              <div className="bg-white p-4 rounded-lg">
                <div className="font-medium text-sm text-gray-600 mb-2">Message Being Sent:</div>
                <div className="text-sm bg-gray-50 p-3 rounded border italic">
                  {currentProcessingContact ?
                    formatMessage(blastProgress.currentMessage, currentProcessingContact) :
                    blastProgress.currentMessage
                  }
                </div>
              </div>
            )}

            {/* Pause Message */}
            {currentBlast.status === 'paused' && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-800">
                  ⏸️ Blast is paused. Click "Resume" to continue sending messages.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
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

          {/* Message Delay Settings */}
          <MessageDelaySettings
            delaySeconds={delaySeconds}
            onDelaySecondsChange={setDelaySeconds}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Sender Number Selection */}
          <SenderNumberSelection
            availableNumbers={availableNumbers}
            selectedNumbers={selectedNumbers}
            onSelectedNumbersChange={setSelectedNumbers}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            rotationEnabled={rotationEnabled}
            onRotationEnabledChange={setRotationEnabled}
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
                <Label htmlFor="blastName">Blast Name (Optional)</Label>
                <Input
                  id="blastName"
                  placeholder="My Text Blast Campaign"
                  value={blastName}
                  onChange={(e) => setBlastName(e.target.value)}
                />
              </div>
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

          {/* Send Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Button
                  onClick={handleStartBlast}
                  disabled={isLoading || !message.trim() || selectedContacts.length === 0 || selectedNumbers.length === 0 || (currentBlast && ['running', 'paused'].includes(currentBlast.status))}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isLoading ? "Starting..." : "Start Blast"}
                </Button>

              </div>
              
              {/* Summary */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Recipients:</span> {selectedContacts.length}
                  </div>
                  <div>
                    <span className="font-medium">Sender Numbers:</span> {selectedNumbers.length}
                  </div>
                  <div>
                    <span className="font-medium">Delay:</span> {delaySeconds}s between messages
                  </div>
                  <div>
                    <span className="font-medium">Est. Time:</span> {
                      selectedContacts.length > 0 
                        ? `~${Math.ceil((selectedContacts.length - 1) * delaySeconds / 60)}m`
                        : "0m"
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
