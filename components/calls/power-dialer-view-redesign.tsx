'use client'

/**
 * Redesigned Power Dialer View (CallTools-style)
 * - Center: Active call windows (1-10 lines)
 * - Right: Call queue showing upcoming contacts with real-time movement
 * - Bottom: Call script always visible, editable, persists per campaign
 * - Notes & disposition visible DURING connected call
 * - Click disposition → auto-hangs up, saves note, continues dialing next
 * - Shows caller ID on each call window
 * - Frontend simulation only (no actual calls)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PowerDialerCallWindow } from './power-dialer-call-window'
import { ArrowLeft, Play, Pause, Square, User, Phone, Save, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useContactPanel } from '@/lib/context/contact-panel-context'

interface Contact {
  id: string
  listEntryId: string
  firstName: string
  lastName: string
  phone: string
  phone2?: string
  phone3?: string
  propertyAddress?: string
  propertyAddress2?: string
  propertyAddress3?: string
  city?: string
  state?: string
  zipCode?: string
  llcName?: string
  // Power dialer tracking fields
  dialAttempts?: number
  lastCalledAt?: Date | string
}

interface CallLine {
  lineNumber: number
  contact: Contact | null
  status: 'idle' | 'dialing' | 'ringing' | 'connected' | 'hanging_up' | 'ended' // 'ended' = call over, waiting for disposition
  startedAt?: Date
  callId?: string
  callerIdNumber?: string // The number we're using to call
}

interface PowerDialerViewRedesignProps {
  listId: string
  listName: string
  onBack: () => void
}

// Simulated caller IDs (would come from API in real implementation)
const SIMULATED_CALLER_IDS = [
  '+18885551234',
  '+18885555678',
  '+18885559012',
  '+18885553456',
  '+18885557890'
]

export function PowerDialerViewRedesign({ listId, listName, onBack }: PowerDialerViewRedesignProps) {
  const [maxLines, setMaxLines] = useState(2)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [callLines, setCallLines] = useState<CallLine[]>([])
  const [queue, setQueue] = useState<Contact[]>([])
  const [script, setScript] = useState<string>('')
  const [scriptId, setScriptId] = useState<string | null>(null)
  const [dispositionNotes, setDispositionNotes] = useState('')
  const [connectedLine, setConnectedLine] = useState<number | null>(null)
  const [isEditingScript, setIsEditingScript] = useState(false)
  const [editableScript, setEditableScript] = useState('')
  const [queueAnimation, setQueueAnimation] = useState<string[]>([]) // IDs being animated
  const [availableScripts, setAvailableScripts] = useState<{ id: string; name: string; content: string }[]>([])
  const [showScriptSelector, setShowScriptSelector] = useState(false)
  const [waitingForDisposition, setWaitingForDisposition] = useState(false) // True when hang up clicked, waiting for disposition
  const [endedLineNumber, setEndedLineNumber] = useState<number | null>(null) // Track line with 'ended' call waiting for disposition

  // Contact panel context for opening contact details
  const { openContactPanel } = useContactPanel()

  // Refs for latest state values (to avoid closure issues in setTimeout callbacks)
  const isRunningRef = useRef(isRunning)
  const isPausedRef = useRef(isPaused)
  const queueRef = useRef(queue)
  const callLinesRef = useRef(callLines)
  const waitingForDispositionRef = useRef(waitingForDisposition)

  // Keep refs updated
  useEffect(() => { isRunningRef.current = isRunning }, [isRunning])
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { callLinesRef.current = callLines }, [callLines])
  useEffect(() => { waitingForDispositionRef.current = waitingForDisposition }, [waitingForDisposition])

  // Initialize call lines
  useEffect(() => {
    const lines: CallLine[] = []
    for (let i = 1; i <= maxLines; i++) {
      lines.push({
        lineNumber: i,
        contact: null,
        status: 'idle'
      })
    }
    setCallLines(lines)
  }, [maxLines])

  // Load queue from API
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const res = await fetch(`/api/power-dialer/lists/${listId}/contacts?status=pending&limit=100`)
        if (res.ok) {
          const data = await res.json()
          // Transform to Contact format
          const contacts: Contact[] = (data.contacts || []).map((c: any) => ({
            id: c.contactId as string,
            listEntryId: c.id as string,
            firstName: c.contact?.firstName || '',
            lastName: c.contact?.lastName || '',
            phone: c.contact?.phone1 || c.contact?.phone2 || c.contact?.phone3 || '',
            phone2: c.contact?.phone2 || '',
            phone3: c.contact?.phone3 || '',
            propertyAddress: c.contact?.propertyAddress || '',
            propertyAddress2: c.contact?.properties?.[1]?.address || '',
            propertyAddress3: c.contact?.properties?.[2]?.address || '',
            city: c.contact?.city || '',
            state: c.contact?.state || '',
            zipCode: c.contact?.zipCode || '',
            llcName: c.contact?.llcName || ''
          }))
          console.log('[PowerDialer] 📋 QUEUE: Loaded contacts', contacts.length)
          setQueue(contacts)
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load queue:', err)
      }
    }
    loadQueue()
  }, [listId])

  // Load script from API
  useEffect(() => {
    const loadScript = async () => {
      try {
        // Get list details to find scriptId
        const listRes = await fetch(`/api/power-dialer/lists/${listId}`)
        if (listRes.ok) {
          const listData = await listRes.json()
          setScriptId(listData.scriptId || null)
          if (listData.scriptId) {
            const scriptRes = await fetch(`/api/call-scripts/${listData.scriptId}`)
            if (scriptRes.ok) {
              const scriptData = await scriptRes.json()
              setScript(scriptData.content || '')
              setEditableScript(scriptData.content || '')
              console.log('[PowerDialer] ℹ️ Loaded script:', scriptData.name)
            }
          }
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load script:', err)
      }
    }
    loadScript()
  }, [listId])

  // Load available script templates
  useEffect(() => {
    const loadAvailableScripts = async () => {
      try {
        const res = await fetch('/api/call-scripts')
        if (res.ok) {
          const data = await res.json()
          setAvailableScripts(data.scripts || [])
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load available scripts:', err)
      }
    }
    loadAvailableScripts()
  }, [])

  // Handle selecting a script template
  const handleSelectScript = (selectedScript: { id: string; name: string; content: string }) => {
    setScriptId(selectedScript.id)
    setScript(selectedScript.content)
    setEditableScript(selectedScript.content)
    setShowScriptSelector(false)
    toast.success('Script loaded!', { description: selectedScript.name })
  }

  const handleStart = () => {
    setIsRunning(true)
    setIsPaused(false)
    console.log('[PowerDialer] 🚀 Starting dialer with', maxLines, 'lines')
    startDialingBatch()
  }

  const handlePause = () => {
    setIsPaused(true)
    console.log('[PowerDialer] ⏸️ Paused')
  }

  const handleResume = () => {
    setIsPaused(false)
    console.log('[PowerDialer] ▶️ Resumed')
    startDialingBatch()
  }

  const handleStop = () => {
    setIsRunning(false)
    setIsPaused(false)
    setConnectedLine(null)
    setDispositionNotes('')
    console.log('[PowerDialer] ⏹️ Stopped')
    // Clear all call lines
    setCallLines(prev => prev.map(line => ({ ...line, contact: null, status: 'idle', callerIdNumber: undefined })))
  }

  // Save script changes
  const handleSaveScript = async () => {
    setScript(editableScript)
    setIsEditingScript(false)
    // In real implementation, save to API
    if (scriptId) {
      try {
        await fetch(`/api/call-scripts/${scriptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editableScript })
        })
        toast.success('Script saved!')
      } catch (err) {
        console.error('[PowerDialer] Failed to save script:', err)
      }
    }
    console.log('[PowerDialer] ✏️ Script saved')
  }

  // Handle disposition selection - auto-hangs up, saves notes, continues dialing (CallTools style)
  const handleDisposition = async (disposition: string, lineNumber: number) => {
    const line = callLines.find(l => l.lineNumber === lineNumber)
    const contact = line?.contact

    console.log('[PowerDialer] 📝 Disposition:', disposition, 'for line', lineNumber, 'notes:', dispositionNotes)

    // 1. First, hang up the call (visual transition)
    setCallLines(prev => prev.map(l =>
      l.lineNumber === lineNumber
        ? { ...l, status: 'hanging_up' as const }
        : l
    ))

    // 2. Save notes and disposition to call history (API call)
    if (contact) {
      try {
        await fetch('/api/call-history/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: contact.id,
            disposition,
            notes: dispositionNotes || '',
            calledAt: line?.startedAt?.toISOString(),
            callerIdNumber: line?.callerIdNumber
          })
        })
        console.log('[PowerDialer] ✅ Notes saved to call history')
        toast.success(`Saved: ${disposition}`, { description: contact.firstName + ' ' + contact.lastName })
      } catch (err) {
        console.error('[PowerDialer] ❌ Failed to save notes:', err)
      }
    }

    // 3. After short delay, clear the line and continue dialing
    setTimeout(() => {
      setCallLines(prev => prev.map(l =>
        l.lineNumber === lineNumber
          ? { ...l, contact: null, status: 'idle' as const, callerIdNumber: undefined }
          : l
      ))
      setConnectedLine(null)
      setEndedLineNumber(null) // Clear the ended line tracker
      setDispositionNotes('')

      // CLEAR the waiting flag - disposition was clicked, OK to continue
      setWaitingForDisposition(false)

      // 4. Resume calling if still running and not paused (use refs to get latest state)
      if (isRunningRef.current && !isPausedRef.current) {
        console.log('[PowerDialer] ▶️ Resuming dialing after disposition...')
        setTimeout(() => startDialingBatch(), 300)
      }
    }, 500) // Short hang-up animation
  }

  // Start dialing a batch of contacts (up to maxLines)
  // Using refs to get latest state values
  const startDialingBatch = useCallback(() => {
    const currentQueue = queueRef.current
    const currentLines = callLinesRef.current

    // Don't start new calls if paused OR waiting for user to click disposition
    if (isPausedRef.current || waitingForDispositionRef.current || currentQueue.length === 0) {
      if (waitingForDispositionRef.current) {
        console.log('[PowerDialer] ⏸️ Waiting for disposition before dialing next batch')
      }
      return
    }

    console.log('[PowerDialer] 📞 Starting batch dial, queue size:', currentQueue.length)

    // Find available lines
    const availableLines = currentLines.filter(line => line.status === 'idle')
    const contactsToDialCount = Math.min(availableLines.length, currentQueue.length, maxLines)

    if (contactsToDialCount === 0) {
      console.log('[PowerDialer] No available lines or contacts')
      return
    }

    // Take contacts from queue and assign to lines with animation
    const contactsToDial = currentQueue.slice(0, contactsToDialCount)
    const remainingQueue = currentQueue.slice(contactsToDialCount)

    // Animate queue items being removed
    setQueueAnimation(contactsToDial.map(c => c.id))

    console.log('[PowerDialer] 📋 Dialing', contactsToDialCount, 'contacts')

    // After short animation delay, update queue and lines
    setTimeout(() => {
      setQueueAnimation([])
      setQueue(remainingQueue)
      setCallLines(prev => {
        const updated = [...prev]
        contactsToDial.forEach((contact) => {
          const lineIdx = updated.findIndex(l => l.status === 'idle')
          if (lineIdx !== -1) {
            // Assign a caller ID to this line
            const callerIdNumber = SIMULATED_CALLER_IDS[lineIdx % SIMULATED_CALLER_IDS.length]
            updated[lineIdx] = {
              ...updated[lineIdx],
              contact,
              status: 'dialing',
              startedAt: new Date(),
              callerIdNumber
            }
          }
        })
        return updated
      })
    }, 300)

    // Simulate ringing after 1.5 seconds (in real implementation, this would be Telnyx events)
    setTimeout(() => {
      setCallLines(prev => prev.map(line =>
        line.status === 'dialing' ? { ...line, status: 'ringing' } : line
      ))
    }, 1800)

    // Simulate one call connecting after 4 seconds
    setTimeout(() => {
      setCallLines(prev => {
        const updated = [...prev]
        const ringingIdx = updated.findIndex(l => l.status === 'ringing')
        if (ringingIdx !== -1) {
          // First call connects
          updated[ringingIdx].status = 'connected'
          setConnectedLine(updated[ringingIdx].lineNumber)

          // CLEAR notes when a NEW contact connects (notes are per-call, not shared)
          setDispositionNotes('')

          // Other calls hang up (they get cleared and contacts returned to queue)
          updated.forEach((line, idx) => {
            if (idx !== ringingIdx && line.status === 'ringing') {
              line.status = 'hanging_up'
            }
          })
        }
        return updated
      })

      // Clear hanging up calls after 2 seconds and put back in queue with incremented dial attempts
      setTimeout(() => {
        setCallLines(prev => {
          const toReturn: Contact[] = []
          const updated = prev.map(line => {
            if (line.status === 'hanging_up' && line.contact) {
              // Increment dial attempts and set lastCalledAt for unanswered calls
              const updatedContact: Contact = {
                ...line.contact,
                dialAttempts: (line.contact.dialAttempts || 0) + 1,
                lastCalledAt: new Date().toISOString()
              }
              toReturn.push(updatedContact)
              return { ...line, contact: null, status: 'idle' as const, callerIdNumber: undefined }
            }
            return line
          })
          // Add unanswered contacts back to end of queue (they will be after the separator)
          if (toReturn.length > 0) {
            console.log('[PowerDialer] 🔄 Returning', toReturn.length, 'unanswered contacts to queue')
            setQueue(q => [...q, ...toReturn])
          }
          return updated
        })
      }, 2000)
    }, 4300)
  }, [maxLines]) // useCallback dependency

  // Render script with dynamic fields replaced or shown as placeholders
  const renderScriptWithFields = (contact: Contact | null) => {
    let displayScript = script
    if (!displayScript) return null

    if (contact) {
      // Replace with actual values
      displayScript = displayScript.replace(/\{\{firstName\}\}/g, contact.firstName || '[First Name]')
      displayScript = displayScript.replace(/\{\{lastName\}\}/g, contact.lastName || '[Last Name]')
      displayScript = displayScript.replace(/\{\{propertyAddress\}\}/g, contact.propertyAddress || '[Property Address]')
    } else {
      // Show placeholders in brackets
      displayScript = displayScript.replace(/\{\{firstName\}\}/g, '[First Name]')
      displayScript = displayScript.replace(/\{\{lastName\}\}/g, '[Last Name]')
      displayScript = displayScript.replace(/\{\{propertyAddress\}\}/g, '[Property Address]')
    }

    return displayScript
  }

  // Get the connected contact for disposition display
  const getConnectedContact = (): Contact | null => {
    if (!connectedLine) return null
    const line = callLines.find(l => l.lineNumber === connectedLine)
    return line?.contact || null
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{listName}</h1>
            <p className="text-sm text-gray-500">{queue.length} contacts remaining</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Line Selector - can change when paused or stopped */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-gray-600">Lines:</Label>
            <Select
              value={maxLines.toString()}
              onValueChange={(v) => {
                const newLines = parseInt(v)
                setMaxLines(newLines)
                // Update the call lines array to match new count
                setCallLines(prev => {
                  const updated: CallLine[] = []
                  for (let i = 1; i <= newLines; i++) {
                    const existing = prev.find(l => l.lineNumber === i)
                    updated.push(existing || {
                      lineNumber: i,
                      contact: null,
                      status: 'idle'
                    })
                  }
                  return updated
                })
              }}
              disabled={isRunning && !isPaused}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-gray-300" />

          {!isRunning ? (
            <Button onClick={handleStart} disabled={queue.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Start Dialing
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button onClick={handleResume}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button onClick={handlePause} variant="outline">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              <Button onClick={handleStop} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Active Call Windows */}
        <div className="flex-1 p-6 overflow-auto">

          {/* DISPOSITION & NOTES SECTION - Shows DURING connected call OR after hang up (waiting for disposition) */}
          {(connectedLine || endedLineNumber) && (() => {
            const activeLineNumber = connectedLine || endedLineNumber
            const activeLine = callLines.find(l => l.lineNumber === activeLineNumber)
            const contact = activeLine?.contact
            const isEnded = activeLine?.status === 'ended'

            return (
              <Card className={cn(
                "mb-4 border-2",
                isEnded ? "border-red-500 bg-red-50/30" : "border-green-500 bg-green-50/30"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge className={cn(
                        "text-white text-sm px-3 py-1",
                        isEnded ? "bg-red-600" : "bg-green-600 animate-pulse"
                      )}>
                        {isEnded ? '📝 Call Ended' : '🔴 Live Call'}
                      </Badge>
                      <span className={cn(
                        "text-sm font-medium",
                        isEnded ? "text-red-800" : "text-green-800"
                      )}>
                        {contact ? `${contact.firstName} ${contact.lastName}` : ''}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {isEnded ? 'Write notes & select disposition to continue' : 'Click a disposition to end call & continue dialing'}
                    </span>
                  </div>

                  {/* Call Notes - can type during the call */}
                  <div className="mb-3">
                    <label className={cn(
                      "text-sm font-medium",
                      isEnded ? "text-red-800" : "text-green-800"
                    )}>📝 Call Notes</label>
                    <Textarea
                      value={dispositionNotes}
                      onChange={(e) => setDispositionNotes(e.target.value)}
                      placeholder={isEnded ? "Add your call notes here before selecting disposition..." : "Type notes during the call... These will be saved when you select a disposition."}
                      rows={2}
                      className={cn(
                        "resize-none mt-1",
                        isEnded ? "border-red-300 focus:border-red-500" : "border-green-300 focus:border-green-500"
                      )}
                    />
                  </div>

                  {/* Disposition Buttons - clicking any will save + continue */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleDisposition('interested', activeLineNumber!)}
                    >
                      ✅ Interested
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => handleDisposition('not_interested', activeLineNumber!)}
                    >
                      ❌ Not Interested
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleDisposition('callback', activeLineNumber!)}
                    >
                      📞 Callback
                    </Button>
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={() => handleDisposition('no_answer', activeLineNumber!)}
                    >
                      📵 No Answer
                    </Button>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => handleDisposition('voicemail', activeLineNumber!)}
                    >
                      📧 Voicemail
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-400"
                      onClick={() => handleDisposition('other', activeLineNumber!)}
                    >
                      Other
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Call Windows Grid */}
          <div className={cn(
            'grid gap-4',
            maxLines === 1 ? 'grid-cols-1 max-w-md mx-auto' :
            maxLines === 2 ? 'grid-cols-2' :
            maxLines <= 4 ? 'grid-cols-2 lg:grid-cols-4' :
            maxLines <= 6 ? 'grid-cols-3 lg:grid-cols-6' :
            'grid-cols-4 lg:grid-cols-5'
          )}>
            {callLines.map((line) => (
              <PowerDialerCallWindow
                key={line.lineNumber}
                lineNumber={line.lineNumber}
                contact={line.contact}
                status={line.status}
                startedAt={line.startedAt}
                callerIdNumber={line.callerIdNumber}
                onEditContact={() => {
                  // Open contact side panel to edit contact details
                  if (line.contact) {
                    openContactPanel(line.contact.id)
                  }
                }}
                onHangup={() => {
                  console.log('[PowerDialer] 📴 Hanging up line', line.lineNumber, '- keeping contact visible for disposition')

                  // SET FLAG: Wait for disposition before dialing next
                  setWaitingForDisposition(true)

                  // Mark line as hanging up briefly, then switch to 'ended' status
                  // KEEP the contact visible so user can write notes and select disposition
                  setCallLines(prev => prev.map(l =>
                    l.lineNumber === line.lineNumber
                      ? { ...l, status: 'hanging_up' as const }
                      : l
                  ))

                  // Clear connected line but track that we're waiting for disposition on this line
                  if (line.lineNumber === connectedLine) {
                    setConnectedLine(null)
                  }
                  setEndedLineNumber(line.lineNumber) // Track which line needs disposition

                  // After brief animation, set to 'ended' status (RED) - contact stays visible
                  setTimeout(() => {
                    setCallLines(prev => prev.map(l =>
                      l.lineNumber === line.lineNumber
                        ? { ...l, status: 'ended' as const } // Contact stays, just change status to ended
                        : l
                    ))
                    toast.info('Write notes & click a disposition to continue', { duration: 4000 })
                  }, 300)
                }}
              />
            ))}
          </div>

          {/* Call Script - ALWAYS visible, editable */}
          <Card className={cn(
            "mt-6 border-2",
            connectedLine ? "border-green-500" : "border-blue-200"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className={cn(
                    "h-5 w-5",
                    connectedLine ? "text-green-600" : "text-blue-600"
                  )} />
                  Call Script
                  {connectedLine && (
                    <Badge className="bg-green-600 text-white ml-2">🔴 Live Call</Badge>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  {isEditingScript ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setIsEditingScript(false); setEditableScript(script); setShowScriptSelector(false) }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveScript}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setShowScriptSelector(!showScriptSelector)}>
                        📋 Templates
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingScript(true)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Script Template Selector */}
              {showScriptSelector && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">Select a Script Template</span>
                    <Button size="sm" variant="ghost" onClick={() => setShowScriptSelector(false)}>✕</Button>
                  </div>
                  {availableScripts.length === 0 ? (
                    <p className="text-sm text-gray-500">No script templates available. Click "Edit" to write one.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableScripts.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectScript(s)}
                          className={cn(
                            "p-2 rounded cursor-pointer border transition-colors",
                            scriptId === s.id
                              ? "bg-blue-100 border-blue-400"
                              : "bg-white border-gray-200 hover:bg-blue-50"
                          )}
                        >
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs text-gray-500 truncate">{s.content.slice(0, 80)}...</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isEditingScript ? (
                <div className="space-y-2">
                  <Textarea
                    value={editableScript}
                    onChange={(e) => setEditableScript(e.target.value)}
                    placeholder="Write your call script here... Use {{firstName}}, {{lastName}}, {{propertyAddress}} for dynamic fields."
                    rows={6}
                    className="resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{propertyAddress}}'}
                  </p>
                </div>
              ) : (
                <div className={cn(
                  "p-4 rounded-lg whitespace-pre-wrap text-sm min-h-[80px]",
                  connectedLine ? "bg-green-50" : "bg-gray-50"
                )}>
                  {script ? (
                    renderScriptWithFields(getConnectedContact())
                  ) : (
                    <span className="text-gray-400 italic">No script assigned. Click "Templates" or "Edit" to add one.</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Call Queue */}
        <div className="w-80 bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              Queue
              <Badge variant="secondary">{queue.length} remaining</Badge>
            </h2>
            {isRunning && !isPaused && (
              <p className="text-xs text-green-600 mt-1 animate-pulse">● Auto-dialing active</p>
            )}
            {connectedLine && (
              <p className="text-xs text-blue-600 mt-1">📞 Call connected - use disposition to continue</p>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {(() => {
                // Helper: check if contact was called today
                const isCalledToday = (contact: Contact) => {
                  if (!contact.lastCalledAt) return false
                  const lastCalled = new Date(contact.lastCalledAt)
                  const today = new Date()
                  return lastCalled.toDateString() === today.toDateString()
                }

                // Split queue into fresh and already-called-today
                const freshContacts = queue.filter(c => !isCalledToday(c))
                const calledTodayContacts = queue.filter(c => isCalledToday(c))

                // Render a single contact card
                const renderContactCard = (contact: Contact, queueIndex: number) => {
                  const isBeingDialed = queueAnimation.includes(contact.id)
                  const attempts = contact.dialAttempts || 0
                  const isHighAttempts = attempts >= 10
                  const isDeadLead = attempts >= 20

                  return (
                    <Card
                      key={contact.id}
                      className={cn(
                        "transition-all duration-300",
                        isBeingDialed
                          ? "opacity-50 scale-95 translate-x-[-20px] bg-blue-100 border-blue-400"
                          : isDeadLead
                            ? "border-red-300 bg-red-50"
                            : isHighAttempts
                              ? "border-orange-300 bg-orange-50"
                              : "hover:shadow-md"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                            isBeingDialed ? "bg-blue-500" : isDeadLead ? "bg-red-500" : isHighAttempts ? "bg-orange-500" : "bg-primary/10"
                          )}>
                            {isBeingDialed ? (
                              <Phone className="h-4 w-4 text-white animate-pulse" />
                            ) : (
                              <span className={cn("text-xs font-bold", (isDeadLead || isHighAttempts) ? "text-white" : "text-primary")}>
                                {attempts > 0 ? attempts : <User className="h-4 w-4" />}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant={isBeingDialed ? "default" : "outline"}
                                className={cn("text-xs", isBeingDialed && "bg-blue-600")}
                              >
                                {isBeingDialed ? "📞 Dialing..." : `#${queueIndex + 1}`}
                              </Badge>
                              {attempts > 0 && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-xs",
                                    isDeadLead ? "bg-red-200 text-red-800" : isHighAttempts ? "bg-orange-200 text-orange-800" : ""
                                  )}
                                >
                                  {attempts} {attempts === 1 ? 'call' : 'calls'}
                                </Badge>
                              )}
                              <h3 className="font-semibold text-sm truncate">
                                {contact.firstName} {contact.lastName}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-600 font-mono mt-1">
                              {contact.phone}
                            </p>
                            {isDeadLead && (
                              <p className="text-xs text-red-600 mt-1">⚠️ 20+ calls - consider removing</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                }

                return (
                  <>
                    {/* Fresh contacts (not called today) */}
                    {freshContacts.map((contact, idx) => renderContactCard(contact, idx))}

                    {/* Separator when there are called-today contacts */}
                    {calledTodayContacts.length > 0 && (
                      <div className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 border-t-2 border-dashed border-orange-300"></div>
                          <span className="text-xs font-medium text-orange-600 px-2 bg-orange-50 rounded-full whitespace-nowrap">
                            📞 Already called today ({calledTodayContacts.length})
                          </span>
                          <div className="flex-1 border-t-2 border-dashed border-orange-300"></div>
                        </div>
                        <p className="text-xs text-center text-gray-500 mt-1">Consider waiting until tomorrow</p>
                      </div>
                    )}

                    {/* Already called today contacts */}
                    {calledTodayContacts.map((contact, idx) =>
                      renderContactCard(contact, freshContacts.length + idx)
                    )}

                    {/* Empty state */}
                    {queue.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <User className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No contacts in queue</p>
                        {isRunning && (
                          <p className="text-xs text-green-600 mt-2">All contacts have been dialed!</p>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

