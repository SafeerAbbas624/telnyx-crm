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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PowerDialerCallWindow } from './power-dialer-call-window'
import { ArrowLeft, Play, Pause, User, Phone, Save, Edit2, UserCog, MessageSquare, Mail, PhoneCall, History, Edit3, RotateCcw, Trash2, Tag, X, CheckSquare, Shuffle } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useContactPanel } from '@/lib/context/contact-panel-context'
import { useCallUI } from '@/lib/context/call-ui-context'
import { useSmsUI } from '@/lib/context/sms-ui-context'
import { useEmailUI } from '@/lib/context/email-ui-context'
import { usePhoneNumber } from '@/lib/context/phone-number-context'
import { useTaskUI } from '@/lib/context/task-ui-context'

interface Contact {
  id: string
  listEntryId: string
  firstName: string
  lastName: string
  phone: string
  phone2?: string
  phone3?: string
  email?: string
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

// Session history entry - tracks each completed call in this session
interface SessionHistoryEntry {
  id: string // unique ID for this entry
  contact: Contact
  dispositionId: string
  dispositionName: string
  dispositionColor: string
  notes: string
  callerIdNumber?: string
  calledAt: Date
  talkDuration?: number // seconds
}

interface PowerDialerViewRedesignProps {
  listId: string
  listName: string
  onBack: () => void
}

// No more simulated caller IDs - we use real phone numbers from usePhoneNumber context

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
  const [dispositions, setDispositions] = useState<{ id: string; name: string; color: string; icon?: string; actions: any[] }[]>([])

  // Session history - tracks completed calls in this dialing session
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([])
  const [editingDispositionId, setEditingDispositionId] = useState<string | null>(null) // Entry ID being edited

