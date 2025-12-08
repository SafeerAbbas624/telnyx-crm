'use client'

/**
 * Multi-Line Power Dialer Queue Panel
 * 
 * Right-side scrolling queue showing contacts waiting to be dialed,
 * with real-time status updates as calls progress.
 */

import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Users, 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneMissed,
  Voicemail,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'
import type { DialerContact, ActiveLeg, CompletedLeg, DialerRunStats, DialerCallStatus } from '@/lib/dialer/types'
import { cn } from '@/lib/utils'

interface DialerQueuePanelProps {
  queue: DialerContact[]
  activeLegs: ActiveLeg[]
  completedLegs: CompletedLeg[]
  stats: DialerRunStats | null
  totalContacts: number
  isRunning: boolean
  isPaused: boolean
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

function getStatusIcon(status: DialerCallStatus) {
  switch (status) {
    case 'dialing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    case 'ringing':
      return <PhoneCall className="h-4 w-4 text-yellow-500 animate-pulse" />
    case 'amd_check':
      return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
    case 'answered':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'voicemail':
    case 'machine':
      return <Voicemail className="h-4 w-4 text-orange-500" />
    case 'no_answer':
      return <PhoneMissed className="h-4 w-4 text-gray-500" />
    case 'busy':
      return <PhoneOff className="h-4 w-4 text-red-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'canceled_other_answer':
      return <PhoneOff className="h-4 w-4 text-gray-400" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

function getStatusBadge(status: DialerCallStatus) {
  const variants: Record<DialerCallStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    idle: { variant: 'outline', label: 'Waiting' },
    queued: { variant: 'outline', label: 'Queued' },
    dialing: { variant: 'default', label: 'Dialing' },
    ringing: { variant: 'default', label: 'Ringing' },
    amd_check: { variant: 'secondary', label: 'Checking' },
    answered: { variant: 'default', label: 'Connected' },
    voicemail: { variant: 'secondary', label: 'Voicemail' },
    machine: { variant: 'secondary', label: 'Machine' },
    no_answer: { variant: 'outline', label: 'No Answer' },
    busy: { variant: 'destructive', label: 'Busy' },
    failed: { variant: 'destructive', label: 'Failed' },
    skipped: { variant: 'outline', label: 'Skipped' },
    canceled_other_answer: { variant: 'outline', label: 'Canceled' }
  }
  const config = variants[status] || { variant: 'outline', label: status }
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
}

export function DialerQueuePanel({
  queue,
  activeLegs,
  completedLegs,
  stats,
  totalContacts,
  isRunning,
  isPaused
}: DialerQueuePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to show active calls
  useEffect(() => {
    if (isRunning && activeLegs.length > 0 && scrollRef.current) {
      const firstActive = scrollRef.current.querySelector('[data-active="true"]')
      if (firstActive) {
        firstActive.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [isRunning, activeLegs])

  const attempted = stats?.totalAttempted || 0
  const progressPercent = totalContacts > 0 ? (attempted / totalContacts) * 100 : 0

  return (
    <div className="w-[400px] flex flex-col border rounded-lg bg-card h-full">
      {/* Header with Stats */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h3 className="font-semibold">Call Queue</h3>
          </div>
          {isRunning && (
            <Badge variant="default" className="animate-pulse">
              {isPaused ? 'Paused' : 'Running'}
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{attempted} / {totalContacts} attempted</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-green-50 rounded">
              <div className="text-lg font-bold text-green-600">{stats.totalAnswered}</div>
              <div className="text-xs text-muted-foreground">Answered</div>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-600">{stats.totalNoAnswer}</div>
              <div className="text-xs text-muted-foreground">No Answer</div>
            </div>
            <div className="p-2 bg-orange-50 rounded">
              <div className="text-lg font-bold text-orange-600">{stats.totalVoicemail}</div>
              <div className="text-xs text-muted-foreground">Voicemail</div>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <div className="text-lg font-bold text-red-600">{stats.totalFailed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        )}
      </div>

      {/* Queue List */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {queue.length === 0 && activeLegs.length === 0 && completedLegs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No contacts in queue</p>
            <p className="text-xs text-muted-foreground mt-1">Start a dialer run to begin calling</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Recently Completed Legs (fading out) */}
            {completedLegs.map((leg) => (
              <QueueContactItem
                key={`completed-${leg.legId}`}
                contact={leg.contact}
                status={leg.status}
                lineNumber={leg.lineNumber}
                fromNumber={leg.fromNumber}
                isActive={false}
                isCompleted={true}
              />
            ))}

            {/* Active Legs */}
            {activeLegs.map((leg) => (
              <QueueContactItem
                key={`active-${leg.legId}`}
                contact={leg.contact}
                status={leg.status}
                lineNumber={leg.lineNumber}
                fromNumber={leg.fromNumber}
                isActive={true}
                isCompleted={false}
              />
            ))}

            {/* Queued Contacts */}
            {queue.slice(0, 50).map((contact, index) => (
              <QueueContactItem
                key={`queued-${contact.listEntryId}`}
                contact={contact}
                status="queued"
                queuePosition={index + 1}
                isActive={false}
                isCompleted={false}
              />
            ))}

            {queue.length > 50 && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                + {queue.length - 50} more contacts
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

interface QueueContactItemProps {
  contact: DialerContact
  status: DialerCallStatus
  lineNumber?: number
  fromNumber?: string
  queuePosition?: number
  isActive: boolean
  isCompleted: boolean
}

function QueueContactItem({
  contact,
  status,
  lineNumber,
  fromNumber,
  queuePosition,
  isActive,
  isCompleted
}: QueueContactItemProps) {
  const bgClass = isActive
    ? status === 'answered'
      ? 'bg-green-50 border-l-4 border-l-green-500'
      : status === 'ringing'
      ? 'bg-yellow-50 border-l-4 border-l-yellow-500 animate-pulse'
      : 'bg-blue-50 border-l-4 border-l-blue-500'
    : isCompleted
    ? status === 'answered'
      ? 'bg-green-50/50 opacity-75'
      : status === 'canceled_other_answer'
      ? 'bg-gray-50 opacity-50'
      : 'bg-gray-50 opacity-75'
    : ''

  return (
    <div
      data-active={isActive}
      className={cn('p-3 transition-all duration-300', bgClass)}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon / Queue Position */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
          isActive ? 'bg-white shadow-sm' : 'bg-muted'
        )}>
          {isActive || isCompleted ? (
            getStatusIcon(status)
          ) : (
            <span className="text-muted-foreground">{queuePosition}</span>
          )}
        </div>

        {/* Contact Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{contact.fullName}</span>
            {lineNumber && (
              <Badge variant="outline" className="text-xs">Line {lineNumber}</Badge>
            )}
          </div>

          {contact.llcName && (
            <div className="text-xs text-muted-foreground truncate">{contact.llcName}</div>
          )}

          {contact.propertyAddress && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              📍 {contact.propertyAddress}
              {contact.city && `, ${contact.city}`}
              {contact.state && `, ${contact.state}`}
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 mt-1 text-xs">
            <div>
              <span className="text-muted-foreground">To:</span>{' '}
              <span className="font-medium">{formatPhoneDisplay(contact.phone)}</span>
            </div>
            {fromNumber && (
              <div>
                <span className="text-muted-foreground">From:</span>{' '}
                <span className="text-blue-600 font-medium">{formatPhoneDisplay(fromNumber)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          {(isActive || isCompleted) && getStatusBadge(status)}
        </div>
      </div>
    </div>
  )
}

