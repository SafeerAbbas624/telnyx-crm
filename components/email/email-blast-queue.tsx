"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Send,
  Play,
  Pause,
  Square,
  Trash2,
  Mail,
  Tag,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import type { Contact } from "@/lib/types"

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  isDefault: boolean
  status: string
}

interface TagType {
  id: string
  name: string
  color: string
  usage_count?: number
}

interface QueueContact extends Contact {
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'removed'
  sentAt?: Date
  error?: string
}

interface EmailBlastQueueProps {
  emailAccounts: EmailAccount[]
  onBlastComplete?: () => void
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  category?: string
}

export default function EmailBlastQueue({ emailAccounts, onBlastComplete }: EmailBlastQueueProps) {
  // Tag & Contact Selection
  const [tags, setTags] = useState<TagType[]>([])
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [queueContacts, setQueueContacts] = useState<QueueContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)

  // Email Account
  const [selectedAccount, setSelectedAccount] = useState<string>("")

  // Message
  const [subject, setSubject] = useState("")
  const [emailContent, setEmailContent] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])

  // Preview
  const [previewIndex, setPreviewIndex] = useState(0)

  // Delay Settings (1-60 seconds)
  const [delaySeconds, setDelaySeconds] = useState(5)

  // Blast State
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [startIndex, setStartIndex] = useState(0)
  const blastRef = useRef<{ shouldStop: boolean }>({ shouldStop: false })

  // Backend blast state
  const [activeBlastId, setActiveBlastId] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Scroll ref for auto-scroll during blast
  const queueScrollRef = useRef<HTMLDivElement>(null)

  // Stats
  const [sentCount, setSentCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  // Show setup message if no email accounts
  if (emailAccounts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Mail className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No Email Accounts</h2>
          <p className="text-muted-foreground mb-6">
            Add an email account to start sending email blasts.
          </p>
          <p className="text-sm text-muted-foreground">
            Go to Email Center → Manage Accounts to add your first email account.
          </p>
        </div>
      </div>
    )
  }

  // Load initial data and check for running blast
  useEffect(() => {
    loadTags()
    loadTemplates()
    checkForRunningBlast()
    // Set default account
    const defaultAccount = emailAccounts.find(acc => acc.isDefault) || emailAccounts[0]
    if (defaultAccount) setSelectedAccount(defaultAccount.id)
  }, [emailAccounts])

  const loadTags = async () => {
    try {
      // Use includeUsage=true to get contact counts per tag (same as text blast)
      const response = await fetch('/api/tags?includeUsage=true')
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags || [])
      }
    } catch (error) {
      console.error('Error loading tags:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      // Correct endpoint is /api/email/templates
      const response = await fetch('/api/email/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || data || [])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const loadContactsByTag = async (tagId: string) => {
    if (!tagId) return
    setLoadingContacts(true)
    try {
      // Use 'tags' parameter (not 'tagId') - the API filters by tag ID
      const response = await fetch(`/api/contacts?tags=${tagId}&limit=10000`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only contacts that have an email address
        const contactsWithEmail = (data.contacts || []).filter((c: Contact) =>
          c.email1 || c.email2 || c.email3
        )
        const contacts = contactsWithEmail.map((c: Contact) => ({
          ...c,
          status: 'pending' as const
        }))
        setQueueContacts(contacts)
        setCurrentIndex(0)
        setStartIndex(0)
        setSentCount(0)
        setFailedCount(0)
        toast.success(`Loaded ${contacts.length} contacts with email from tag`)
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      toast.error('Failed to load contacts')
    } finally {
      setLoadingContacts(false)
    }
  }

  const checkForRunningBlast = async () => {
    try {
      const response = await fetch('/api/email-blast?checkRunning=true')
      if (response.ok) {
        const data = await response.json()
        if (data.hasRunning && data.runningBlast) {
          const blast = data.runningBlast
          setActiveBlastId(blast.id)
          setIsRunning(blast.status === 'running')
          setIsPaused(blast.isPaused || blast.status === 'paused')
          setCurrentIndex(blast.currentIndex || 0)
          setSentCount(blast.sentCount || 0)
          setFailedCount(blast.failedCount || 0)
          setSubject(blast.subject || '')
          setEmailContent(blast.content || '')
          setSelectedAccount(blast.emailAccountId || '')
          setDelaySeconds(blast.delayBetweenEmails || 5)

          // Load contacts from blast
          if (blast.selectedContacts) {
            const contactIds = typeof blast.selectedContacts === 'string'
              ? JSON.parse(blast.selectedContacts)
              : blast.selectedContacts
            if (Array.isArray(contactIds) && contactIds.length > 0) {
              await loadContactsFromIds(contactIds, blast.currentIndex || 0)
            }
          }

          if (blast.status === 'running' && !blast.isPaused) {
            startPolling()
          }

          toast.info(`${blast.isPaused ? 'Paused' : 'Running'} blast: ${blast.name || 'Email Blast'} (${blast.sentCount}/${blast.totalContacts} sent)`)
        }
      }
    } catch (error) {
      console.error('Error checking for running blast:', error)
    }
  }

  const loadContactsFromIds = async (contactIds: string[], currentIdx: number) => {
    try {
      const response = await fetch('/api/contacts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: contactIds })
      })
      if (response.ok) {
        const data = await response.json()
        const contacts = (data.contacts || []).map((c: Contact, idx: number) => ({
          ...c,
          status: idx < currentIdx ? 'sent' as const : 'pending' as const
        }))
        setQueueContacts(contacts)
      }
    } catch (error) {
      console.error('Error loading contacts from IDs:', error)
    }
  }

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/email-blast?checkRunning=true')
        if (response.ok) {
          const data = await response.json()
          if (data.hasRunning && data.runningBlast) {
            const blast = data.runningBlast
            setCurrentIndex(blast.currentIndex || 0)
            setSentCount(blast.sentCount || 0)
            setFailedCount(blast.failedCount || 0)
            setIsPaused(blast.isPaused || blast.status === 'paused')
            setIsRunning(blast.status === 'running' && !blast.isPaused)

            // Update contact statuses
            setQueueContacts(prev => prev.map((c, idx) => ({
              ...c,
              status: idx < (blast.currentIndex || 0) ? 'sent' : 'pending'
            })))

            if (blast.status === 'completed' || blast.status === 'cancelled') {
              stopPolling()
              setIsRunning(false)
              setIsPaused(false)
              setActiveBlastId(null)
              toast.success('Email blast completed!')
              onBlastComplete?.()
            }
          } else {
            stopPolling()
            setIsRunning(false)
            setIsPaused(false)
            setActiveBlastId(null)
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000)
  }

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const startBlast = async () => {
    if (!selectedAccount || !subject.trim() || !emailContent.trim() || queueContacts.length === 0) {
      toast.error('Please fill in all required fields')
      return
    }

    // Filter contacts with valid emails
    const contactsWithEmail = queueContacts.filter(c => c.email1)
    if (contactsWithEmail.length === 0) {
      toast.error('No contacts with valid email addresses')
      return
    }

    try {
      const response = await fetch('/api/email-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Email Blast - ${new Date().toLocaleDateString()}`,
          subject,
          content: emailContent,
          emailAccountId: selectedAccount,
          selectedContacts: contactsWithEmail.map(c => c.id),
          delayBetweenEmails: delaySeconds,
          startIndex: startIndex,
        })
      })

      if (response.ok) {
        const data = await response.json()
        setActiveBlastId(data.blast.id)
        setIsRunning(true)
        setIsPaused(false)
        startPolling()
        toast.success('Email blast started!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to start blast')
      }
    } catch (error) {
      console.error('Error starting blast:', error)
      toast.error('Failed to start blast')
    }
  }

  const pauseBlast = async () => {
    if (!activeBlastId) return
    try {
      const response = await fetch(`/api/email-blast/${activeBlastId}/pause`, {
        method: 'POST'
      })
      if (response.ok) {
        setIsPaused(true)
        setIsRunning(false)
        stopPolling()
        toast.info('Email blast paused')
      }
    } catch (error) {
      toast.error('Failed to pause blast')
    }
  }

  const resumeBlast = async () => {
    if (!activeBlastId) return
    try {
      const response = await fetch(`/api/email-blast/${activeBlastId}/resume`, {
        method: 'POST'
      })
      if (response.ok) {
        setIsPaused(false)
        setIsRunning(true)
        startPolling()
        toast.success('Email blast resumed')
      }
    } catch (error) {
      toast.error('Failed to resume blast')
    }
  }

  const stopBlast = async () => {
    if (!activeBlastId) return
    try {
      const response = await fetch(`/api/email-blast/${activeBlastId}/stop`, {
        method: 'POST'
      })
      if (response.ok) {
        setIsRunning(false)
        setIsPaused(false)
        setActiveBlastId(null)
        stopPolling()
        toast.success('Email blast stopped')
      }
    } catch (error) {
      toast.error('Failed to stop blast')
    }
  }

  const killAllBlasts = async () => {
    try {
      const response = await fetch('/api/email-blast/kill-all', {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'All email blasts stopped')
        setIsRunning(false)
        setIsPaused(false)
        setActiveBlastId(null)
        stopPolling()
      } else {
        toast.error('Failed to stop blasts')
      }
    } catch (error) {
      toast.error('Error stopping blasts')
    }
  }

  const removeContact = (contactId: string) => {
    setQueueContacts(prev => prev.filter(c => c.id !== contactId))
  }

  const getContactDisplayName = (contact: Contact) => {
    if (contact.firstName || contact.lastName) {
      return `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
    }
    if (contact.llcName) return contact.llcName
    return contact.email1 || 'Unknown'
  }

  const progress = queueContacts.length > 0
    ? Math.round((currentIndex / queueContacts.length) * 100)
    : 0

  const pendingContacts = queueContacts.filter(c => c.status === 'pending')
  const sentContacts = queueContacts.filter(c => c.status === 'sent')
  const failedContacts = queueContacts.filter(c => c.status === 'failed')

  return (
    <div className="h-full flex gap-6">
      {/* LEFT SIDE - Configuration */}
      <div className="flex-1 space-y-4 overflow-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Blast
            </h2>
            <p className="text-muted-foreground">Send emails to contacts by selecting a tag</p>
          </div>
          {isRunning && (
            <Button
              variant="destructive"
              size="sm"
              onClick={killAllBlasts}
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Kill All Blasts
            </Button>
          )}
        </div>

        {/* Tag Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Select Tag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedTag}
              onValueChange={(value) => {
                setSelectedTag(value)
                loadContactsByTag(value)
              }}
              disabled={isRunning}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a tag to load contacts..." />
              </SelectTrigger>
              <SelectContent>
                {tags.map(tag => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                      {tag.usage_count !== undefined && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {tag.usage_count}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Email Account Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Sender Email Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emailAccounts.map(account => (
              <label
                key={account.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedAccount === account.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="emailAccount"
                  checked={selectedAccount === account.id}
                  onChange={() => setSelectedAccount(account.id)}
                  disabled={isRunning}
                  className="h-4 w-4"
                />
                <div>
                  <div className="font-medium">{account.displayName}</div>
                  <div className="text-xs text-muted-foreground">{account.emailAddress}</div>
                </div>
                {account.isDefault && (
                  <Badge variant="secondary" className="ml-auto text-xs">Default</Badge>
                )}
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={selectedTemplate?.id || ""}
              onValueChange={(value) => {
                const template = templates.find(t => t.id === value)
                setSelectedTemplate(template || null)
                if (template) {
                  setSubject(template.subject)
                  setEmailContent(template.content)
                }
              }}
              disabled={isRunning}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Label className="text-sm">Subject</Label>
              <Input
                placeholder="Email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isRunning}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Email Content</Label>
              <Textarea
                placeholder="Email content (HTML supported)..."
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                disabled={isRunning}
                rows={6}
                className="mt-1 font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Delay Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Delay Between Emails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Slider
                value={[delaySeconds]}
                onValueChange={([value]) => setDelaySeconds(value)}
                min={1}
                max={60}
                step={1}
                disabled={isRunning}
                className="flex-1"
              />
              <span className="text-sm font-medium w-20 text-right">
                {delaySeconds} sec
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Wait time between each email to avoid rate limits
            </p>
          </CardContent>
        </Card>

        {/* Start/Control Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {queueContacts.filter(c => c.email1).length} contacts with email
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {!isRunning && !isPaused && (
                  <Button
                    onClick={startBlast}
                    disabled={!selectedAccount || !subject.trim() || !emailContent.trim() || queueContacts.length === 0}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Blast
                  </Button>
                )}
                {isRunning && (
                  <Button
                    variant="outline"
                    onClick={pauseBlast}
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}
                {isPaused && (
                  <>
                    <Button
                      onClick={resumeBlast}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={stopBlast}
                      className="flex items-center gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT SIDE - Queue */}
      <div className="w-96 flex flex-col gap-4">
        {/* Progress Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Queue Progress
              </span>
              {(isRunning || isPaused) && (
                <Badge variant={isRunning ? "default" : "secondary"}>
                  {isRunning ? "Running" : "Paused"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm">
              <span>{currentIndex} / {queueContacts.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-green-50 rounded">
                <div className="font-bold text-green-600">{sentCount}</div>
                <div className="text-muted-foreground">Sent</div>
              </div>
              <div className="p-2 bg-red-50 rounded">
                <div className="font-bold text-red-600">{failedCount}</div>
                <div className="text-muted-foreground">Failed</div>
              </div>
              <div className="p-2 bg-blue-50 rounded">
                <div className="font-bold text-blue-600">{queueContacts.length - currentIndex}</div>
                <div className="text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Up in Queue */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Next Up in Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-[300px]" ref={queueScrollRef}>
              <div className="space-y-2">
                {loadingContacts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingContacts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {queueContacts.length === 0
                      ? "Select a tag to load contacts"
                      : "All contacts processed!"}
                  </div>
                ) : (
                  pendingContacts.slice(0, 20).map((contact, idx) => (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-2 p-2 rounded border ${
                        idx === 0 && isRunning ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {getContactDisplayName(contact)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {contact.email1 || 'No email'}
                        </div>
                      </div>
                      {!isRunning && !isPaused && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContact(contact.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
                {pendingContacts.length > 20 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    +{pendingContacts.length - 20} more contacts
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Sent Contacts */}
        {sentContacts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Recently Sent ({sentContacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {sentContacts.slice(-10).reverse().map(contact => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 p-2 rounded bg-green-50"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {getContactDisplayName(contact)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {contact.email1}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

