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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Send, Users, MessageSquare, Play, Pause, Square, RefreshCw, AlertCircle, Filter, X, Check, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import AdvancedFiltersRedesign from "@/components/contacts/advanced-filters-redesign"
import ContactName from "@/components/contacts/contact-name"
import SenderNumberSelection from "./sender-number-selection"
import MessageDelaySettings from "./message-delay-settings"
import TemplateManager from "./template-manager"
import { useContacts } from "@/lib/context/contacts-context"
import { getBestPhoneNumber, formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { formatMessageTemplate, AVAILABLE_TEMPLATE_VARIABLES } from "@/lib/message-template"
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
  const { contacts, searchContacts, pagination, goToPage, currentFilters, currentQuery, isLoading: contactsLoading } = useContacts()
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

  // Contact selection state
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const { toast } = useToast()

  // Debug logging
  console.log('EnhancedTextBlast - availableNumbers:', availableNumbers)
  console.log('EnhancedTextBlast - selectedNumbers:', selectedNumbers)

  // Ensure we start from the full contact list when opening Text Blast
  useEffect(() => {
    searchContacts('', {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync local search query with context query
  useEffect(() => {
    if (currentQuery !== searchQuery) {
      setSearchQuery(currentQuery)
    }
  }, [currentQuery])

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== currentQuery) {
        searchContacts(searchQuery, currentFilters || {})
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, currentQuery, currentFilters])

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

  // Use the shared formatMessageTemplate utility for consistent template processing
  const formatMessage = (template: string, contact: Contact): string => {
    return formatMessageTemplate(template, contact as any)
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
          {/* Contact Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contact Selection
                {selectedContacts.length > 0 && (
                  <Badge variant="default" className="ml-2">
                    {selectedContacts.length} selected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search contacts..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {/* Advanced Filters Button with Popup - Full Width */}
                <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {Object.values(currentFilters || {}).filter(v => Array.isArray(v) ? v.length > 0 : v).length > 0 && (
                        <Badge variant="default" className="ml-2">
                          {Object.values(currentFilters || {}).filter(v => Array.isArray(v) ? v.length > 0 : v).length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[700px] p-0"
                    align="start"
                    side="bottom"
                  >
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                      {/* Filter Header */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAdvancedFilters(false)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Filter Content */}
                      <div className="p-4 max-h-[600px] overflow-y-auto">
                        <AdvancedFiltersRedesign onClose={() => setShowAdvancedFilters(false)} />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Select All Contacts Button - Full Width */}
                <Button
                  variant={selectedContacts.length === (pagination?.totalCount || 0) && selectedContacts.length > 0 ? "default" : "outline"}
                  className={`w-full ${selectedContacts.length === (pagination?.totalCount || 0) && selectedContacts.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                  onClick={async () => {
                    // Check if all contacts are already selected
                    const allSelected = selectedContacts.length === (pagination?.totalCount || 0) && selectedContacts.length > 0

                    if (allSelected) {
                      // Deselect all
                      setSelectedContacts([])
                      toast({
                        title: "All Contacts Deselected",
                        description: "Contact selection cleared",
                      })
                    } else {
                      // Select all contacts across all pages
                      try {
                        setIsLoading(true)

                        // Build params with current search and filters
                        const params = new URLSearchParams({
                          page: '1',
                          limit: '20000', // Max limit to get all contacts
                          ...(searchQuery && { search: searchQuery }),
                          ...currentFilters
                        })

                        console.log('🔍 Fetching all contacts with params:', Object.fromEntries(params))

                        const response = await fetch('/api/contacts?' + params)
                        const data = await response.json()

                        console.log('📦 Received contacts:', data.contacts?.length, 'Total:', data.pagination?.totalCount)

                        if (data.contacts && data.contacts.length > 0) {
                          setSelectedContacts(data.contacts)
                          toast({
                            title: "All Contacts Selected",
                            description: `Selected ${data.contacts.length} contacts across all pages`,
                          })
                        } else {
                          toast({
                            title: "No Contacts Found",
                            description: "No contacts match the current filters",
                            variant: "destructive"
                          })
                        }
                      } catch (error) {
                        console.error('Error selecting all contacts:', error)
                        toast({
                          title: "Error",
                          description: "Failed to select all contacts",
                          variant: "destructive"
                        })
                      } finally {
                        setIsLoading(false)
                      }
                    }
                  }}
                >
                  {selectedContacts.length === (pagination?.totalCount || 0) && selectedContacts.length > 0 ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Deselect All Contacts ({pagination?.totalCount || 0})
                    </>
                  ) : (
                    <>
                      Select All Contacts ({pagination?.totalCount || 0})
                    </>
                  )}
                </Button>
              </div>

              {/* Contact List */}
              <ScrollArea className="h-[400px] border rounded-md">
                <div className="p-2 space-y-1">
                  {contactsLoading ? (
                    <div className="text-center text-gray-500 py-8">Loading contacts...</div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No contacts found</div>
                  ) : (
                    contacts.map(contact => {
                      const isSelected = selectedContacts.some(c => c.id === contact.id)
                      const contactTags = (contact as any).tags || []
                      return (
                        <div
                          key={contact.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={isSelected}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isSelected) {
                                setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id))
                              } else {
                                setSelectedContacts([...selectedContacts, contact])
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              <ContactName contact={contact} clickMode="popup" stopPropagation />
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {contact.email1 || formatPhoneNumberForDisplay(getBestPhoneNumber(contact))} • {contact.propertyAddress}
                            </div>
                            {contactTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {contactTags.slice(0, 3).map((tag: any) => (
                                  <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-xs px-1.5 py-0"
                                    style={{
                                      backgroundColor: tag.color ? `${tag.color}20` : undefined,
                                      color: tag.color || undefined,
                                      borderColor: tag.color || undefined,
                                    }}
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                                {contactTags.length > 3 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    +{contactTags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.page + 1)}
                      disabled={!pagination.hasMore}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
            selectedContactsCount={selectedContacts.length}
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
                  <details className="cursor-pointer">
                    <summary className="hover:text-foreground">Available variables (click to expand)</summary>
                    <div className="mt-1 p-2 bg-muted rounded text-xs">
                      <div className="font-medium mb-1">Contact Info:</div>
                      <div>{"{firstName}"}, {"{lastName}"}, {"{fullName}"}, {"{llcName}"}</div>
                      <div>{"{phone}"}, {"{phone1}"}, {"{phone2}"}, {"{phone3}"}</div>
                      <div>{"{email}"}, {"{email1}"}, {"{email2}"}, {"{email3}"}</div>
                      <div className="font-medium mt-2 mb-1">Property (numbered for multi-property contacts):</div>
                      <div>{"{propertyAddress1}"}, {"{city1}"}, {"{state1}"}, {"{zipCode1}"}, {"{llcName1}"}, {"{estValue1}"}</div>
                      <div>{"{propertyAddress2}"}, {"{city2}"}, {"{state2}"}, {"{zipCode2}"}, {"{llcName2}"}, {"{estValue2}"}</div>
                      <div>{"{propertyAddress3}"}, {"{city3}"}, {"{state3}"}, {"{zipCode3}"}, {"{llcName3}"}, {"{estValue3}"}</div>
                      <div className="font-medium mt-2 mb-1">Legacy (primary property):</div>
                      <div>{"{propertyAddress}"}, {"{city}"}, {"{state}"}, {"{propertyType}"}, {"{estValue}"}</div>
                    </div>
                  </details>
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
                  <div>
                    <span className="font-medium">Est. Price:</span> ${(selectedContacts.length * 0.080).toFixed(2)}
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
