"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Phone, X, MessageSquare, Mail, PhoneCall, Minimize2, Building, MapPin, Plus, User, ListTodo, Loader2 } from "lucide-react"
import { useMultiCall, ManualDialerCall } from "@/lib/context/multi-call-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useEmailUI } from "@/lib/context/email-ui-context"
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
  const [showQuickTask, setShowQuickTask] = useState(false)
  const [quickTaskTitle, setQuickTaskTitle] = useState("")
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)
  const { toast } = useToast()
  const { openEmail } = useEmailUI()

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

  // Load contact details
  useEffect(() => {
    if (!call.contactId) return
    const loadContact = async () => {
      try {
        const res = await fetch(`/api/contacts/${call.contactId}`)
        if (res.ok) {
          const data = await res.json()
          setContactDetails(data)
        }
      } catch (error) {
        console.error('Error loading contact:', error)
      }
    }
    loadContact()
  }, [call.contactId])

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
  const contactName = call.contactName || 'Unknown'
  const phoneNumber = call.phoneNumber

  // Handle saving notes
  const handleSaveNotes = async () => {
    if (!notes.trim() || !call.contactId) return
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: call.contactId,
          type: 'note',
          title: 'Call Note',
          description: notes,
        }),
      })
      if (res.ok) {
        toast({ title: 'Note Saved', description: 'Note added to contact' })
        setNotes('')
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save note', variant: 'destructive' })
    }
  }

  // Handle quick task creation
  const handleCreateQuickTask = async () => {
    if (!quickTaskTitle.trim() || !call.contactId) return
    setCreatingTask(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTaskTitle,
          contactId: call.contactId,
          dueDate: quickTaskDueDate || undefined,
          status: 'pending',
        }),
      })
      if (res.ok) {
        toast({ title: 'Task Created', description: 'Task added to contact' })
        setQuickTaskTitle('')
        setQuickTaskDueDate('')
        setShowQuickTask(false)
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
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
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
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/50" onClick={onDismiss}>
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
          {/* View Contact Button */}
          {call.contactId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-blue-100"
              onClick={onViewContact}
              title="View Contact"
            >
              <User className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {/* Quick Task Button */}
          {call.contactId && (
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

      {/* Tabs - Simplified: Details, Email, Notes only */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 pb-3">
        <TabsList className="grid grid-cols-3 w-full h-8 mt-2">
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
          <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="h-[200px] overflow-y-auto py-2">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm mb-2">Contact Information</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span>{formatPhoneNumberForDisplay(contactDetails?.phone1 || phoneNumber)}</span>
                </div>
                {contactDetails?.email1 && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="truncate">{contactDetails.email1}</span>
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
                <h3 className="font-semibold text-sm mb-2">Property</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <div>{contactDetails.propertyAddress}</div>
                      <div className="text-gray-500">{contactDetails.city}, {contactDetails.state} {contactDetails.zip}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="h-[200px] overflow-y-auto py-2">
          <div className="space-y-2 h-full flex flex-col">
            {contactDetails?.email1 ? (
              <>
                <p className="text-sm text-gray-600">
                  Email: <span className="font-medium">{contactDetails.email1}</span>
                </p>
                <Button
                  size="sm"
                  className="w-full h-8"
                  onClick={() => openEmail({ email: contactDetails.email1, contact: contactDetails })}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Compose Email
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No email address on file</p>
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="h-[200px] overflow-y-auto py-2">
          <div className="space-y-2 h-full flex flex-col">
            <Textarea
              placeholder="Add a note about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 text-sm resize-none min-h-[120px]"
            />
            <Button
              size="sm"
              className="w-full h-8"
              disabled={!notes.trim() || !call.contactId}
              onClick={handleSaveNotes}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save Note
            </Button>
          </div>
        </TabsContent>


      </Tabs>
    </div>
  )
}

// Main component that displays all call cards
export default function MultiCallCards() {
  const { activeCalls, primaryCallId, hangUpCall, dismissCall, startManualCall, switchPrimaryCall } = useMultiCall()
  const { openSms } = useSmsUI()

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
      window.open(`/contacts?contact=${call.contactId}`, '_blank')
    }
  }

  const handleCallBack = async (call: ManualDialerCall) => {
    try {
      await startManualCall({
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

