"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCallUI } from "@/lib/context/call-ui-context"
import { useToast } from "@/hooks/use-toast"
import { Phone, X, Maximize2, Minimize2, Building, MapPin, Mail, Calendar } from "lucide-react"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { format } from "date-fns"

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, "0")}`
}

export default function RedesignedCallPopup() {
  const { call, setNotes, minimize, maximize, close } = useCallUI()
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

  // Timer (Issue #3 fix: Stop timer when call ends)
  useEffect(() => {
    if (!call || hasEnded) return
    setElapsed(Math.floor((Date.now() - call.startedAt) / 1000))
    const t = setInterval(() => {
      if (hasEnded) {
        clearInterval(t)
        return
      }
      setElapsed(Math.floor((Date.now() - call.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [call?.startedAt, hasEnded])

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

  // Detect call end for WebRTC
  useEffect(() => {
    if (!call || call.mode !== 'webrtc') return
    const checkInterval = setInterval(async () => {
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        const callState = rtcClient.getCallState()
        if (!callState || callState.state === 'hangup' || callState.state === 'destroy') {
          setHasEnded(true)
          clearInterval(checkInterval)
        }
      } catch {}
    }, 1000)
    return () => clearInterval(checkInterval)
  }, [call?.mode, call?.webrtcSessionId])

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
      toast({ title: "Success", description: "Notes saved successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save notes", variant: "destructive" })
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
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" })
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
      <div className="fixed bottom-4 right-4 z-50">
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
    <div className="fixed bottom-4 right-4 z-50 w-[400px]">
      <div className={`${borderColor} border-4 rounded-lg bg-white shadow-2xl`}>
        {/* Header */}
        <div className={`${bgColor} p-4 rounded-t-md`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`${statusBadgeColor} text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1`}>
              <Phone className="h-3 w-3" />
              {statusText}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-mono">{formatDuration(elapsed)}</div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={minimize}>
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-lg">{contactName}</div>
            <div className="text-sm text-gray-700">{formatPhoneNumberForDisplay(phoneNumber)}</div>
          </div>
          {!hasEnded && (
            <div className="text-xs text-gray-600 mt-2">
              {hasEnded ? "Add notes or close when ready" : ""}
            </div>
          )}
        </div>

        {/* Hang Up Button */}
        {isActive && (
          <div className="p-4">
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3"
              onClick={handleHangup}
            >
              <Phone className="h-4 w-4 mr-2 rotate-135" />
              Hang Up
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="max-h-[400px] overflow-y-auto py-4">
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

          <TabsContent value="activity" className="max-h-[400px] overflow-y-auto py-4">
            <div className="space-y-3">
              {activities.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">No activities yet</div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="border-l-2 border-blue-500 pl-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                      {activity.type === 'email' && <Mail className="h-4 w-4 text-purple-500" />}
                      {activity.type === 'sms' && <span className="text-green-500 text-xs">💬</span>}
                      <span className="font-medium text-sm">{activity.title}</span>
                      <span className="text-xs text-gray-500">{format(new Date(activity.createdAt), 'MM/dd/yyyy')}</span>
                    </div>
                    {activity.description && (
                      <div className="text-xs text-gray-600">{activity.description}</div>
                    )}
                    {activity.durationMinutes && (
                      <div className="text-xs text-gray-500">Duration: {activity.durationMinutes} min</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="py-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Call Notes</h3>
              <Textarea
                placeholder="Write your notes here..."
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                className="min-h-[150px]"
              />
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSaveNotes}
                disabled={!localNotes.trim()}
              >
                Save Notes
              </Button>
              {activitySaved && (
                <div className="text-xs text-green-600 text-center">
                  Notes were auto-saved when you hung up. You can add more notes here.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="max-h-[400px] overflow-y-auto py-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-3">Create Follow-up Task</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Task Title</label>
                    <Input
                      placeholder="e.g., Send property listings"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Due Date</label>
                    <Input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleCreateTask}
                    disabled={!taskTitle.trim()}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Recent Tasks</h3>
                {tasks.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-4">No tasks yet</div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div key={task.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{task.title}</div>
                        {task.dueDate && (
                          <div className="text-xs text-gray-500">Due: {format(new Date(task.dueDate), 'MM/dd/yyyy')}</div>
                        )}
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
  )
}

