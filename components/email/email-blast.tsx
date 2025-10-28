"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Send, Users, Clock, Mail, FileText, Settings, Play, Pause, Square, Filter, X, Check, ChevronLeft, ChevronRight, Search } from "lucide-react"
import AdvancedFiltersRedesign from "@/components/contacts/advanced-filters-redesign"
import ContactName from "@/components/contacts/contact-name"
import EmailTemplateManager from "./email-template-manager"
import { useContacts } from "@/lib/context/contacts-context"
import { getBestPhoneNumber, formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import type { Contact } from "@/lib/types"

interface EmailBlastProps {
  emailAccounts: Array<{
    id: string
    emailAddress: string
    displayName: string
    isDefault: boolean
    status: string
  }>
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface EmailBlast {
  id: string
  name?: string
  subject: string
  content: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed'
  totalContacts: number
  sentCount: number
  failedCount: number
  startedAt?: string
  completedAt?: string
}

export default function EmailBlast({ emailAccounts }: EmailBlastProps) {
  // Show setup message if no email accounts
  if (emailAccounts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Mail className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No Email Accounts</h2>
          <p className="text-muted-foreground mb-6">
            Add an email account to start sending email blasts. You can still view email conversations without an account.
          </p>
          <p className="text-sm text-muted-foreground">
            Go to the Email Center header and click "Manage Accounts" to add your first email account.
          </p>
        </div>
      </div>
    )
  }
  const { toast } = useToast()
  const { contacts, searchContacts, pagination, goToPage, currentFilters, currentQuery, isLoading: contactsLoading } = useContacts()
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [subject, setSubject] = useState("")
  const [emailContent, setEmailContent] = useState("")
  const [ccEmails, setCcEmails] = useState("")
  const [bccEmails, setBccEmails] = useState("")
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(5)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [activeBlasts, setActiveBlasts] = useState<EmailBlast[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Set default email account
  useEffect(() => {
    const defaultAccount = emailAccounts.find(acc => acc.isDefault) || emailAccounts[0]
    if (defaultAccount) {
      setSelectedAccount(defaultAccount.id)
    }
  }, [emailAccounts])

  // Load active blasts
  useEffect(() => {
    loadActiveBlasts()
  }, [])


  // Reset contacts context to full, unfiltered list on mount so totals are accurate
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

  // Poll for active blast updates only when there are active blasts
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (activeBlasts.length > 0) {
      console.log(`Starting polling for ${activeBlasts.length} active blasts`) // Debug log
      interval = setInterval(() => {
        console.log('Polling for active blasts...') // Debug log
        loadActiveBlasts()
      }, 15000) // Increased to every 15 seconds
    } else {
      console.log('No active blasts, stopping polling') // Debug log
    }

    return () => {
      if (interval) {
        console.log('Clearing polling interval') // Debug log
        clearInterval(interval)
      }
    }
  }, [activeBlasts.length])

  const loadActiveBlasts = async () => {
    try {
      console.log('Loading active blasts...') // Debug log
      const response = await fetch('/api/email/blasts?status=active')
      if (response.ok) {
        const data = await response.json()
        console.log('Active blasts loaded:', data.blasts?.length || 0) // Debug log
        setActiveBlasts(data.blasts || [])
      }
    } catch (error) {
      console.error('Error loading active blasts:', error)
    }
  }

  // Template handlers
  const handleTemplateSelect = (template: EmailTemplate | null) => {
    setSelectedTemplate(template)
  }

  const handleTemplateApply = (subject: string, content: string) => {
    setSubject(subject)
    setEmailContent(content)
  }

  const startEmailBlast = async () => {
    if (!selectedAccount || !subject.trim() || !emailContent.trim() || selectedContacts.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select email account, fill in subject/content, and select contacts',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/email/blasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Email Blast - ${subject.trim()} - ${new Date().toLocaleDateString()}`,
          emailAccountId: selectedAccount,
          subject: subject.trim(),
          content: emailContent.trim(),
          textContent: emailContent.trim().replace(/<[^>]*>/g, ''), // Strip HTML for text version
          contactIds: selectedContacts.map(c => c.id),
          ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
          bccEmails: bccEmails.split(',').map(e => e.trim()).filter(Boolean),
          delayBetweenEmails,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Start the blast
        const startResponse = await fetch(`/api/email/blasts/${data.blast.id}/start`, {
          method: 'POST',
        })

        if (startResponse.ok) {
          toast({
            title: 'Success',
            description: `Email blast started! Sending to ${selectedContacts.length} contacts.`,
          })
          loadActiveBlasts()
        } else {
          throw new Error('Failed to start blast')
        }
      } else {
        throw new Error('Failed to create blast')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start email blast',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const controlBlast = async (blastId: string, action: 'pause' | 'resume' | 'stop') => {
    try {
      const response = await fetch(`/api/email/blasts/${blastId}/${action}`, {
        method: 'POST',
      })

      if (response.ok) {
        loadActiveBlasts()
        toast({
          title: 'Success',
          description: `Email blast ${action}d successfully`,
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} email blast`,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Active Blasts */}
        {activeBlasts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Active Email Blasts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeBlasts.map((blast) => (
                  <div key={blast.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{blast.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          {blast.sentCount} of {blast.totalContacts} sent
                          {blast.failedCount > 0 && ` • ${blast.failedCount} failed`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          blast.status === 'running' ? 'default' :
                          blast.status === 'paused' ? 'secondary' :
                          blast.status === 'completed' ? 'outline' : 'destructive'
                        }>
                          {blast.status}
                        </Badge>
                        {blast.status === 'running' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => controlBlast(blast.id, 'pause')}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {blast.status === 'paused' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => controlBlast(blast.id, 'resume')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => controlBlast(blast.id, 'stop')}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress
                      value={(blast.sentCount / blast.totalContacts) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Selection
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

        {/* Email Account Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Sender Email Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select email account" />
              </SelectTrigger>
              <SelectContent>
                {emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <span>{account.displayName}</span>
                      <span className="text-muted-foreground text-sm">
                        ({account.emailAddress})
                      </span>
                      {account.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Email Template Manager */}
        <EmailTemplateManager
          selectedTemplate={selectedTemplate}
          onTemplateSelect={handleTemplateSelect}
          onTemplateApply={handleTemplateApply}
        />

        {/* Email Content */}
        <Card>
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                placeholder="Email Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder="CC emails (comma separated)"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                />
              </div>
              <div>
                <Input
                  placeholder="BCC emails (comma separated)"
                  value={bccEmails}
                  onChange={(e) => setBccEmails(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Textarea
                placeholder="Email content (HTML supported)"
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={8}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Delay Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Delivery Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Delay between emails:</label>
              <Select
                value={delayBetweenEmails.toString()}
                onValueChange={(value) => setDelayBetweenEmails(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No delay</SelectItem>
                  <SelectItem value="1">1 second</SelectItem>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Start Blast Button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {selectedContacts.length} contacts selected
                </Badge>
                {selectedAccount && (
                  <Badge variant="outline">
                    From: {emailAccounts.find(a => a.id === selectedAccount)?.emailAddress}
                  </Badge>
                )}
              </div>
              <Button
                onClick={startEmailBlast}
                disabled={isLoading || !selectedAccount || !subject.trim() || !emailContent.trim() || selectedContacts.length === 0}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Start Email Blast
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
