"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Phone, X, MessageSquare, Mail, PhoneCall, Minimize2, Building, MapPin, Plus, User, ListTodo, Loader2, Tag, Voicemail, Volume2 } from "lucide-react"

import { useMultiCall, ManualDialerCall } from "@/lib/context/multi-call-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { useContactPanel } from "@/lib/context/contact-panel-context"
import { useToast } from "@/hooks/use-toast"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

interface CallCardProps {
  call: ManualDialerCall
  isPrimary: boolean
  onHangUp: () => void
  onDismiss: () => void
  onSms: (fromNumber?: string) => void
  onViewContact: () => void
  onCallBack: () => void
  onSwitchTo?: () => void
}

function ExpandedCallCard({ call, isPrimary, onHangUp, onDismiss, onSms, onViewContact, onCallBack, onSwitchTo }: CallCardProps) {
  const [elapsed, setElapsed] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [contactDetails, setContactDetails] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [showQuickTask, setShowQuickTask] = useState(false)
  const [quickTaskTitle, setQuickTaskTitle] = useState("")
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)
  const [showTagPopover, setShowTagPopover] = useState(false)
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [tagSearchQuery, setTagSearchQuery] = useState("")
  const [loadingTags, setLoadingTags] = useState(false)
  const [showVoicemailDropPopover, setShowVoicemailDropPopover] = useState(false)
  const [voicemailMessages, setVoicemailMessages] = useState<any[]>([])
  const [loadingVoicemails, setLoadingVoicemails] = useState(false)
  const [droppingVoicemail, setDroppingVoicemail] = useState(false)
  const [voicemailDropStatus, setVoicemailDropStatus] = useState<string | null>(null)
  const { toast } = useToast()
  const { openEmail } = useEmailUI()
  const { openContactPanel } = useContactPanel()

  // Draft key for localStorage
  const draftKey = call.contactId ? `note-draft-${call.contactId}` : null

  // Load draft from localStorage on mount
  useEffect(() => {
    if (draftKey) {
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        setNotes(savedDraft)
      }
    }
  }, [draftKey])

  // Auto-save draft to localStorage on note change
  useEffect(() => {
    if (draftKey && notes) {
      localStorage.setItem(draftKey, notes)
    }
  }, [notes, draftKey])

  // Timer for elapsed time
  useEffect(() => {
    if (call.status === 'ended' || call.status === 'failed') return

    const startTime = call.startedAt
    setElapsed(Math.floor((Date.now() - startTime) / 1000))

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [call.startedAt, call.status])

  // Load contact details - by ID if available, otherwise search by phone number
  useEffect(() => {
    const loadContact = async () => {
      try {
        if (call.contactId) {
          // Load contact by ID
          const res = await fetch(`/api/contacts/${call.contactId}`)
          if (res.ok) {
            const data = await res.json()
            setContactDetails(data)
          }
        } else if (call.phoneNumber) {
          // Try to find contact by phone number using lookup-by-number API
          const res = await fetch(`/api/contacts/lookup-by-number?number=${encodeURIComponent(call.phoneNumber)}`)
          if (res.ok) {
            const data = await res.json()
            if (data.id) {
              setContactDetails(data)
              // Update the call object's contactId for future reference
              call.contactId = data.id
              call.contactName = `${data.firstName || ''} ${data.lastName || ''}`.trim()
            }
          }
        }
      } catch (error) {
        console.error('Error loading contact:', error)
      }
    }
    loadContact()
  }, [call.contactId, call.phoneNumber])

  // Status-based styling
  const getStatusStyles = () => {
    switch (call.status) {
      case 'ringing':
        return {
          border: 'border-yellow-500',
          bg: 'bg-yellow-50',
          badge: 'bg-yellow-500',
          text: 'Ringing...'
        }
      case 'connected':
        return {
          border: 'border-green-500',
          bg: 'bg-green-50',
          badge: 'bg-green-600',
          text: 'Connected'
        }
      case 'ended':
        return {
          border: 'border-orange-500',
          bg: 'bg-orange-50',
          badge: 'bg-orange-500',
          text: 'Ended'
        }
      case 'failed':
        return {
          border: 'border-red-400',
          bg: 'bg-red-50',
          badge: 'bg-red-500',
          text: 'Failed'
        }
      default:
        return {
          border: 'border-gray-300',
          bg: 'bg-white',
          badge: 'bg-gray-500',
          text: 'Unknown'
        }
    }
  }

  const styles = getStatusStyles()
  const isActive = call.status === 'ringing' || call.status === 'connected'
  const isEnded = call.status === 'ended' || call.status === 'failed'
  // Use contactDetails if we resolved the contact by phone number, otherwise fall back to call.contactName
  const contactName = contactDetails
    ? `${contactDetails.firstName || ''} ${contactDetails.lastName || ''}`.trim() || 'Unknown'
    : call.contactName || 'Unknown'
  const phoneNumber = call.phoneNumber
  // Effective contact ID - prefer contactDetails if we found the contact by phone lookup
  const effectiveContactId = contactDetails?.id || call.contactId

  // Handle saving notes
  const handleSaveNotes = async () => {
    if (!notes.trim() || !effectiveContactId) return
    setSavingNotes(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: effectiveContactId,
          type: 'note',
          title: 'Call Note',
          description: notes,
        }),
      })
      if (res.ok) {
        toast({ title: 'Note Saved', description: 'Note added to contact' })
        setNotes('')
        // Clear draft from localStorage
        if (draftKey) {
          localStorage.removeItem(draftKey)
        }
        // Emit event to notify activity history to refresh
        window.dispatchEvent(new CustomEvent('activity-created', {
          detail: { contactId: effectiveContactId }
        }))
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save note', variant: 'destructive' })
    } finally {
      setSavingNotes(false)
    }
  }

  // Handle quick task creation
  const handleCreateQuickTask = async () => {
    if (!quickTaskTitle.trim() || !effectiveContactId) return
    setCreatingTask(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: quickTaskTitle,
          contactId: effectiveContactId,
          dueDate: quickTaskDueDate || undefined,
          status: 'pending',
        }),
      })
      if (res.ok) {
        const newTask = await res.json()
        toast({ title: 'Task Created', description: 'Task added to contact' })
        setQuickTaskTitle('')
        setQuickTaskDueDate('')
        setShowQuickTask(false)
        // Emit event to notify task lists to refresh
        window.dispatchEvent(new CustomEvent('task-created', {
          detail: { contactId: effectiveContactId, task: newTask }
        }))
      } else {
        const error = await res.json()
        toast({ title: 'Error', description: error.error || 'Failed to create task', variant: 'destructive' })
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create task', variant: 'destructive' })
    } finally {
      setCreatingTask(false)
    }
  }

  // Load available tags when popover opens
  const loadTags = async () => {
    if (loadingTags) return
    setLoadingTags(true)
    try {
      const res = await fetch('/api/contacts/tags')
      if (res.ok) {
        const data = await res.json()
        setAvailableTags(data)
      }
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoadingTags(false)
    }
  }

  // Add tag to contact - optimistic update for instant feedback
  const addTagToContact = async (tag: any) => {
    if (!effectiveContactId) return
    const currentTags = contactDetails?.tags || []
    const newTags = [...currentTags, { id: tag.id, name: tag.name, color: tag.color }]

    // Optimistic update - show immediately
    setContactDetails((prev: any) => ({ ...prev, tags: newTags }))
    toast({ title: 'Tag Added', description: `Added "${tag.name}" tag` })

    // Then sync to server in background
    try {
      const res = await fetch(`/api/contacts/${effectiveContactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
      if (!res.ok) {
        // Revert on failure
        setContactDetails((prev: any) => ({ ...prev, tags: currentTags }))
        toast({ title: 'Error', description: 'Failed to add tag', variant: 'destructive' })
      }
    } catch (error: any) {
      // Revert on failure
      setContactDetails((prev: any) => ({ ...prev, tags: currentTags }))
      toast({ title: 'Error', description: 'Failed to add tag', variant: 'destructive' })
    }
  }

  // Remove tag from contact - optimistic update for instant feedback
  const removeTagFromContact = async (tagId: string) => {
    if (!effectiveContactId) return
    const currentTags = contactDetails?.tags || []
    const removedTag = currentTags.find((t: any) => t.id === tagId)
    const newTags = currentTags.filter((t: any) => t.id !== tagId)

    // Optimistic update - show immediately
    setContactDetails((prev: any) => ({ ...prev, tags: newTags }))
    toast({ title: 'Tag Removed', description: `Removed "${removedTag?.name || 'tag'}"` })

    // Then sync to server in background
    try {
      const res = await fetch(`/api/contacts/${effectiveContactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
      if (!res.ok) {
        // Revert on failure
        setContactDetails((prev: any) => ({ ...prev, tags: currentTags }))
        toast({ title: 'Error', description: 'Failed to remove tag', variant: 'destructive' })
      }
    } catch (error: any) {
      // Revert on failure
      setContactDetails((prev: any) => ({ ...prev, tags: currentTags }))
      toast({ title: 'Error', description: 'Failed to remove tag', variant: 'destructive' })
    }
  }

  // Filter tags based on search and exclude already assigned
  const contactTagIds = new Set((contactDetails?.tags || []).map((t: any) => t.id))
  const filteredAvailableTags = availableTags.filter(
    (t) => !contactTagIds.has(t.id) && t.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  )

  // Fetch voicemail messages when popover opens
  const fetchVoicemailMessages = async () => {
    if (voicemailMessages.length > 0) return // Already loaded
    setLoadingVoicemails(true)
    try {
      const res = await fetch('/api/voicemail-messages')
      if (res.ok) {
        const data = await res.json()
        setVoicemailMessages(data.voicemails || [])
      }
    } catch (error) {
      console.error('Failed to fetch voicemail messages:', error)
    } finally {
      setLoadingVoicemails(false)
    }
  }

  // Drop voicemail on the call
  const handleVoicemailDrop = async (voicemailId: string, voicemailName: string) => {
    if (!call.telnyxCall?.callControlId && !call.id) {
      toast({ title: 'Error', description: 'No active call to drop voicemail', variant: 'destructive' })
      return
    }

    setDroppingVoicemail(true)
    setVoicemailDropStatus('Dropping voicemail...')
    setShowVoicemailDropPopover(false)

    try {
      const callControlId = call.telnyxCall?.callControlId || call.id
      const res = await fetch('/api/calls/voicemail-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callControlId, voicemailMessageId: voicemailId }),
      })

      if (res.ok) {
        setVoicemailDropStatus(`Playing "${voicemailName}"...`)
        toast({ title: 'Voicemail Drop', description: `Playing "${voicemailName}"` })
        // Auto-clear status after 10 seconds (typical voicemail length)
        setTimeout(() => {
          setVoicemailDropStatus(null)
          setDroppingVoicemail(false)
        }, 10000)
      } else {
        const err = await res.json()
        setVoicemailDropStatus(null)
        setDroppingVoicemail(false)
        toast({ title: 'Error', description: err.error || 'Failed to drop voicemail', variant: 'destructive' })
      }
    } catch (error) {
      setVoicemailDropStatus(null)
      setDroppingVoicemail(false)
      toast({ title: 'Error', description: 'Failed to drop voicemail', variant: 'destructive' })
    }
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div
        className={`${styles.border} ${styles.bg} border-2 rounded-lg p-3 shadow-lg flex items-center gap-3 cursor-pointer`}
        onClick={() => setIsMinimized(false)}
      >
        <div className={`${styles.badge} text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1`}>
          <Phone className="h-3 w-3" />
          {isActive ? formatDuration(elapsed) : styles.text}
        </div>
        <div>
          <div className="font-medium text-sm">{contactName}</div>
          <div className="text-xs text-gray-600">{formatPhoneNumberForDisplay(phoneNumber)}</div>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); if (isActive) { onHangUp(); } onDismiss(); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`w-[380px] ${styles.border} border-2 rounded-lg bg-white shadow-2xl overflow-hidden flex-shrink-0 ${isPrimary && call.status === 'connected' ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Compact Header */}
      <div className={`${styles.bg} px-3 py-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`${styles.badge} text-white px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1`}>
              <Phone className="h-3 w-3" />
              {isActive ? formatDuration(elapsed) : styles.text}
            </div>
            {isPrimary && call.status === 'connected' && (
              <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">🔊 AUDIO</span>
            )}
            {call.amdEnabled && call.status === 'ringing' && (
              <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium animate-pulse">🔍 AMD</span>
            )}
            <div>
              <div className="font-semibold text-sm">{contactName}</div>
              <div className="text-xs text-gray-600">{formatPhoneNumberForDisplay(phoneNumber)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Switch to this call button - shown when connected but not primary */}
            {!isPrimary && call.status === 'connected' && onSwitchTo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700"
                onClick={onSwitchTo}
              >
                🔊 Switch
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/50" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/50" onClick={() => { if (isActive) { onHangUp(); } onDismiss(); }} title={isActive ? "Hang up and close" : "Close"}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-3 py-2 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-1">
          {/* SMS Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-green-100"
            onClick={() => onSms(call.fromNumber)}
            title="Send SMS"
          >
            <MessageSquare className="h-4 w-4 text-green-600" />
          </Button>
          {/* Email Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-purple-100"
            onClick={() => {
              if (contactDetails?.email1) {
                openEmail({ email: contactDetails.email1, contact: contactDetails })
              } else {
                toast({ title: "No Email", description: "Contact has no email address", variant: "destructive" })
              }
            }}
            title="Send Email"
          >
            <Mail className="h-4 w-4 text-purple-600" />
          </Button>
          {/* View Contact Button - show if we have contactId or found contact by phone */}
          {effectiveContactId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-blue-100"
              onClick={() => openContactPanel(effectiveContactId)}
              title="View Contact"
            >
              <User className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {/* Quick Task Button */}
          {effectiveContactId && (
            <Popover open={showQuickTask} onOpenChange={setShowQuickTask}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-orange-100"
                  title="Create Task"
                >
                  <ListTodo className="h-4 w-4 text-orange-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Quick Task</h4>
                  <Input
                    placeholder="Task title..."
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="date"
                    value={quickTaskDueDate}
                    onChange={(e) => setQuickTaskDueDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="w-full h-8"
                    disabled={!quickTaskTitle.trim() || creatingTask}
                    onClick={handleCreateQuickTask}
                  >
                    {creatingTask ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Task
                      </>
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {/* Quick Tag Button */}
          {effectiveContactId && (
            <Popover open={showTagPopover} onOpenChange={(open) => { setShowTagPopover(open); if (open) loadTags(); }}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-cyan-100"
                  title="Manage Tags"
                >
                  <Tag className="h-4 w-4 text-cyan-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start" side="top" sideOffset={8}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Quick Tags</h4>
                    {loadingTags && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                  </div>

                  {/* Current Tags */}
                  <div className="min-h-[40px]">
                    <div className="text-xs text-gray-500 mb-1.5">Current Tags</div>
                    {contactDetails?.tags && contactDetails.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contactDetails.tags.map((tag: any) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs px-2 py-0.5 pr-1 flex items-center gap-1 cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, color: tag.color || undefined }}
                            onClick={() => removeTagFromContact(tag.id)}
                            title={`Remove "${tag.name}"`}
                          >
                            {tag.name}
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No tags assigned</div>
                    )}
                  </div>

                  {/* Search and Add Tags */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Add Tag</div>
                    <Input
                      placeholder="Search tags..."
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      className="h-8 text-sm mb-2"
                    />
                    {/* Fixed height container to prevent jumping */}
                    <div className="h-[120px] overflow-y-auto space-y-1">
                      {filteredAvailableTags.length > 0 ? (
                        filteredAvailableTags.slice(0, 10).map((tag) => (
                          <button
                            key={tag.id}
                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center gap-2"
                            onClick={() => { addTagToContact(tag); setTagSearchQuery(''); }}
                          >
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || '#94a3b8' }} />
                            {tag.name}
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 text-center py-2">
                          {tagSearchQuery ? 'No matching tags' : 'No tags available'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {/* Call Back Button */}
          {isEnded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-blue-100"
              onClick={onCallBack}
              title="Call Back"
            >
              <PhoneCall className="h-4 w-4 text-blue-600" />
            </Button>
          )}
        </div>

        {/* Voicemail Drop Status */}
        {voicemailDropStatus && (
          <div className="flex items-center gap-2 px-2 py-1 bg-purple-100 rounded text-xs text-purple-700">
            <Volume2 className="h-3 w-3 animate-pulse" />
            {voicemailDropStatus}
          </div>
        )}

        {/* Voicemail Drop Button */}
        {isActive && (
          <Popover open={showVoicemailDropPopover} onOpenChange={(open) => {
            setShowVoicemailDropPopover(open)
            if (open) fetchVoicemailMessages()
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                disabled={droppingVoicemail}
                title="Drop Voicemail"
              >
                <Voicemail className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">Select Voicemail Message</div>
                {loadingVoicemails ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : voicemailMessages.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-4">
                    No voicemail messages.<br />
                    <a href="/settings?tab=voicemail-messages" className="text-blue-600 hover:underline">Add one in Settings</a>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {voicemailMessages.map((vm) => (
                      <button
                        key={vm.id}
                        onClick={() => handleVoicemailDrop(vm.id, vm.name)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-purple-50 text-xs flex items-center gap-2"
                      >
                        <Volume2 className="h-3 w-3 text-purple-500" />
                        <span className="flex-1 truncate">{vm.name}</span>
                        {vm.isDefault && <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">Default</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Hang Up Button */}
        {isActive && (
          <Button
            size="sm"
            className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs px-3"
            onClick={onHangUp}
          >
            <Phone className="h-3 w-3 mr-1 rotate-135" />
            Hang Up
          </Button>
        )}
      </div>

      {/* Details and Notes Tabs */}
      <div className="flex flex-col h-[280px]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-3 pb-3">
          <TabsList className="grid grid-cols-2 w-full h-8 mt-2">
            <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="h-[200px] overflow-y-auto py-2">
          <div className="space-y-3">
            {/* Contact Information */}
            <div>
              <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-1.5">Contact</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">{formatPhoneNumberForDisplay(contactDetails?.phone1 || phoneNumber)}</span>
                </div>
                {contactDetails?.phone2 && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{formatPhoneNumberForDisplay(contactDetails.phone2)}</span>
                  </div>
                )}
                {contactDetails?.email1 && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate text-blue-600">{contactDetails.email1}</span>
                  </div>
                )}
                {contactDetails?.email2 && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate text-gray-600">{contactDetails.email2}</span>
                  </div>
                )}
                {contactDetails?.llcName && (
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-700">{contactDetails.llcName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Property Address */}
            {(contactDetails?.propertyAddress || contactDetails?.city) && (
              <div>
                <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-1.5">Property</h3>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="leading-snug">
                    {contactDetails.propertyAddress && <div className="font-medium">{contactDetails.propertyAddress}</div>}
                    <div className="text-gray-600">
                      {[contactDetails.city, contactDetails.state].filter(Boolean).join(', ')}
                      {contactDetails.zip && ` ${contactDetails.zip}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {contactDetails?.tags && contactDetails.tags.length > 0 && (
              <div>
                <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-1.5">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {contactDetails.tags.map((tag: any) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs px-2 py-0.5"
                      style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, color: tag.color || undefined, borderColor: tag.color || undefined }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="h-[200px] overflow-y-auto py-2">
          <div className="space-y-2 h-full flex flex-col">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Draft auto-saved</span>
              {notes && <span className="text-green-500">●</span>}
            </div>
            <Textarea
              placeholder="Add a note about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 text-sm resize-none min-h-[120px]"
            />
            <Button
              size="sm"
              className="w-full h-8"
              disabled={!notes.trim() || !effectiveContactId || savingNotes}
              onClick={handleSaveNotes}
            >
              {savingNotes ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Save Note
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}

// Main component that displays all call cards
export default function MultiCallCards() {
  const { activeCalls, primaryCallId, hangUpCall, dismissCall, restartCall, switchPrimaryCall } = useMultiCall()
  const { openSms } = useSmsUI()
  const { openContactPanel } = useContactPanel()

  const callsArray = Array.from(activeCalls.values())

  if (callsArray.length === 0) return null

  const handleSms = (call: ManualDialerCall, fromNumber?: string) => {
    openSms({
      phoneNumber: call.phoneNumber,
      contact: call.contactId ? { id: call.contactId, firstName: call.contactName?.split(' ')[0] || '', lastName: call.contactName?.split(' ').slice(1).join(' ') || '' } : undefined,
      fromNumber: fromNumber || call.fromNumber,
    })
  }

  const handleViewContact = (call: ManualDialerCall) => {
    if (call.contactId) {
      openContactPanel(call.contactId)
    }
  }

  const handleCallBack = async (call: ManualDialerCall) => {
    try {
      // Use restartCall to reuse the same window slot instead of creating a new window
      await restartCall(call.id, {
        toNumber: call.phoneNumber,
        fromNumber: call.fromNumber,
        contact: call.contactId ? { id: call.contactId, firstName: call.contactName?.split(' ')[0], lastName: call.contactName?.split(' ').slice(1).join(' ') } as any : undefined,
      })
    } catch (error) {
      console.error('[MultiCallCards] Call back error:', error)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex flex-row gap-3 items-end">
      {callsArray.map((call) => (
        <ExpandedCallCard
          key={call.id}
          call={call}
          isPrimary={call.id === primaryCallId}
          onHangUp={() => hangUpCall(call.id)}
          onDismiss={() => dismissCall(call.id)}
          onSms={(fromNumber) => handleSms(call, fromNumber)}
          onViewContact={() => handleViewContact(call)}
          onCallBack={() => handleCallBack(call)}
          onSwitchTo={() => switchPrimaryCall(call.id)}
        />
      ))}
    </div>
  )
}

// Message component for max calls warning
export function MaxCallsMessage({ show, onClose }: { show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [show, onClose])

  if (!show) return null

  return (
    <div className="fixed bottom-24 left-4 z-[61] bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-left">
      <span className="text-sm font-medium">
        You already have 3 calls active. Hang one up before starting another.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

