"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCallUI } from "@/lib/context/call-ui-context"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { useToast } from "@/hooks/use-toast"
import { Phone, X, Minimize2, Building, MapPin, Mail, Calendar, MessageSquare, Check, RefreshCw, PhoneCall, Send, Plus, FileText, Loader2, Clock, CheckSquare, Pin, PinOff } from "lucide-react"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { format } from "date-fns"

// Template types
interface SmsTemplate {
  id: string
  name: string
  content: string
  variables: string[]
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  category: string
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, "0")}`
}

export default function RedesignedCallPopup() {
  const { call, setNotes, minimize, maximize, close, openCall } = useCallUI()
  const { openSms } = useSmsUI()
  const { openEmail } = useEmailUI()
  const { toast } = useToast()
  const [elapsed, setElapsed] = useState(0)
  const [hasEnded, setHasEnded] = useState(false)
  const [activitySaved, setActivitySaved] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [contactDetails, setContactDetails] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [localNotes, setLocalNotes] = useState("")
  const [showEmailModal, setShowEmailModal] = useState(false)

  // SMS/Email state
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [smsMessage, setSmsMessage] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [sendingSms, setSendingSms] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showNewSmsTemplate, setShowNewSmsTemplate] = useState(false)
  const [showNewEmailTemplate, setShowNewEmailTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  // Draft key for localStorage
  const draftKey = call?.contact?.id ? `note-draft-${call.contact.id}` : null

  // Load draft from localStorage on mount
  useEffect(() => {
    if (draftKey && !localNotes) {
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        setLocalNotes(savedDraft)
      }
    }
  }, [draftKey])

  // Auto-save draft to localStorage on note change
  useEffect(() => {
    if (draftKey && localNotes) {
      localStorage.setItem(draftKey, localNotes)
    }
  }, [localNotes, draftKey])

  // Reset all state when a new call starts (Issue: popup not refreshing on new call)
  useEffect(() => {
    if (call?.callId) {
      // Reset all local state for new call
      setElapsed(0)
      setHasEnded(false)
      setActivitySaved(false)
      setActiveTab("details")
      setContactDetails(null)
      setActivities([])
      setTasks([])
      setTaskTitle("")
      setTaskDueDate("")
      setLocalNotes("")
      setShowEmailModal(false)
      setSmsMessage("")
      setEmailSubject("")
      setEmailBody("")
      setShowNewSmsTemplate(false)
      setShowNewEmailTemplate(false)
      setNewTemplateName("")
    }
  }, [call?.callId])

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const [smsRes, emailRes] = await Promise.all([
          fetch('/api/templates'),
          fetch('/api/email/templates?active=true')
        ])
        if (smsRes.ok) {
          const data = await smsRes.json()
          setSmsTemplates(Array.isArray(data) ? data : data.templates || [])
        }
        if (emailRes.ok) {
          const data = await emailRes.json()
          setEmailTemplates(data.templates || [])
        }
      } catch (error) {
        console.error('Error loading templates:', error)
      }
    }
    loadTemplates()
  }, [])

  // Timer (Issue #3 fix: Stop timer when call ends, use callId to prevent conflicts)
  useEffect(() => {
    if (!call || hasEnded) return

    // Reset elapsed time when call changes (new call)
    setElapsed(0)

    const startTime = Date.now()
    setElapsed(Math.floor((Date.now() - call.startedAt) / 1000))

    const t = setInterval(() => {
      if (hasEnded) {
        clearInterval(t)
        return
      }
      setElapsed(Math.floor((Date.now() - call.startedAt) / 1000))
    }, 1000)

    return () => clearInterval(t)
  }, [call?.callId, hasEnded])

  // Load contact details
  useEffect(() => {
    if (!call?.contact?.id) return
    const loadContact = async () => {
      try {
        const res = await fetch(`/api/contacts/${call.contact.id}`)
        if (res.ok) {
          const data = await res.json()
          setContactDetails(data)
        }
      } catch (error) {
        console.error('Error loading contact:', error)
      }
    }
    loadContact()
  }, [call?.contact?.id])

  // Load activities
  useEffect(() => {
    if (!call?.contact?.id) return
    const loadActivities = async () => {
      try {
        const res = await fetch(`/api/activities?contactId=${call.contact.id}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities || [])
        }
      } catch (error) {
        console.error('Error loading activities:', error)
      }
    }
    loadActivities()
  }, [call?.contact?.id])

  // Load tasks
  useEffect(() => {
    if (!call?.contact?.id) return
    const loadTasks = async () => {
      try {
        const res = await fetch(`/api/tasks?contactId=${call.contact.id}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setTasks(data.tasks || [])
        }
      } catch (error) {
        console.error('Error loading tasks:', error)
      }
    }
    loadTasks()
  }, [call?.contact?.id])

  // Ensure remote audio is playing for inbound calls
  useEffect(() => {
    if (!call || call.mode !== 'webrtc' || call.direction !== 'inbound') return

    const ensureAudio = async () => {
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        // Wait a moment for the call to be fully established
        setTimeout(() => {
          console.log('[CallPopup] Ensuring remote audio is playing for inbound call...')
          rtcClient.ensureRemoteAudioPlaying()
        }, 1000)
      } catch (err) {
        console.error('[CallPopup] Error ensuring audio:', err)
      }
    }

    ensureAudio()
  }, [call?.callId, call?.mode, call?.direction])

  // Detect call end for WebRTC - both via polling and events
  useEffect(() => {
    if (!call || call.mode !== 'webrtc') return

    let mounted = true
    const activeCallId = call.webrtcSessionId

    // Set up event listener for call updates
    const setupEventListener = async () => {
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')

        const handleCallUpdate = async (data: { state: string; direction?: string; callId?: string }) => {
          if (!mounted || hasEnded) return
          const state = data.state?.toLowerCase()
          const eventCallId = data.callId

          console.log('[CallPopup] callUpdate received:', state, 'callId:', eventCallId, 'activeCallId:', activeCallId)

          // Check if this event is for our call
          // Either: IDs match, OR no active call ID but we have a call popup open
          const isOurCall = (eventCallId && activeCallId && eventCallId === activeCallId) ||
                           (!activeCallId && call) // If we don't have an ID but popup is open, it's likely ours

          // Detect hangup/destroy/failed states
          const endStates = ['hangup', 'destroy', 'failed', 'bye', 'cancel', 'rejected']
          if (endStates.includes(state)) {
            // Check if there's still an active call
            const hasActive = rtcClient.hasActiveCall()
            console.log('[CallPopup] End event received, state:', state, 'isOurCall:', isOurCall, 'hasActive:', hasActive)

            // End the call if: it's definitely our call, OR if there's no active call at all
            if (isOurCall || !hasActive) {
              console.log('[CallPopup] Call ended via event:', state)
              setHasEnded(true)
            }
          }
        }

        rtcClient.on('callUpdate', handleCallUpdate)

        return () => {
          rtcClient.off('callUpdate', handleCallUpdate)
        }
      } catch (err) {
        console.error('[CallPopup] Error setting up event listener:', err)
      }
    }

    let eventCleanup: (() => void) | undefined

    // Set up event listener and store cleanup function
    setupEventListener().then(cleanup => {
      if (mounted) {
        eventCleanup = cleanup
      } else {
        // If component unmounted while we were setting up, clean up immediately
        cleanup?.()
      }
    }).catch(err => {
      console.error('[CallPopup] Error in event listener setup:', err)
    })

    // Also poll as fallback (in case events are missed)
    // But be very conservative - only end if we're SURE the call is done
    const checkInterval = setInterval(async () => {
      if (!mounted || hasEnded) return
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')

        // Use hasActiveCall() which checks both currentCall and inboundCall
        const hasActive = rtcClient.hasActiveCall()
        const callState = rtcClient.getCallState()

        console.log('[CallPopup] Poll check - hasActive:', hasActive, 'state:', callState?.state)

        // End if there's no active call
        if (!hasActive) {
          const callDuration = Date.now() - (call?.startedAt || Date.now())
          // Wait at least 2 seconds before ending via poll (to prevent premature endings)
          if (callDuration > 2000) {
            console.log('[CallPopup] Call ended via poll - no active call after', callDuration, 'ms')
            setHasEnded(true)
            clearInterval(checkInterval)
          }
        }
      } catch (err) {
        console.log('[CallPopup] Poll check error:', err)
      }
    }, 2000)  // Poll every 2 seconds (less aggressive)

    return () => {
      mounted = false
      clearInterval(checkInterval)
      eventCleanup?.()
    }
  }, [call?.mode, call?.webrtcSessionId, call?.startedAt])

  // Auto-save notes when call ends
  useEffect(() => {
    const save = async () => {
      if (!call || !hasEnded || activitySaved) return
      try {
        if (call.contact?.id && localNotes.trim()) {
          await fetch("/api/activities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId: call.contact.id,
              type: "call",
              title: `Call with ${call.contact.firstName ?? "Contact"} ${call.contact.lastName ?? ""}`.trim(),
              description: localNotes,
              status: "completed",
              dueDate: new Date(call.startedAt).toISOString(),
              durationMinutes: Math.max(1, Math.round(elapsed / 60)),
            }),
          })
          setActivitySaved(true)
          toast({ title: "Call ended", description: "Notes saved successfully." })
        }
      } catch (e: any) {
        console.error(e)
        toast({ title: "Failed to save notes", description: e?.message || "Unknown error", variant: "destructive" })
      }
    }
    save()
  }, [hasEnded, activitySaved])

  const handleHangup = async () => {
    try {
      if (call?.mode === 'webrtc' && call?.webrtcSessionId) {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.hangup()
      }
      setHasEnded(true)
      // Switch to notes tab after hangup
      setActiveTab("notes")
    } catch (error) {
      console.error('Error hanging up:', error)
    }
  }

  const handleSaveNotes = async () => {
    if (!call?.contact?.id || !localNotes.trim()) {
      toast({ title: "Error", description: "Please enter notes before saving", variant: "destructive" })
      return
    }

    setSavingNotes(true)
    try {
      await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: call.contact.id,
          type: "call",
          title: `Call with ${call.contact.firstName ?? "Contact"} ${call.contact.lastName ?? ""}`.trim(),
          description: localNotes,
          status: "completed",
          dueDate: new Date(call.startedAt).toISOString(),
          durationMinutes: Math.max(1, Math.round(elapsed / 60)),
        }),
      })
      setActivitySaved(true)
      setLocalNotes("")
      // Clear draft from localStorage
      if (draftKey) {
        localStorage.removeItem(draftKey)
      }
      // Emit event to notify activity history to refresh
      window.dispatchEvent(new CustomEvent('activity-created', {
        detail: { contactId: call.contact.id }
      }))
      toast({ title: "Success", description: "Notes saved successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save notes", variant: "destructive" })
    } finally {
      setSavingNotes(false)
    }
  }

  const handleCreateTask = async () => {
    if (!call?.contact?.id || !taskTitle.trim()) {
      toast({ title: "Error", description: "Please enter task title", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: call.contact.id,
          title: taskTitle,
          dueDate: taskDueDate || undefined,
          status: "pending",
        }),
      })

      if (res.ok) {
        const newTask = await res.json()
        setTasks(prev => [newTask, ...prev])
        setTaskTitle("")
        setTaskDueDate("")
        toast({ title: "Success", description: "Task created successfully" })
        // Emit event to notify task lists to refresh
        window.dispatchEvent(new CustomEvent('task-created', {
          detail: { contactId: call.contact.id, task: newTask }
        }))
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" })
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "completed" } : t))
        toast({ title: "Success", description: "Task completed" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to complete task", variant: "destructive" })
    }
  }

  const handleRescheduleTask = async (taskId: string, newDate: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDate }),
      })
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, dueDate: newDate } : t))
        toast({ title: "Success", description: "Task rescheduled" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reschedule task", variant: "destructive" })
    }
  }

  const handleCallBack = async () => {
    const phoneNumber = call?.toNumber || call?.fromNumber || ''
    if (!phoneNumber) return
    try {
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.ensureRegistered()
      const fromNumber = call?.fromNumber || ''
      const { sessionId } = await rtcClient.startCall({
        fromNumber,
        toNumber: phoneNumber,
      })
      // Reuse the same popup window instead of opening a new one
      // Reset state for the new call
      setHasEnded(false)
      setActivitySaved(false)
      setActiveTab("details")
      setElapsed(0)
      openCall({
        toNumber: phoneNumber,
        fromNumber,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
        contact: call?.contact,
      })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to call back", variant: "destructive" })
    }
  }

  if (!call) return null

  const isActive = !hasEnded
  const borderColor = isActive ? "border-green-500" : "border-orange-500"
  const bgColor = isActive ? "bg-green-50" : "bg-orange-50"
  const statusBadgeColor = isActive ? "bg-green-600" : "bg-orange-600"
  const statusText = isActive ? "Active Call" : "Call Ended"

  const contactName = call.contact
    ? `${call.contact.firstName || ''} ${call.contact.lastName || ''}`.trim() || 'Unknown Contact'
    : 'Unknown Contact'

  const phoneNumber = call.toNumber || call.fromNumber || ''

  if (call.isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-[60]">
        <div className={`${borderColor} ${bgColor} border-2 rounded-lg p-3 shadow-lg flex items-center gap-3 cursor-pointer`} onClick={maximize}>
          <div className={`${statusBadgeColor} text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1`}>
            <Phone className="h-3 w-3" />
            {statusText}
          </div>
          <div>
            <div className="font-medium text-sm">{contactName}</div>
            <div className="text-xs text-gray-600">{formatPhoneNumberForDisplay(phoneNumber)}</div>
          </div>
          <div className="text-sm font-mono">{formatDuration(elapsed)}</div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); close(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[760px]">
      <div className={`${borderColor} border-2 rounded-lg bg-white shadow-2xl overflow-hidden`}>
        {/* Compact Header */}
        <div className={`${bgColor} px-3 py-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`${statusBadgeColor} text-white px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1`}>
                <Phone className="h-3 w-3" />
                {isActive ? formatDuration(elapsed) : "Ended"}
              </div>
              <div>
                <div className="font-semibold text-sm">{contactName}</div>
                <div className="text-xs text-gray-600">{formatPhoneNumberForDisplay(phoneNumber)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/50" onClick={minimize}>
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/50" onClick={close}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action Bar - Compact Icons */}
        <div className="px-3 py-2 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-1">
            {/* SMS Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-green-100"
              onClick={() => {
                // Pass the call's fromNumber so SMS opens with the same sender number we called from
                openSms({ contact: call?.contact || undefined, phoneNumber, fromNumber: call?.fromNumber })
              }}
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
                if (call?.contact?.email1) {
                  openEmail({ email: call.contact.email1, contact: call.contact })
                } else {
                  toast({ title: "No Email", description: "Contact has no email address", variant: "destructive" })
                }
              }}
              title="Send Email"
            >
              <Mail className="h-4 w-4 text-purple-600" />
            </Button>
            {/* Call Back Button */}
            {hasEnded && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-blue-100"
                onClick={handleCallBack}
                title="Call Back"
              >
                <PhoneCall className="h-4 w-4 text-blue-600" />
              </Button>
            )}
          </div>

          {/* Hang Up Button */}
          {isActive && (
            <Button
              size="sm"
              className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs px-3"
              onClick={handleHangup}
            >
              <Phone className="h-3 w-3 mr-1 rotate-[135deg]" />
              Hang Up
            </Button>
          )}
        </div>

        {/* Two Column Layout - Activity on Left, Tabs on Right */}
        <div className="flex h-[340px]">
          {/* Left Column - Activity History */}
          <div className="w-[300px] border-r bg-gray-50/50 flex flex-col">
            <div className="px-3 py-2 border-b bg-white">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Activity History ({activities.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {activities.length === 0 ? (
                <div className="text-center text-gray-500 text-xs py-8">No activities yet</div>
              ) : (
                <div className="space-y-2">
                  {/* Sort: pinned items first, then by date */}
                  {[...activities]
                    .sort((a, b) => {
                      if (a.isPinned && !b.isPinned) return -1
                      if (!a.isPinned && b.isPinned) return 1
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    })
                    .map((activity) => {
                    const handleTogglePin = async () => {
                      const newPinned = !activity.isPinned
                      // Optimistic update
                      setActivities(prev => prev.map(a =>
                        a.id === activity.id ? { ...a, isPinned: newPinned } : a
                      ))
                      try {
                        const res = await fetch(`/api/activities/${activity.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ isPinned: newPinned })
                        })
                        if (!res.ok) throw new Error('Failed to update')
                        toast({ title: newPinned ? 'Note pinned' : 'Note unpinned' })
                      } catch {
                        // Revert on error
                        setActivities(prev => prev.map(a =>
                          a.id === activity.id ? { ...a, isPinned: !newPinned } : a
                        ))
                        toast({ title: 'Error', description: 'Failed to update pin status', variant: 'destructive' })
                      }
                    }

                    return (
                    <div
                      key={activity.id}
                      className={`p-2 rounded border text-sm shadow-sm ${
                        activity.isPinned
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {activity.type === 'call' && <Phone className="h-3 w-3 text-blue-500" />}
                          {activity.type === 'email' && <Mail className="h-3 w-3 text-purple-500" />}
                          {activity.type === 'sms' && <MessageSquare className="h-3 w-3 text-green-500" />}
                          {activity.type === 'note' && <FileText className="h-3 w-3 text-yellow-500" />}
                          {activity.type === 'task' && <CheckSquare className="h-3 w-3 text-indigo-500" />}
                          {!['call', 'email', 'sms', 'note', 'task'].includes(activity.type) && <Clock className="h-3 w-3 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-xs truncate">{activity.title}</span>
                            <div className="flex items-center gap-1">
                              {/* Pin/Unpin button for notes */}
                              {activity.type === 'note' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleTogglePin() }}
                                  className={`p-0.5 rounded hover:bg-gray-100 ${activity.isPinned ? 'text-yellow-600' : 'text-gray-400 hover:text-gray-600'}`}
                                  title={activity.isPinned ? 'Unpin note' : 'Pin note'}
                                >
                                  {activity.isPinned ? <PinOff className="h-2.5 w-2.5" /> : <Pin className="h-2.5 w-2.5" />}
                                </button>
                              )}
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{format(new Date(activity.createdAt), 'MM/dd')}</span>
                            </div>
                          </div>
                          {activity.description && (
                            <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 whitespace-pre-wrap">{activity.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Tabs */}
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-3 pb-3">
              <TabsList className="grid grid-cols-5 w-full h-8 mt-2">
                <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                <TabsTrigger value="sms" className="text-xs">SMS</TabsTrigger>
                <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
              </TabsList>

          {/* Fixed height content area */}
          <TabsContent value="details" className="h-[280px] overflow-y-auto py-3">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{formatPhoneNumberForDisplay(contactDetails?.phone1 || phoneNumber)}</span>
                  </div>
                  {contactDetails?.email1 && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{contactDetails.email1}</span>
                    </div>
                  )}
                  {contactDetails?.llcName && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span>{contactDetails.llcName}</span>
                    </div>
                  )}
                </div>
              </div>

              {contactDetails?.propertyAddress && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Property Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <div>{contactDetails.propertyAddress}</div>
                        <div>{contactDetails.city}, {contactDetails.state} {contactDetails.zip}</div>
                      </div>
                    </div>
                    {contactDetails.propertyType && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span>{contactDetails.propertyType}</span>
                      </div>
                    )}
                    {contactDetails.bedrooms && contactDetails.bathrooms && (
                      <div className="text-gray-600">
                        {contactDetails.bedrooms} bed • {contactDetails.bathrooms} bath • {contactDetails.sqft} sqft
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SMS Tab */}
          <TabsContent value="sms" className="h-[280px] overflow-y-auto py-3">
            <div className="space-y-3 h-full flex flex-col">
              {/* Template Selector */}
              <div className="flex gap-2 items-center">
                <Select onValueChange={(id) => {
                  const t = smsTemplates.find(t => t.id === id)
                  if (t) {
                    // Replace variables with contact data
                    let msg = t.content
                    if (contactDetails) {
                      msg = msg.replace(/\{firstName\}/g, contactDetails.firstName || '')
                        .replace(/\{lastName\}/g, contactDetails.lastName || '')
                        .replace(/\{llcName\}/g, contactDetails.llcName || '')
                        .replace(/\{propertyAddress\}/g, contactDetails.propertyAddress || '')
                    }
                    setSmsMessage(msg)
                  }
                }}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowNewSmsTemplate(!showNewSmsTemplate)}
                  title="Save as new template"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* New Template Form */}
              {showNewSmsTemplate && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Template name..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!newTemplateName.trim() || !smsMessage.trim()}
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newTemplateName, content: smsMessage })
                        })
                        if (res.ok) {
                          const newT = await res.json()
                          setSmsTemplates(prev => [...prev, newT])
                          toast({ title: 'Template saved!' })
                          setShowNewSmsTemplate(false)
                          setNewTemplateName('')
                        }
                      } catch { toast({ title: 'Error saving template', variant: 'destructive' }) }
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              )}

              {/* Message Input */}
              <Textarea
                placeholder="Type your message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                className="flex-1 min-h-[120px] text-sm resize-none"
              />

              {/* Send Button */}
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white text-xs h-9"
                disabled={!smsMessage.trim() || sendingSms || !phoneNumber}
                onClick={async () => {
                  if (!phoneNumber) return
                  setSendingSms(true)
                  try {
                    const res = await fetch('/api/sms/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: phoneNumber.replace(/\D/g, ''),
                        message: smsMessage,
                        contactId: call?.contact?.id
                      })
                    })
                    if (res.ok) {
                      toast({ title: 'SMS sent!' })
                      setSmsMessage('')
                    } else {
                      const err = await res.json()
                      toast({ title: 'Failed to send', description: err.error, variant: 'destructive' })
                    }
                  } catch {
                    toast({ title: 'Error sending SMS', variant: 'destructive' })
                  } finally {
                    setSendingSms(false)
                  }
                }}
              >
                {sendingSms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send SMS
              </Button>
            </div>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="h-[280px] overflow-y-auto py-3">
            <div className="space-y-2 h-full flex flex-col">
              {/* Template Selector */}
              <div className="flex gap-2 items-center">
                <Select onValueChange={(id) => {
                  const t = emailTemplates.find(t => t.id === id)
                  if (t) {
                    let subj = t.subject
                    let body = t.content
                    if (contactDetails) {
                      const replacements = [
                        [/\{firstName\}/g, contactDetails.firstName || ''],
                        [/\{lastName\}/g, contactDetails.lastName || ''],
                        [/\{llcName\}/g, contactDetails.llcName || ''],
                        [/\{propertyAddress\}/g, contactDetails.propertyAddress || '']
                      ] as const
                      for (const [regex, val] of replacements) {
                        subj = subj.replace(regex, val)
                        body = body.replace(regex, val)
                      }
                    }
                    setEmailSubject(subj)
                    setEmailBody(body)
                  }
                }}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowNewEmailTemplate(!showNewEmailTemplate)}
                  title="Save as new template"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* New Template Form */}
              {showNewEmailTemplate && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Template name..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!newTemplateName.trim() || !emailSubject.trim() || !emailBody.trim()}
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/email/templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newTemplateName, subject: emailSubject, content: emailBody, category: 'custom' })
                        })
                        if (res.ok) {
                          const data = await res.json()
                          setEmailTemplates(prev => [...prev, data.template])
                          toast({ title: 'Template saved!' })
                          setShowNewEmailTemplate(false)
                          setNewTemplateName('')
                        }
                      } catch { toast({ title: 'Error saving template', variant: 'destructive' }) }
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              )}

              {/* Subject */}
              <Input
                placeholder="Subject..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-8 text-xs"
              />

              {/* Body */}
              <Textarea
                placeholder="Email body..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="flex-1 min-h-[80px] text-sm resize-none"
              />

              {/* Send Button */}
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-9"
                disabled={!emailSubject.trim() || !emailBody.trim() || sendingEmail || !contactDetails?.email1}
                onClick={async () => {
                  if (!contactDetails?.email1) {
                    toast({ title: 'No email address', description: 'Contact has no email', variant: 'destructive' })
                    return
                  }
                  setSendingEmail(true)
                  try {
                    const res = await fetch('/api/email/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: contactDetails.email1,
                        subject: emailSubject,
                        body: emailBody,
                        contactId: call?.contact?.id
                      })
                    })
                    if (res.ok) {
                      toast({ title: 'Email sent!' })
                      setEmailSubject('')
                      setEmailBody('')
                    } else {
                      const err = await res.json()
                      toast({ title: 'Failed to send', description: err.error, variant: 'destructive' })
                    }
                  } catch {
                    toast({ title: 'Error sending email', variant: 'destructive' })
                  } finally {
                    setSendingEmail(false)
                  }
                }}
              >
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Email
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="h-[280px] overflow-y-auto py-3">
            <div className="space-y-2 h-full flex flex-col">
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>Enter to save • Shift+Enter for new line</span>
                {localNotes && <span className="text-green-500 flex items-center gap-1">● Draft saved</span>}
              </div>
              <Textarea
                placeholder="Write your notes here..."
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (localNotes.trim() && !savingNotes) {
                      handleSaveNotes()
                    }
                  }
                }}
                className="flex-1 min-h-[180px] text-sm resize-none"
              />
              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                onClick={handleSaveNotes}
                disabled={!localNotes.trim() || savingNotes}
              >
                {savingNotes ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : 'Save Notes'}
              </Button>
              {activitySaved && (
                <div className="text-[10px] text-green-600 text-center">
                  ✓ Notes saved successfully
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="h-[280px] overflow-y-auto py-3">
            <div className="space-y-3">
              {/* Quick Create Task */}
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Task title..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-32 h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                  onClick={handleCreateTask}
                  disabled={!taskTitle.trim()}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Create Task
                </Button>
              </div>

              {/* Tasks List */}
              <div className="border-t pt-2">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Contact Tasks</h4>
                {tasks.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-4">No tasks</div>
                ) : (
                  <div className="space-y-1.5">
                    {tasks.map((task) => (
                      <div key={task.id} className={`p-2 border rounded text-xs ${task.status === 'completed' ? 'bg-gray-50 opacity-60' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                              {task.title}
                            </div>
                            {task.dueDate && (
                              <div className="text-[10px] text-gray-500">
                                Due: {format(new Date(task.dueDate), 'MM/dd/yy')}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {task.status !== 'completed' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-green-100"
                                  onClick={() => handleCompleteTask(task.id)}
                                  title="Complete Task"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <input
                                  type="date"
                                  className="h-6 w-20 text-[10px] border rounded px-1"
                                  onChange={(e) => handleRescheduleTask(task.id, e.target.value)}
                                  title="Reschedule"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

