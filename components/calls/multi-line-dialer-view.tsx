'use client'

/**
 * Multi-Line Power Dialer View
 *
 * Main component that brings together all dialer UI components:
 * - Left: Controls panel
 * - Center: Active call windows
 * - Right: Call queue panel
 * - Bottom: Script panel (when call is answered)
 * - Focused view: Full-screen when call is connected
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { ArrowLeft, Phone, Info } from 'lucide-react'
import { useDialer } from '@/hooks/use-dialer'
import { DialerControls } from './dialer-controls'
import { DialerActiveCalls } from './dialer-active-calls'
import { DialerQueuePanel } from './dialer-queue-panel'
import { DialerScriptPanel } from './dialer-script-panel'
import { FocusedCall } from './dialer-focused-call'
import { rtcClient } from '@/lib/webrtc/rtc-client'
import type { CallerIdStrategy, DialerContact } from '@/lib/dialer/types'

interface PhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
}

interface CallScript {
  id: string
  name: string
  content: string
  variables: string[]
}

interface CallDisposition {
  id: string
  name: string
  color: string
  icon?: string
}

interface PowerDialerList {
  id: string
  name: string
  description?: string
  totalContacts: number
  contactsCalled: number
  contactsAnswered: number
  contactsNoAnswer: number
  maxLines: number
  callerIdStrategy: CallerIdStrategy
  scriptId?: string
}

interface MultiLineDialerViewProps {
  list: PowerDialerList
  onBack: () => void
}

export function MultiLineDialerView({ list, onBack }: MultiLineDialerViewProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([])
  const [maxLines, setMaxLines] = useState(list.maxLines || 2)
  const [callerIdStrategy, setCallerIdStrategy] = useState<CallerIdStrategy>(list.callerIdStrategy || 'round_robin')
  const [script, setScript] = useState<CallScript | null>(null)
  const [queue, setQueue] = useState<DialerContact[]>([])
  const [dispositions, setDispositions] = useState<CallDisposition[]>([])
  const [showFocusedCall, setShowFocusedCall] = useState(false)

  const {
    runState,
    isLoading,
    error,
    isRunning,
    isPaused,
    isCompleted,
    activeLegs,
    completedLegs,
    stats,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    refreshState
  } = useDialer({ listId: list.id })

  // Load phone numbers
  useEffect(() => {
    fetch('/api/telnyx/phone-numbers')
      .then(res => res.json())
      .then(data => {
        // API returns array directly, not { phoneNumbers: [...] }
        const numbers = Array.isArray(data) ? data : (data.phoneNumbers || [])
        setPhoneNumbers(numbers)
        // Auto-select first few numbers based on maxLines
        if (numbers.length > 0 && selectedNumbers.length === 0) {
          const autoSelect = numbers.slice(0, Math.min(maxLines, numbers.length))
          setSelectedNumbers(autoSelect.map((p: PhoneNumber) => p.id))
        }
      })
      .catch(err => console.error('Failed to load phone numbers:', err))
  }, [maxLines, selectedNumbers.length])

  // Load script if list has one
  useEffect(() => {
    if (list.scriptId) {
      fetch(`/api/call-scripts/${list.scriptId}`)
        .then(res => res.json())
        .then(data => setScript(data))
        .catch(err => console.error('Failed to load script:', err))
    }
  }, [list.scriptId])

  // Load dispositions
  useEffect(() => {
    fetch('/api/dispositions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDispositions(data)
        } else {
          // Seed default dispositions if none exist
          fetch('/api/dispositions/seed', { method: 'POST' })
            .then(() => fetch('/api/dispositions'))
            .then(res => res.json())
            .then(data => setDispositions(Array.isArray(data) ? data : []))
            .catch(err => console.error('Failed to seed dispositions:', err))
        }
      })
      .catch(err => console.error('Failed to load dispositions:', err))
  }, [])

  // Load queue contacts
  useEffect(() => {
    fetch(`/api/power-dialer/lists/${list.id}/contacts?status=pending&limit=100`)
      .then(res => res.json())
      .then(data => {
        // Transform to DialerContact format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contacts: DialerContact[] = (data.contacts || []).map((c: any) => ({
          id: c.contactId as string,
          listEntryId: c.id as string,
          firstName: c.contact?.firstName || '',
          lastName: c.contact?.lastName || '',
          fullName: `${c.contact?.firstName || ''} ${c.contact?.lastName || ''}`.trim() || 'Unknown',
          phone: c.phoneNumber || c.contact?.phone1 || '',
          phone2: c.contact?.phone2,
          phone3: c.contact?.phone3,
          llcName: c.contact?.llcName,
          propertyAddress: c.contact?.propertyAddress,
          city: c.contact?.city,
          state: c.contact?.state,
          zipCode: c.contact?.zipCode,
          tags: c.contact?.contact_tags?.map((ct: { tag: unknown }) => ct.tag) || []
        }))
        setQueue(contacts)
      })
      .catch(err => console.error('Failed to load queue:', err))
  }, [list.id, runState?.stats?.totalAttempted])

  // Cleanup: disable power dialer mode when component unmounts
  useEffect(() => {
    return () => {
      console.log('[MultiLineDialerView] Unmounting - disabling power dialer mode')
      rtcClient.setPowerDialerMode(false)
    }
  }, [])

  const handleStart = useCallback(async (config: { maxLines: number; callerIdStrategy: CallerIdStrategy; phoneNumberIds: string[] }) => {
    console.log('[MultiLineDialerView] handleStart called with config:', config)
    console.log('[MultiLineDialerView] phoneNumbers available:', phoneNumbers.length)
    console.log('[MultiLineDialerView] phoneNumberIds:', config.phoneNumberIds)

    try {
      // Map phone number IDs to actual phone numbers
      const selectedPhoneNumbers = config.phoneNumberIds
        .map(id => {
          const found = phoneNumbers.find(p => p.id === id)
          console.log(`[MultiLineDialerView] Mapping ID ${id} -> ${found?.phoneNumber || 'NOT FOUND'}`)
          return found?.phoneNumber
        })
        .filter((pn): pn is string => !!pn)

      console.log('[MultiLineDialerView] selectedPhoneNumbers:', selectedPhoneNumbers)

      if (selectedPhoneNumbers.length === 0) {
        console.error('[MultiLineDialerView] No valid phone numbers selected!')
        toast.error('No valid phone numbers selected')
        return
      }

      // Enable power dialer mode on WebRTC client for auto-answering transferred calls
      console.log('[MultiLineDialerView] Enabling power dialer mode on WebRTC client...')
      rtcClient.setPowerDialerMode(true)

      console.log('[MultiLineDialerView] Calling startRun...')
      await startRun({
        maxLines: config.maxLines,
        selectedNumbers: selectedPhoneNumbers
      })
      console.log('[MultiLineDialerView] startRun completed successfully')
      toast.success('Dialer started - calls will auto-connect to your browser')
    } catch (err) {
      console.error('[MultiLineDialerView] Error starting dialer:', err)
      // Disable power dialer mode on error
      rtcClient.setPowerDialerMode(false)
      toast.error(err instanceof Error ? err.message : 'Failed to start dialer')
    }
  }, [startRun, phoneNumbers])

  const handlePause = useCallback(async () => {
    try {
      await pauseRun()
      toast.info('Dialer paused')
    } catch (err) {
      toast.error('Failed to pause dialer')
    }
  }, [pauseRun])

  const handleResume = useCallback(async () => {
    try {
      await resumeRun()
      toast.success('Dialer resumed')
    } catch (err) {
      toast.error('Failed to resume dialer')
    }
  }, [resumeRun])

  const handleStop = useCallback(async () => {
    try {
      await stopRun()
      // Disable power dialer mode when stopping
      rtcClient.setPowerDialerMode(false)
      toast.info('Dialer stopped')
    } catch (err) {
      toast.error('Failed to stop dialer')
    }
  }, [stopRun])

  // Find the answered leg for script display and focused view
  const answeredLeg = activeLegs.find(leg => leg.status === 'answered') || null

  // Auto-show focused view when a call is answered
  useEffect(() => {
    if (answeredLeg && !showFocusedCall) {
      setShowFocusedCall(true)
    }
  }, [answeredLeg, showFocusedCall])

  // Handle hangup from any view
  const handleHangup = useCallback(async (legId: string) => {
    if (!runState?.runId) return
    try {
      await fetch('/api/dialer/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: runState.runId,
          legId
        })
      })
      toast.info('Hanging up call...')
    } catch (err) {
      toast.error('Failed to hang up')
    }
  }, [runState?.runId])

  // Handle disposition from focused view
  const handleFocusedDisposition = useCallback(async (dispositionId: string, notes?: string) => {
    if (!answeredLeg) return

    await fetch('/api/dialer/disposition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legId: answeredLeg.legId,
        contactId: answeredLeg.contact.id,
        dispositionId,
        notes,
        listId: list.id,
        dialerRunId: runState?.runId
      })
    })

    setShowFocusedCall(false)
  }, [answeredLeg, list.id, runState?.runId])

  // Render focused call view if there's an answered call
  if (showFocusedCall && answeredLeg) {
    return (
      <FocusedCall
        leg={answeredLeg}
        script={script}
        dispositions={dispositions}
        onHangup={() => handleHangup(answeredLeg.legId)}
        onDisposition={handleFocusedDisposition}
        onClose={() => setShowFocusedCall(false)}
      />
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lists
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {list.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {list.totalContacts} contacts • {list.contactsCalled} called • {list.contactsAnswered} answered
            </p>
          </div>
        </div>
        {isRunning && (
          <Badge variant="default" className="bg-green-600 animate-pulse text-lg px-4 py-1">
            ● DIALING
          </Badge>
        )}
        {isPaused && (
          <Badge variant="secondary" className="bg-yellow-500 text-white text-lg px-4 py-1">
            ⏸ PAUSED
          </Badge>
        )}
      </div>

      {/* Info Notice */}
      <Alert className="mx-4 mt-2 border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          <strong>Preview Mode:</strong> The power dialer places calls to contacts. When someone answers,
          you&apos;ll see their info and can set a disposition. Audio bridging coming soon.
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-[320px] p-4 border-r overflow-y-auto">
          <DialerControls
            listId={list.id}
            listName={list.name}
            totalContacts={list.totalContacts - list.contactsCalled}
            runState={runState}
            phoneNumbers={phoneNumbers}
            selectedNumbers={selectedNumbers}
            maxLines={maxLines}
            callerIdStrategy={callerIdStrategy}
            isLoading={isLoading}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onMaxLinesChange={setMaxLines}
            onCallerIdStrategyChange={setCallerIdStrategy}
            onSelectedNumbersChange={setSelectedNumbers}
          />
        </div>

        {/* Center Panel - Active Calls + Script */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Active Call Windows */}
          <div className="flex-1 p-4 overflow-y-auto">
            <DialerActiveCalls
              maxLines={maxLines}
              activeLegs={activeLegs}
              completedLegs={completedLegs}
              onHangup={handleHangup}
              onMute={(legId, muted) => {
                // TODO: Implement mute via API
                console.log('Mute leg:', legId, muted)
              }}
              onDisposition={async (legId, contactId, outcome, notes) => {
                // Save disposition to database
                await fetch('/api/dialer/disposition', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    legId,
                    contactId,
                    outcome,
                    notes,
                    listId: list.id
                  })
                })
              }}
            />
          </div>

          {/* Script Panel (shown when call is answered) */}
          {answeredLeg && (
            <div className="h-[300px] border-t p-4">
              <DialerScriptPanel
                script={script}
                answeredLeg={answeredLeg}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Queue */}
        <div className="w-[400px] border-l">
          <DialerQueuePanel
            queue={queue}
            activeLegs={activeLegs}
            completedLegs={completedLegs}
            stats={stats}
            totalContacts={list.totalContacts}
            isRunning={isRunning}
            isPaused={isPaused}
          />
        </div>
      </div>
    </div>
  )
}

