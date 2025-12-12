'use client'

/**
 * Individual Call Window Component
 * Shows a single active call with contact details, call state, property info, and notes
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Phone, PhoneCall, PhoneOff, User, Building2, Clock, UserCog, Plus, Mail, PanelRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Disposition {
  id: string
  name: string
  color: string
  icon?: string
  actions?: any[]
}

interface CallWindowProps {
  lineNumber: number
  contact: {
    id: string
    firstName: string
    lastName: string
    phone: string
    phone2?: string
    phone3?: string
    email?: string
    email2?: string
    propertyAddress?: string
    propertyAddress2?: string
    propertyAddress3?: string
    city?: string
    state?: string
    zipCode?: string
    llcName?: string
  } | null
  status: 'idle' | 'dialing' | 'ringing' | 'connected' | 'hanging_up' | 'ended'
  startedAt?: Date
  onHangup?: () => void
  onOpenContactPanel?: () => void // Open full contact side panel
  onCreateTask?: () => void // Create a new task for this contact
  callerIdNumber?: string // The number we're calling FROM
  callId?: string // The call ID for linking notes
  notes?: string // Initial notes value
  onNotesChange?: (notes: string) => void // Callback when notes change
  dispositions?: Disposition[] // Available dispositions
  onDisposition?: (dispositionId: string, dispositionName: string) => void // Callback when disposition selected
}

function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

export function PowerDialerCallWindow({
  lineNumber,
  contact,
  status,
  startedAt,
  onHangup,
  onOpenContactPanel,
  onCreateTask,
  callerIdNumber,
  callId,
  notes: initialNotes = '',
  onNotesChange,
  dispositions = [],
  onDisposition
}: CallWindowProps) {
  const [duration, setDuration] = useState('0:00')
  const [localNotes, setLocalNotes] = useState(initialNotes)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync local notes with prop changes
  useEffect(() => {
    setLocalNotes(initialNotes)
  }, [initialNotes])

  // Auto-save notes with debounce
  const saveNotes = useCallback(async (notesText: string) => {
    if (!contact?.id) return

    // Notify parent of notes change
    onNotesChange?.(notesText)

    // Also save to contact activity if we have a callId
    if (callId && notesText.trim()) {
      try {
        await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: contact.id,
            type: 'note',
            title: 'Call Note',
            description: notesText,
            metadata: { callId, source: 'power-dialer' }
          })
        })
      } catch (error) {
        console.error('Failed to save note activity:', error)
      }
    }
  }, [contact?.id, callId, onNotesChange])

  const handleNotesChange = (value: string) => {
    setLocalNotes(value)

    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(value)
    }, 1500) // 1.5 second debounce
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Update duration timer - stop when call ends
  useEffect(() => {
    if (!startedAt || status === 'idle') {
      setDuration('0:00')
      return
    }

    // Stop timer when call is ended or hanging up
    if (status === 'ended' || status === 'hanging_up') {
      // Keep the final duration displayed, don't reset or continue counting
      return
    }

    const interval = setInterval(() => {
      const now = new Date()
      const seconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      setDuration(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt, status])

  // Get card styling based on status
  const getCardStyle = () => {
    switch (status) {
      case 'idle':
        return 'border-dashed border-2 border-gray-300 bg-gray-50'
      case 'dialing':
        return 'border-2 border-blue-400 bg-blue-50 shadow-lg'
      case 'ringing':
        return 'border-2 border-yellow-400 bg-yellow-50 shadow-lg animate-pulse'
      case 'connected':
        return 'border-2 border-green-500 bg-green-50 shadow-xl'
      case 'hanging_up':
        return 'border-2 border-red-400 bg-red-50 shadow-lg'
      case 'ended':
        return 'border-2 border-red-500 bg-red-100 shadow-lg' // Red - call ended, waiting for disposition
      default:
        return 'border-2 border-gray-300 bg-white'
    }
  }

  // Get status badge
  const getStatusBadge = () => {
    switch (status) {
      case 'idle':
        return <Badge variant="outline" className="text-xs">Available</Badge>
      case 'dialing':
        return <Badge className="bg-blue-500 text-white text-xs">Dialing...</Badge>
      case 'ringing':
        return <Badge className="bg-yellow-500 text-white text-xs animate-pulse">Ringing...</Badge>
      case 'connected':
        return <Badge className="bg-green-600 text-white text-xs">● CONNECTED</Badge>
      case 'hanging_up':
        return <Badge className="bg-red-500 text-white text-xs">Hanging Up...</Badge>
      case 'ended':
        return <Badge className="bg-red-600 text-white text-xs">📝 Select Disposition</Badge>
      default:
        return null
    }
  }

  // Get icon based on status
  const getIcon = () => {
    switch (status) {
      case 'dialing':
        return <Phone className="h-5 w-5 text-blue-600 animate-pulse" />
      case 'ringing':
        return <PhoneCall className="h-5 w-5 text-yellow-600 animate-bounce" />
      case 'connected':
        return <Phone className="h-5 w-5 text-green-600" />
      case 'hanging_up':
        return <PhoneOff className="h-5 w-5 text-red-600" />
      case 'ended':
        return <PhoneOff className="h-5 w-5 text-red-700" />
      default:
        return <User className="h-5 w-5 text-gray-400" />
    }
  }

  if (!contact) {
    // Empty slot
    return (
      <Card className={cn('transition-all duration-300', getCardStyle())}>
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[220px]">
          <User className="h-10 w-10 mb-3 text-gray-300" />
          <span className="text-sm font-medium text-gray-500">Line {lineNumber}</span>
          <span className="text-xs text-gray-400">Available</span>
        </CardContent>
      </Card>
    )
  }

  // Collect all property addresses
  const propertyAddresses = [
    contact.propertyAddress,
    contact.propertyAddress2,
    contact.propertyAddress3
  ].filter(Boolean)

  return (
    <Card className={cn('transition-all duration-300 min-w-[180px]', getCardStyle())}>
      <CardContent className="p-3 space-y-2">
        {/* Header: Line number + Status + Action Icons */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-semibold px-1.5">
              Line {lineNumber}
            </Badge>
            {getStatusBadge()}
          </div>
          {/* Action Icons: Call icon, + for task, contact panel */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {getIcon()}
            {onCreateTask && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 hover:bg-green-100"
                onClick={onCreateTask}
                title="Create new task"
              >
                <Plus className="h-3.5 w-3.5 text-green-600" />
              </Button>
            )}
            {onOpenContactPanel && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 hover:bg-blue-100"
                onClick={onOpenContactPanel}
                title="Open contact panel"
              >
                <PanelRight className="h-3.5 w-3.5 text-blue-600" />
              </Button>
            )}
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-1.5">
          {/* Name */}
          <h3 className="font-semibold text-sm truncate leading-tight">
            {contact.firstName} {contact.lastName}
          </h3>

          {/* Phone */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono text-[11px]">{formatPhoneDisplay(contact.phone)}</span>
          </div>

          {/* LLC Name - only show if present, compact */}
          {contact.llcName && (
            <p className="text-[10px] text-gray-500 italic truncate pl-4">
              {contact.llcName}
            </p>
          )}

          {/* Caller ID - Show which number we're calling FROM */}
          {callerIdNumber && (status === 'connected' || status === 'ringing' || status === 'dialing') && (
            <div className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
              <Phone className="h-2.5 w-2.5" />
              <span>From: <span className="font-mono font-semibold">{formatPhoneDisplay(callerIdNumber)}</span></span>
            </div>
          )}

          {/* Property Addresses - compact, show first 2 only */}
          {propertyAddresses.length > 0 && (
            <div className="space-y-1">
              {propertyAddresses.slice(0, 2).map((addr, idx) => (
                <div key={idx} className="flex items-start gap-1 text-[10px] text-gray-700 bg-white/50 p-1 rounded">
                  <Building2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{addr}</span>
                </div>
              ))}
              {propertyAddresses.length > 2 && (
                <span className="text-[9px] text-gray-500 pl-4">+{propertyAddresses.length - 2} more</span>
              )}
            </div>
          )}
        </div>

        {/* Disposition Buttons - Show when call is connected or ended */}
        {(status === 'connected' || status === 'ended') && dispositions.length > 0 && onDisposition && (
          <div className="pt-1.5 border-t">
            <label className={cn(
              "text-[10px] font-medium mb-1 block",
              status === 'ended' ? "text-red-700" : "text-green-700"
            )}>
              {status === 'ended' ? '📝 Select Disposition' : '📋 Select Disposition'}
            </label>
            <div className="flex flex-wrap gap-1">
              {dispositions.map((dispo) => {
                const iconMap: Record<string, string> = {
                  'ThumbsUp': '✅', 'ThumbsDown': '❌', 'Calendar': '📞',
                  'PhoneMissed': '📵', 'Voicemail': '📧', 'PhoneOff': '📴',
                  'Ban': '🚫', 'Check': '✓'
                }
                const emoji = dispo.icon ? (iconMap[dispo.icon] || '') : ''
                return (
                  <Button
                    key={dispo.id}
                    size="sm"
                    className="text-white text-[10px] h-6 px-1.5"
                    style={{ backgroundColor: dispo.color }}
                    onClick={() => onDisposition(dispo.id, dispo.name)}
                  >
                    {emoji} {dispo.name}
                    {dispo.actions && dispo.actions.length > 0 && (
                      <span className="ml-0.5 text-[9px] opacity-75">⚡</span>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes Section - Only show when call is active or ended - compact */}
        {(status === 'connected' || status === 'ended') && (
          <div className="space-y-0.5 pt-1.5 border-t">
            <label className="text-[10px] font-medium text-gray-500">📝 Notes</label>
            <Textarea
              placeholder="Add notes..."
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="min-h-[40px] text-xs resize-none p-1.5"
            />
          </div>
        )}

        {/* Duration Timer & Hangup Button - more compact */}
        {status !== 'idle' && (
          <div className="flex items-center justify-between pt-1.5 border-t">
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="font-mono tabular-nums">{duration}</span>
            </div>
            {/* Hangup Button - always visible when call is active */}
            {(status === 'dialing' || status === 'ringing' || status === 'connected') && onHangup && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onHangup}
                className="flex items-center gap-1 h-6 text-xs px-2"
              >
                <PhoneOff className="h-3 w-3" />
                Hang Up
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