  // Bulk selection state for queue actions
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false)
  const [bulkTagOperation, setBulkTagOperation] = useState<'add' | 'remove'>('add')
  const [selectedTagForBulk, setSelectedTagForBulk] = useState<string>('')
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [tagSearchQuery, setTagSearchQuery] = useState('')

  // Contact panel context for opening contact details
  const { openContactPanel } = useContactPanel()

  // UI contexts for quick actions
  const { openCall } = useCallUI()
  const { openSms } = useSmsUI()
  const { openEmail } = useEmailUI()
  const { selectedPhoneNumber } = usePhoneNumber()
  const { openTask } = useTaskUI()

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

  // Helper to build full address from parts
  const buildFullAddress = (address?: string, city?: string, state?: string, zip?: string): string => {
    if (!address) return ''
    const parts = [address]
    const cityStateZip = [city, state, zip].filter(Boolean).join(', ')
    if (cityStateZip) parts.push(cityStateZip)
    return parts.join(', ')
  }

  // Transform API contact data to Contact format
  const transformContactData = (c: any): Contact => {
    const contact = c.contact
    const fullAddr1 = contact?.fullPropertyAddress || buildFullAddress(
      contact?.propertyAddress, contact?.city, contact?.state, contact?.zipCode
    )
    const prop2 = contact?.properties?.[0]
    const prop3 = contact?.properties?.[1]
    const fullAddr2 = prop2 ? buildFullAddress(prop2.address, prop2.city, prop2.state, prop2.zipCode) : ''
    const fullAddr3 = prop3 ? buildFullAddress(prop3.address, prop3.city, prop3.state, prop3.zipCode) : ''

    return {
      id: c.contactId as string,
      listEntryId: c.id as string,
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      phone: contact?.phone1 || contact?.phone2 || contact?.phone3 || '',
      phone2: contact?.phone2 || '',
      phone3: contact?.phone3 || '',
      email: contact?.email1 || '',
      propertyAddress: fullAddr1,
      propertyAddress2: fullAddr2,
      propertyAddress3: fullAddr3,
      city: contact?.city || '',
      state: contact?.state || '',
      zipCode: contact?.zipCode || '',
      llcName: contact?.llcName || '',
      dialAttempts: c.attemptCount || 0,
      lastCalledAt: c.lastCalledAt || null
    }
  }

  // Load queue from API (or restore from session state)
  useEffect(() => {
    const loadQueue = async () => {
      try {
        // First check if we have saved queue state
        const listRes = await fetch(`/api/power-dialer/lists/${listId}`)
        if (listRes.ok) {
          const listData = await listRes.json()

          // If we have saved queue state with contact IDs and retry counts, restore it
          if (listData.sessionState?.queueState?.length > 0) {
            console.log('[PowerDialer] 📋 Found saved queue state, restoring...')
            const savedQueueState = listData.sessionState.queueState

            // Fetch all contacts from API to get fresh data
            const res = await fetch(`/api/power-dialer/lists/${listId}/contacts?status=pending&limit=100`)
            if (res.ok) {
              const data = await res.json()
              const allContacts: Contact[] = (data.contacts || []).map(transformContactData)

              // Create a map for quick lookup
              const contactMap = new Map(allContacts.map(c => [c.id, c]))

              // Restore queue in saved order with retry counts
              const restoredQueue: Contact[] = []
              for (const savedContact of savedQueueState) {
                const contact = contactMap.get(savedContact.id)
                if (contact) {
                  // Restore the __retryCount from saved state
                  restoredQueue.push({ ...contact, __retryCount: savedContact.__retryCount || 0 } as Contact)
                  contactMap.delete(savedContact.id) // Remove from map so we don't add duplicates
                }
              }

              // Add any new contacts that weren't in saved state (added after session was saved)
              contactMap.forEach(contact => {
                restoredQueue.push(contact)
              })

              console.log('[PowerDialer] 📋 QUEUE: Restored', restoredQueue.length, 'contacts from saved state')
              setQueue(restoredQueue)
              return
            }
          }
        }

        // No saved state, load fresh from API
        const res = await fetch(`/api/power-dialer/lists/${listId}/contacts?status=pending&limit=100`)
        if (res.ok) {
          const data = await res.json()
          const contacts: Contact[] = (data.contacts || []).map(transformContactData)
          console.log('[PowerDialer] 📋 QUEUE: Loaded contacts', contacts.length)
          setQueue(contacts)
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load queue:', err)
      }
    }
    loadQueue()
  }, [listId])

  // Load script and session state from list (API now returns script relation)
  useEffect(() => {
    const loadListData = async () => {
      try {
        // Get list details - script and sessionState are included in the response
        const listRes = await fetch(`/api/power-dialer/lists/${listId}`)
        if (listRes.ok) {
          const listData = await listRes.json()

          // Load session state (persisted session history)
          if (listData.sessionState?.sessionHistory) {
            setSessionHistory(listData.sessionState.sessionHistory)
            console.log('[PowerDialer] 📋 Restored session history:', listData.sessionState.sessionHistory.length, 'entries')
          }

          // If list has a script relation, use it directly
          if (listData.script) {
            setScriptId(listData.script.id)
            setScript(listData.script.content || '')
            setEditableScript(listData.script.content || '')
            console.log('[PowerDialer] ℹ️ Loaded script from campaign:', listData.script.name)
          } else if (listData.scriptId) {
            // Fallback: fetch script by ID
            const scriptRes = await fetch(`/api/call-scripts/${listData.scriptId}`)
            if (scriptRes.ok) {
              const scriptData = await scriptRes.json()
              setScriptId(scriptData.id)
              setScript(scriptData.content || '')
              setEditableScript(scriptData.content || '')
              console.log('[PowerDialer] ℹ️ Loaded script:', scriptData.name)
            }
          } else {
            console.log('[PowerDialer] ℹ️ No script assigned to this campaign')
          }
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load list data:', err)
      }
    }
    loadListData()
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

  // Load dispositions from database (with automations)
  useEffect(() => {
    const loadDispositions = async () => {
      try {
        const res = await fetch('/api/dispositions')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setDispositions(data)
            console.log('[PowerDialer] 📋 Loaded', data.length, 'dispositions from database')
          } else {
            // Seed default dispositions if none exist
            console.log('[PowerDialer] No dispositions found, seeding defaults...')
            await fetch('/api/dispositions/seed', { method: 'POST' })
            // Reload after seeding
            const res2 = await fetch('/api/dispositions')
            if (res2.ok) {
              const data2 = await res2.json()
              setDispositions(Array.isArray(data2) ? data2 : [])
            }
          }
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load dispositions:', err)
      }
    }
    loadDispositions()
  }, [])

  // Load available tags for bulk operations
  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await fetch('/api/tags')
        if (res.ok) {
          const data = await res.json()
          setAvailableTags(data.tags || [])
        }
      } catch (err) {
        console.error('[PowerDialer] Failed to load tags:', err)
      }
    }
    loadTags()
  }, [])

  // Auto-save session state when session history OR queue changes (debounced)
  useEffect(() => {
    // Save if we have session history OR if queue has retry contacts (Round 2+)
    const hasRetryContacts = queue.some(c => ((c as any).__retryCount || 0) > 0)
    if (sessionHistory.length === 0 && !hasRetryContacts) return // Don't save empty state

    const saveTimeout = setTimeout(async () => {
      try {
        // Save queue state: just the contact IDs and their retry counts (to preserve order)
        const queueState = queue.map(c => ({
          id: c.id,
          __retryCount: (c as any).__retryCount || 0
        }))

        await fetch(`/api/power-dialer/lists/${listId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionState: {
              sessionHistory,
              queueState, // Save queue order and retry counts
              savedAt: new Date().toISOString()
            }
          })
        })
        console.log('[PowerDialer] 💾 Session state saved (history:', sessionHistory.length, ', queue:', queueState.length, ')')
      } catch (err) {
        console.error('[PowerDialer] Failed to save session state:', err)
      }
    }, 2000) // Debounce 2 seconds

    return () => clearTimeout(saveTimeout)
  }, [sessionHistory, queue, listId])

  // Handle selecting a script template - saves to campaign for persistence
  const handleSelectScript = async (selectedScript: { id: string; name: string; content: string }) => {
    setScriptId(selectedScript.id)
    setScript(selectedScript.content)
    setEditableScript(selectedScript.content)
    setShowScriptSelector(false)

    // Save the script selection to the campaign so it persists
    try {
      await fetch(`/api/power-dialer/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: selectedScript.id })
      })
      toast.success('Script saved to campaign!', { description: selectedScript.name })
    } catch (err) {
      console.error('[PowerDialer] Failed to save script to campaign:', err)
      toast.success('Script loaded!', { description: selectedScript.name })
    }
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
    isPausedRef.current = false // Update ref immediately to avoid closure issue
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

  // Reset campaign to initial state - reloads all contacts from API and clears session state
  const handleResetCampaign = async () => {
    // Stop any running calls
    handleStop()
    // Clear session history
    setSessionHistory([])

    // Clear session state AND reset all contacts to PENDING in database
    try {
      await fetch(`/api/power-dialer/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionState: null, resetContacts: true })
      })
    } catch (err) {
      console.error('[PowerDialer] Failed to clear session state:', err)
    }

    // Reload queue from API (all contacts now PENDING and fresh)
    try {
      const res = await fetch(`/api/power-dialer/lists/${listId}/contacts?status=pending&limit=100`)
      if (res.ok) {
        const data = await res.json()

        // Helper to build full address from parts
        const buildFullAddress = (address?: string, city?: string, state?: string, zip?: string): string => {
          if (!address) return ''
          const parts = [address]
          const cityStateZip = [city, state, zip].filter(Boolean).join(', ')
          if (cityStateZip) parts.push(cityStateZip)
          return parts.join(', ')
        }

        const contacts: Contact[] = (data.contacts || []).map((c: any) => {
          const contact = c.contact
          const fullAddr1 = contact?.fullPropertyAddress || buildFullAddress(
            contact?.propertyAddress,
            contact?.city,
            contact?.state,
            contact?.zipCode
          )
          const prop2 = contact?.properties?.[0]
          const prop3 = contact?.properties?.[1]
          const fullAddr2 = prop2 ? buildFullAddress(prop2.address, prop2.city, prop2.state, prop2.zipCode) : ''
          const fullAddr3 = prop3 ? buildFullAddress(prop3.address, prop3.city, prop3.state, prop3.zipCode) : ''

          return {
            id: c.contactId as string,
            listEntryId: c.id as string,
            firstName: contact?.firstName || '',
            lastName: contact?.lastName || '',
            phone: contact?.phone1 || contact?.phone2 || contact?.phone3 || '',
            phone2: contact?.phone2 || '',
            phone3: contact?.phone3 || '',
            email: contact?.email1 || '',
            propertyAddress: fullAddr1,
            propertyAddress2: fullAddr2,
            propertyAddress3: fullAddr3,
            city: contact?.city || '',
            state: contact?.state || '',
            zipCode: contact?.zipCode || '',
            llcName: contact?.llcName || '',
            dialAttempts: 0, // Reset since we cleared attemptCount
            lastCalledAt: null // Reset since we cleared lastCalledAt
          }
        })
        setQueue(contacts)
        toast.success('Campaign reset!', { description: `Reloaded ${contacts.length} contacts` })
      }
    } catch (err) {
      console.error('[PowerDialer] Failed to reset campaign:', err)
      toast.error('Failed to reset campaign')
    }
  }

  // Save script changes - saves globally to the script template
  const handleSaveScript = async () => {
    setScript(editableScript)
    setIsEditingScript(false)
    if (scriptId) {
      try {
        await fetch(`/api/call-scripts/${scriptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editableScript })
        })
        toast.success('Script template updated!', { description: 'Changes saved globally to settings' })
      } catch (err) {
        console.error('[PowerDialer] Failed to save script:', err)
        toast.error('Failed to save script')
      }
    } else {
      toast.info('Script changes saved locally', { description: 'Select a template to save globally' })
    }
    console.log('[PowerDialer] ✏️ Script saved')
  }

  // Bulk selection handlers
  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contactId)) {
        newSet.delete(contactId)
      } else {
        newSet.add(contactId)
      }
      setShowBulkActions(newSet.size > 0)
      return newSet
    })
  }

  const selectAllContacts = () => {
    const allIds = new Set(queue.map(c => c.id))
    setSelectedContacts(allIds)
    setShowBulkActions(allIds.size > 0)
  }

  const clearSelection = () => {
    setSelectedContacts(new Set())
    setShowBulkActions(false)
  }

  // Bulk add/remove tags
  const handleBulkTagOperation = async () => {
    if (!selectedTagForBulk || selectedContacts.size === 0) return

    try {
      const contactIds = Array.from(selectedContacts)
      const endpoint = bulkTagOperation === 'add' ? '/api/contacts/bulk-assign-tags' : '/api/contacts/bulk-remove-tags'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds, tagIds: [selectedTagForBulk] })
      })

      if (res.ok) {
        const tagName = availableTags.find(t => t.id === selectedTagForBulk)?.name || 'tag'
        toast.success(`${bulkTagOperation === 'add' ? 'Added' : 'Removed'} "${tagName}" ${bulkTagOperation === 'add' ? 'to' : 'from'} ${contactIds.length} contacts`)
        clearSelection()
      } else {
        toast.error(`Failed to ${bulkTagOperation} tag`)
      }
    } catch (err) {
      console.error('[PowerDialer] Bulk tag operation failed:', err)
      toast.error('Bulk tag operation failed')
    }
    setBulkTagDialogOpen(false)
    setSelectedTagForBulk('')
  }

  // Bulk remove from queue only (doesn't delete from CRM)
  const handleBulkRemoveFromQueue = async () => {
    if (selectedContacts.size === 0) return

    try {
      const contactIds = Array.from(selectedContacts)

      // Remove from the PowerDialerList using contactId (API expects ?contactId=xxx)
      await Promise.all(contactIds.map(contactId =>
        fetch(`/api/power-dialer/lists/${listId}/contacts?contactId=${contactId}`, { method: 'DELETE' })
      ))

      // Remove from local queue
      setQueue(prev => prev.filter(c => !selectedContacts.has(c.id)))
      toast.success(`Removed ${contactIds.length} contacts from queue`)
      clearSelection()
    } catch (err) {
      console.error('[PowerDialer] Bulk remove from queue failed:', err)
      toast.error('Failed to remove contacts from queue')
    }
  }

  // Shuffle queue (Fisher-Yates algorithm)
  const handleShuffleQueue = () => {
    if (queue.length <= 1) return

    setQueue(prev => {
      const shuffled = [...prev]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    })
    toast.success('Queue shuffled!', { description: `${queue.length} contacts randomized` })
  }

  // Bulk delete contacts from CRM
  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return

    try {
      const contactIds = Array.from(selectedContacts)

      const res = await fetch('/api/contacts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds, hardDelete: false }) // Soft delete
      })

      if (res.ok) {
        // Remove deleted contacts from queue
        setQueue(prev => prev.filter(c => !selectedContacts.has(c.id)))
        toast.success(`Deleted ${contactIds.length} contacts from CRM`)
        clearSelection()
      } else {
        toast.error('Failed to delete contacts')
      }
    } catch (err) {
      console.error('[PowerDialer] Bulk delete failed:', err)
      toast.error('Bulk delete failed')
    }
    setBulkDeleteDialogOpen(false)
  }

  // Handle disposition selection - auto-hangs up, saves notes, executes automations, continues dialing
  const handleDisposition = async (dispositionId: string, dispositionName: string, lineNumber: number) => {
    const line = callLines.find(l => l.lineNumber === lineNumber)
    const contact = line?.contact
    const dispo = dispositions.find(d => d.id === dispositionId)

    console.log('[PowerDialer] 📝 Disposition:', dispositionName, '(id:', dispositionId, ') for line', lineNumber, 'notes:', dispositionNotes)

    // Check if disposition should requeue the contact
    // Either has REQUEUE_CONTACT action OR is a "no answer" type disposition
    const dispNameLower = dispositionName.toLowerCase()
    const isNoAnswerType = dispNameLower.includes('no answer') ||
                           dispNameLower.includes('no contact') ||
                           dispNameLower.includes('voicemail') ||
                           dispNameLower.includes('callback')
    const hasRequeueAction = dispo?.actions?.some(a => a.actionType === 'REQUEUE_CONTACT') || isNoAnswerType

    // 1. First, hang up the call (visual transition)
    setCallLines(prev => prev.map(l =>
      l.lineNumber === lineNumber
        ? { ...l, status: 'hanging_up' as const }
        : l
    ))

    // 2. Add to session history (most recent first)
    if (contact) {
      const talkDuration = line?.startedAt ? Math.floor((Date.now() - line.startedAt.getTime()) / 1000) : undefined
      const historyEntry: SessionHistoryEntry = {
        id: `${Date.now()}-${contact.id}`,
        contact,
        dispositionId,
        dispositionName,
        dispositionColor: dispo?.color || '#6b7280',
        notes: dispositionNotes || '',
        callerIdNumber: line?.callerIdNumber,
        calledAt: new Date(),
        talkDuration
      }
      setSessionHistory(prev => [historyEntry, ...prev])

      // Only remove from queue if disposition does NOT have requeue action
      // If it has requeue, keep them in the queue to be called again
      if (!hasRequeueAction) {
        setQueue(prev => prev.filter(c => c.id !== contact.id))
      } else {
        // Mark as attempted but keep in queue (move to end)
        setQueue(prev => {
          const withoutContact = prev.filter(c => c.id !== contact.id)
          return [...withoutContact, { ...contact, __retryCount: ((contact as any).__retryCount || 0) + 1 }]
        })
        console.log('[PowerDialer] 🔄 Contact requeued for retry:', contact.firstName, contact.lastName)
      }
    }

    // 3. Save notes, disposition, and execute automations (API call)
    if (contact) {
      try {
        // Call the disposition API that executes automations
        const res = await fetch('/api/dialer/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: contact.id,
            dispositionId,
            notes: dispositionNotes || '',
            listId,
            calledAt: line?.startedAt?.toISOString(),
            callerIdNumber: line?.callerIdNumber
          })
        })

        if (res.ok) {
          const result = await res.json()
          console.log('[PowerDialer] ✅ Disposition saved, actions executed:', result.actionsExecuted || 0)
          const requeueMsg = hasRequeueAction ? ' (will retry later)' : ''
          toast.success(`${dispositionName}${requeueMsg}`, {
            description: `${contact.firstName} ${contact.lastName}${result.actionsExecuted ? ` • ${result.actionsExecuted} automation(s) run` : ''}`
          })
        } else {
          console.error('[PowerDialer] ❌ Disposition API error:', await res.text())
          toast.error('Failed to save disposition')
        }
      } catch (err) {
        console.error('[PowerDialer] ❌ Failed to save disposition:', err)
        toast.error('Failed to save disposition')
      }
    }

    // 4. After short delay, clear the line and continue dialing
    setTimeout(() => {
      setCallLines(prev => prev.map(l =>
        l.lineNumber === lineNumber
          ? { ...l, contact: null, status: 'idle' as const, callerIdNumber: undefined }
          : l
      ))
      setConnectedLine(null)
      setDispositionNotes('')

      // CLEAR the waiting flag - disposition was clicked, OK to continue
      setWaitingForDisposition(false)

      // 5. Resume calling if still running and not paused (use refs to get latest state)
      if (isRunningRef.current && !isPausedRef.current) {
        console.log('[PowerDialer] ▶️ Resuming dialing after disposition...')
        setTimeout(() => startDialingBatch(), 300)
      }
    }, 500) // Short hang-up animation
  }

  // Update disposition for a session history entry
  const handleUpdateHistoryDisposition = async (entryId: string, newDispositionId: string) => {
    const entry = sessionHistory.find(e => e.id === entryId)
    const newDispo = dispositions.find(d => d.id === newDispositionId)
    if (!entry || !newDispo) return

    // Update in session history state
    setSessionHistory(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, dispositionId: newDispositionId, dispositionName: newDispo.name, dispositionColor: newDispo.color }
        : e
    ))

    // Handle calledAt - it may be a Date or a string (from JSON serialization)
    const calledAtStr = entry.calledAt instanceof Date
      ? entry.calledAt.toISOString()
      : typeof entry.calledAt === 'string'
        ? entry.calledAt
        : new Date().toISOString()

    // Update in database AND execute new disposition's automation actions
    try {
      const response = await fetch('/api/dialer/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: entry.contact.id,
          dispositionId: newDispositionId,
          notes: entry.notes,
          listId,
          calledAt: calledAtStr,
          callerIdNumber: entry.callerIdNumber,
          isUpdate: true // Flag to indicate this is updating an existing disposition
        })
      })
      const data = await response.json()
      const actionsExecuted = data.actionsExecuted || 0
      toast.success(`Updated to ${newDispo.name}${actionsExecuted > 0 ? ` (${actionsExecuted} action${actionsExecuted > 1 ? 's' : ''} executed)` : ''}`)
    } catch (err) {
      console.error('[PowerDialer] Failed to update disposition:', err)
      toast.error('Failed to update disposition')
    }
    setEditingDispositionId(null)
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

    // Get the caller ID from selected phone number
    const callerIdNumber = selectedPhoneNumber?.phoneNumber
    if (!callerIdNumber) {
      console.error('[PowerDialer] ❌ No phone number selected - cannot dial')
      toast.error('Please select a phone number to dial from')
      return
    }

    // After short animation delay, update queue and start real calls
    setTimeout(async () => {
      setQueueAnimation([])
      setQueue(remainingQueue)

      // Start real WebRTC calls for each contact
      for (const contact of contactsToDial) {
        try {
          // Find an idle line
          const currentLines = callLinesRef.current
          const lineIdx = currentLines.findIndex(l => l.status === 'idle')
          if (lineIdx === -1) {
            console.log('[PowerDialer] No idle lines available')
            continue
          }

          // Update line to dialing state
          setCallLines(prev => {
            const updated = [...prev]
            updated[lineIdx] = {
              ...updated[lineIdx],
              contact,
              status: 'dialing',
              startedAt: new Date(),
              callerIdNumber
            }
            return updated
          })

          // Format phone number for Telnyx
          const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils')
          const toNumber = formatPhoneNumberForTelnyx(contact.phone) || contact.phone

          // Start real WebRTC call
          const { rtcClient } = await import('@/lib/webrtc/rtc-client')
          await rtcClient.ensureRegistered()
          const { sessionId } = await rtcClient.startCall({
            toNumber,
            fromNumber: callerIdNumber
          })

          console.log('[PowerDialer] 📞 Started call to', contact.firstName, contact.lastName, 'sessionId:', sessionId)

          // Log the call to database
          fetch('/api/telnyx/webrtc-calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webrtcSessionId: sessionId,
              contactId: contact.id,
              fromNumber: callerIdNumber,
              toNumber,
            })
          }).catch(err => console.error('[PowerDialer] Failed to log call:', err))

          // Update line with call ID
          setCallLines(prev => prev.map((line, idx) =>
            idx === lineIdx ? { ...line, callId: sessionId, status: 'ringing' } : line
          ))

          // Listen for call events
          const handleCallUpdate = (event: any) => {
            const callId = event?.call?.callId || event?.call?.id
            if (callId !== sessionId) return

            const state = event?.call?.state
            console.log('[PowerDialer] Call state update:', state, 'for', contact.firstName)

            if (state === 'active' || state === 'answering') {
              // Call connected
              setCallLines(prev => {
                const updated = prev.map(line =>
                  line.callId === sessionId ? { ...line, status: 'connected' as const } : line
                )
                const connectedIdx = updated.findIndex(l => l.callId === sessionId)
                if (connectedIdx !== -1) {
                  setConnectedLine(updated[connectedIdx].lineNumber)
                  setDispositionNotes('')
                }
                return updated
              })
            } else if (state === 'hangup' || state === 'destroy' || state === 'bye') {
              // Call ended - mark as ended (waiting for disposition)
              setCallLines(prev => prev.map(line =>
                line.callId === sessionId ? { ...line, status: 'ended' as const } : line
              ))
              rtcClient.off('callUpdate', handleCallUpdate)
            }
          }

          rtcClient.on('callUpdate', handleCallUpdate)

        } catch (err: any) {
          console.error('[PowerDialer] ❌ Failed to start call:', err)
          toast.error(`Failed to call ${contact.firstName}: ${err.message}`)
          // Reset the line
          setCallLines(prev => prev.map(line =>
            line.contact?.id === contact.id ? { ...line, contact: null, status: 'idle' as const, callerIdNumber: undefined } : line
          ))
        }
      }
    }, 300)
  }, [maxLines, selectedPhoneNumber]) // useCallback dependency

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
                // Check if we're reducing lines and there are active calls on higher lines
                const activeHigherLines = callLines.filter(line =>
                  line.lineNumber > newLines &&
                  (line.status === 'ringing' || line.status === 'connected' || line.status === 'hanging_up')
                )
                if (activeHigherLines.length > 0) {
                  toast.error(`Cannot reduce lines while Line ${activeHigherLines.map(l => l.lineNumber).join(', ')} has active calls`)
                  return
                }
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
            </>
          )}

          {/* Reset Campaign Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will stop all calls, clear session history, and reload all contacts from the original list.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetCampaign} className="bg-red-600 hover:bg-red-700">
                  Reset Campaign
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Active Call Windows */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Call Windows Grid - responsive layout with better spacing */}
          <div className={cn(
            'grid gap-3',
            maxLines === 1 ? 'grid-cols-1 max-w-md mx-auto' :
            maxLines === 2 ? 'grid-cols-2 max-w-2xl' :
            maxLines === 3 ? 'grid-cols-3 max-w-3xl' :
            maxLines === 4 ? 'grid-cols-2 lg:grid-cols-4 max-w-4xl' :
            maxLines === 5 ? 'grid-cols-3 lg:grid-cols-5 max-w-5xl' :
            maxLines <= 7 ? 'grid-cols-3 xl:grid-cols-7' :
            'grid-cols-4 xl:grid-cols-5'
          )}>
            {callLines.map((line) => (
              <PowerDialerCallWindow
                key={line.lineNumber}
                lineNumber={line.lineNumber}
                contact={line.contact}
                status={line.status}
                startedAt={line.startedAt}
                callerIdNumber={line.callerIdNumber}
                notes={dispositionNotes}
                onNotesChange={(notes) => setDispositionNotes(notes)}
                dispositions={dispositions}
                onDisposition={(dispositionId, dispositionName) => {
                  handleDisposition(dispositionId, dispositionName, line.lineNumber)
                }}
                onOpenContactPanel={() => {
                  if (line.contact) {
                    openContactPanel(line.contact.id)
                  }
                }}
                onCreateTask={() => {
                  if (line.contact) {
                    openTask({
                      contact: {
                        id: line.contact.id,
                        firstName: line.contact.firstName,
                        lastName: line.contact.lastName
                      },
                      subject: 'Follow up call',
                      taskType: 'Call',
                      description: `Follow up from power dialer call`
                    })
                  }
                }}
                onHangup={() => {
                  console.log('[PowerDialer] 📴 Hanging up line', line.lineNumber, '- keeping contact visible for disposition')
                  setWaitingForDisposition(true)
                  setCallLines(prev => prev.map(l =>
                    l.lineNumber === line.lineNumber
                      ? { ...l, status: 'hanging_up' as const }
                      : l
                  ))
                  if (line.lineNumber === connectedLine) {
                    setConnectedLine(null)
                  }
                  setTimeout(() => {
                    setCallLines(prev => prev.map(l =>
                      l.lineNumber === line.lineNumber
                        ? { ...l, status: 'ended' as const }
                        : l
                    ))
                    toast.info('Select a disposition to continue', { duration: 4000 })
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

        {/* Right Side: Queue + Session History */}
        <div className="flex">
          {/* Queue Panel */}
          <div className="w-72 bg-white border-l flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  Queue
                  <Badge variant="secondary">{queue.length} remaining</Badge>
                </h2>
                {/* Queue Actions: Shuffle + Select All */}
                {queue.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleShuffleQueue}
                      disabled={isRunning && !isPaused}
                      title="Shuffle queue order"
                    >
                      <Shuffle className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => selectedContacts.size === queue.length ? clearSelection() : selectAllContacts()}
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      {selectedContacts.size === queue.length ? 'Clear' : 'All'}
                    </Button>
                  </div>
                )}
              </div>
              {isRunning && !isPaused && (
                <p className="text-xs text-green-600 mt-1 animate-pulse">● Auto-dialing active</p>
              )}
              {connectedLine && (
                <p className="text-xs text-blue-600 mt-1">📞 Call connected - use disposition to continue</p>
              )}
              {/* Selection count */}
              {selectedContacts.size > 0 && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  ✓ {selectedContacts.size} selected
                </p>
              )}
            </div>

            {/* Bulk Actions Bar */}
            {showBulkActions && selectedContacts.size > 0 && (
              <div className="p-2 border-b bg-blue-50 flex items-center gap-1 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setBulkTagOperation('add'); setBulkTagDialogOpen(true) }}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Add Tag
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setBulkTagOperation('remove'); setBulkTagDialogOpen(true) }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove Tag
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  onClick={handleBulkRemoveFromQueue}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove from Queue
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete from CRM
                </Button>
              </div>
            )}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {(() => {
                  // Group contacts by their retry count (round number)
                  // retryCount 0 = Round 1 (fresh), 1 = Round 2, 2 = Round 3, etc.
                  const contactsByRound: Map<number, Contact[]> = new Map()

                  queue.forEach(contact => {
                    const retryCount = (contact as any).__retryCount || 0
                    const round = retryCount + 1 // Round 1 for fresh, Round 2 for retry 1, etc.
                    if (!contactsByRound.has(round)) {
                      contactsByRound.set(round, [])
                    }
                    contactsByRound.get(round)!.push(contact)
                  })

                  // Get sorted round numbers
                  const sortedRounds = Array.from(contactsByRound.keys()).sort((a, b) => a - b)

                  // Render a single contact card
                  const renderContactCard = (contact: Contact, queueIndex: number, showRoundBadge: boolean, roundNum: number) => {
                    const isBeingDialed = queueAnimation.includes(contact.id)
                    const attempts = contact.dialAttempts || 0
                    const isHighAttempts = attempts >= 10
                    const isDeadLead = attempts >= 20
                    const isSelected = selectedContacts.has(contact.id)

                    return (
                      <Card
                        key={contact.id}
                        className={cn(
                          "transition-all duration-300",
                          isBeingDialed
                            ? "opacity-50 scale-95 translate-x-[-20px] bg-blue-100 border-blue-400"
                            : isSelected
                              ? "border-blue-500 bg-blue-50"
                              : isDeadLead
                                ? "border-red-300 bg-red-50"
                                : isHighAttempts
                                  ? "border-orange-300 bg-orange-50"
                                  : "hover:shadow-md"
                        )}
                      >
                        <CardContent className="p-2">
                          <div className="flex items-start gap-2">
                            {/* Checkbox for selection */}
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                              className="mt-1 flex-shrink-0"
                            />
                            <div className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                              isBeingDialed ? "bg-blue-500" : isDeadLead ? "bg-red-500" : isHighAttempts ? "bg-orange-500" : "bg-primary/10"
                            )}>
                              {isBeingDialed ? (
                                <Phone className="h-3 w-3 text-white animate-pulse" />
                              ) : (
                                <span className={cn("text-xs font-bold", (isDeadLead || isHighAttempts) ? "text-white" : "text-primary")}>
                                  {attempts > 0 ? attempts : <User className="h-3 w-3" />}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge
                                  variant={isBeingDialed ? "default" : "outline"}
                                  className={cn("text-[10px] px-1 py-0", isBeingDialed && "bg-blue-600")}
                                >
                                  {isBeingDialed ? "📞" : `#${queueIndex + 1}`}
                                </Badge>
                                <h3 className="font-medium text-xs truncate">
                                  {contact.firstName} {contact.lastName}
                                </h3>
                              </div>
                              <p className="text-[10px] text-gray-600 font-mono">
                                {contact.phone}
                              </p>
                              {/* Show call attempts and retry info */}
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                {attempts > 0 && (
                                  <span className={cn(
                                    "text-[9px] font-medium",
                                    isDeadLead ? "text-red-600" : isHighAttempts ? "text-orange-600" : "text-gray-500"
                                  )}>
                                    Calls: {attempts} {isDeadLead ? '(Dead Lead)' : isHighAttempts ? '(Hard to Reach)' : ''}
                                  </span>
                                )}
                                {showRoundBadge && roundNum > 1 && (
                                  <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 bg-orange-100 text-orange-700 border-orange-200">
                                    Round {roundNum}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }

                  // Calculate running queue index
                  let runningIndex = 0

                  return (
                    <>
                      {sortedRounds.map((roundNum) => {
                        const contactsInRound = contactsByRound.get(roundNum) || []
                        const startIndex = runningIndex
                        runningIndex += contactsInRound.length

                        return (
                          <div key={`round-${roundNum}`}>
                            {/* Round separator - only show for Round 2+ */}
                            {roundNum > 1 && (
                              <div className="py-2">
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 border-t border-dashed border-orange-300"></div>
                                  <span className="text-[10px] font-medium text-orange-600 px-1 bg-orange-50 rounded-full whitespace-nowrap">
                                    🔄 Round {roundNum} ({contactsInRound.length} contacts)
                                  </span>
                                  <div className="flex-1 border-t border-dashed border-orange-300"></div>
                                </div>
                              </div>
                            )}
                            {/* Contacts in this round */}
                            {contactsInRound.map((contact, idx) =>
                              renderContactCard(contact, startIndex + idx, roundNum > 1, roundNum)
                            )}
                          </div>
                        )
                      })}

                      {/* Empty state */}
                      {queue.length === 0 && (
                        <div className="text-center py-6 text-gray-400">
                          <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">No contacts in queue</p>
                          {isRunning && (
                            <p className="text-[10px] text-green-600 mt-1">All done!</p>
                          )}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </ScrollArea>
          </div>

          {/* Session History Panel */}
          <div className="w-80 bg-gray-50 border-l flex flex-col">
            <div className="p-4 border-b bg-white">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-gray-600" />
                Session History
                {sessionHistory.length > 0 && (
                  <Badge variant="secondary">{sessionHistory.length} calls</Badge>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-1">Completed calls this session</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {sessionHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No calls yet</p>
                    <p className="text-xs mt-1">Completed calls will appear here</p>
                  </div>
                ) : (
                  sessionHistory.map((entry) => (
                    <Card key={entry.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Contact name + disposition badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm truncate">
                                {entry.contact.firstName} {entry.contact.lastName}
                              </h3>
                              {editingDispositionId === entry.id ? (
                                <Select
                                  value={entry.dispositionId}
                                  onValueChange={(val) => handleUpdateHistoryDisposition(entry.id, val)}
                                >
                                  <SelectTrigger className="h-5 w-auto text-[10px] px-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dispositions.map((d) => (
                                      <SelectItem key={d.id} value={d.id}>
                                        <span className="flex items-center gap-1">
                                          <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: d.color }}
                                          />
                                          {d.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  className="text-[10px] text-white cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: entry.dispositionColor }}
                                  onClick={() => setEditingDispositionId(entry.id)}
                                  title="Click to change disposition"
                                >
                                  {entry.dispositionName}
                                  <Edit3 className="h-2 w-2 ml-1" />
                                </Badge>
                              )}
                            </div>
                            {/* Phone number called */}
                            <p className="text-xs text-gray-600 font-mono mt-0.5">
                              {entry.contact.phone}
                            </p>
                            {/* Caller ID used (which number we called from) */}
                            {entry.callerIdNumber && (
                              <p className="text-[10px] text-blue-500 font-mono mt-0.5">
                                📞 From: {entry.callerIdNumber}
                              </p>
                            )}
                            {/* Notes preview */}
                            {entry.notes && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">
                                "{entry.notes}"
                              </p>
                            )}
                            {/* Time ago */}
                            <p className="text-[10px] text-gray-400 mt-1">
                              {entry.talkDuration && `${Math.floor(entry.talkDuration / 60)}:${(entry.talkDuration % 60).toString().padStart(2, '0')} • `}
                              {new Date(entry.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {/* Action buttons */}
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-blue-100"
                              title="View contact details"
                              onClick={() => openContactPanel(entry.contact.id)}
                            >
                              <UserCog className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-green-100"
                              title="Call again"
                              onClick={() => {
                                const fromNumber = entry.callerIdNumber || selectedPhoneNumber?.phoneNumber || ''
                                if (fromNumber && entry.contact.phone) {
                                  openCall({
                                    contact: { id: entry.contact.id, firstName: entry.contact.firstName, lastName: entry.contact.lastName },
                                    fromNumber,
                                    toNumber: entry.contact.phone,
                                    mode: 'call_control'
                                  })
                                } else {
                                  toast.error('No phone number available')
                                }
                              }}
                            >
                              <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-purple-100"
                              title="Send text"
                              onClick={() => {
                                const fromNumber = entry.callerIdNumber || selectedPhoneNumber?.phoneNumber || ''
                                openSms({
                                  contact: { id: entry.contact.id, firstName: entry.contact.firstName, lastName: entry.contact.lastName },
                                  phoneNumber: entry.contact.phone,
                                  fromNumber
                                })
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-purple-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-orange-100"
                              title="Send email"
                              onClick={() => {
                                if (entry.contact.email) {
                                  openEmail({
                                    contact: { id: entry.contact.id, firstName: entry.contact.firstName, lastName: entry.contact.lastName },
                                    email: entry.contact.email
                                  })
                                } else {
                                  toast.error('No email address for this contact')
                                }
                              }}
                            >
                              <Mail className="h-3.5 w-3.5 text-orange-600" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Bulk Tag Dialog */}
      <AlertDialog open={bulkTagDialogOpen} onOpenChange={(open) => {
        setBulkTagDialogOpen(open)
        if (!open) {
          setTagSearchQuery('')
          setSelectedTagForBulk('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkTagOperation === 'add' ? 'Add Tag to' : 'Remove Tag from'} {selectedContacts.size} Contacts
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkTagOperation === 'add'
                ? 'Select a tag to add to the selected contacts.'
                : 'Select a tag to remove from the selected contacts.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            {/* Search input with icon */}
            <div className="relative">
              <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {/* Scrollable tag list */}
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {availableTags
                  .filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedTagForBulk(tag.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                        selectedTagForBulk === tag.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate">{tag.name}</span>
                      {selectedTagForBulk === tag.id && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </button>
                  ))}
                {availableTags.filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())).length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">No tags found</div>
                )}
              </div>
            </ScrollArea>
            {/* Selected tag indicator */}
            {selectedTagForBulk && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Selected:</span>
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: `${availableTags.find(t => t.id === selectedTagForBulk)?.color}20`,
                    borderColor: availableTags.find(t => t.id === selectedTagForBulk)?.color
                  }}
                >
                  {availableTags.find(t => t.id === selectedTagForBulk)?.name}
                </Badge>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedTagForBulk(''); setTagSearchQuery('') }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkTagOperation}
              disabled={!selectedTagForBulk}
              className={bulkTagOperation === 'remove' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {bulkTagOperation === 'add' ? 'Add Tag' : 'Remove Tag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.size} Contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected contacts from your CRM. This action can be undone by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Contacts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

