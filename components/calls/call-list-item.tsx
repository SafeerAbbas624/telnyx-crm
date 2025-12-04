'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  formatCallDuration,
  getCallStatusColor,
  getCallOutcomeColor,
  getCallOutcomeIcon,
  getSentimentColor,
  getSentimentIcon,
} from '@/lib/call-utils'
import { Phone, Clock, MessageSquare, Volume2, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CallListItemProps {
  call: any
  callType: 'telnyx' | 'vapi' | 'power_dialer'
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  onDisposition?: () => void
  onPlayRecording?: () => void
  onViewTranscript?: () => void
  onDelete?: () => void
}

export function CallListItem({
  call,
  callType,
  isSelected = false,
  onSelect,
  onDisposition,
  onPlayRecording,
  onViewTranscript,
  onDelete,
}: CallListItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const contactName = call.contact?.firstName
    ? `${call.contact.firstName} ${call.contact.lastName || ''}`
    : call.contactName || 'Unknown'

  const phoneNumber = call.toNumber || call.phone_number || 'N/A'
  const duration = call.duration || 0
  const status = call.status || 'unknown'
  const outcome = call.callOutcome || call.call_outcome
  const sentiment = call.sentiment
  const hasRecording = !!call.recordingUrl || !!call.recording_url
  const hasTranscript = !!call.transcript
  const notes = call.callNotes || call.call_notes

  const createdAt = new Date(call.createdAt || call.created_at)
  const timeAgo = getTimeAgo(createdAt)

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        {onSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(checked as boolean)}
            className="mt-1"
          />
        )}

        {/* Call Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold truncate">{contactName}</span>
            <span className="text-sm text-muted-foreground">{phoneNumber}</span>
          </div>

          {/* Status and Outcome Badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge className={getCallStatusColor(status)} variant="outline">
              {status}
            </Badge>

            {outcome && (
              <Badge className={getCallOutcomeColor(outcome)} variant="outline">
                {getCallOutcomeIcon(outcome)} {outcome}
              </Badge>
            )}

            {sentiment && (
              <Badge className={getSentimentColor(sentiment)} variant="outline">
                {getSentimentIcon(sentiment)} {sentiment}
              </Badge>
            )}
          </div>

          {/* Duration and Time */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatCallDuration(duration)}</span>
            </div>
            <span>{timeAgo}</span>
          </div>

          {/* Notes Preview */}
          {notes && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
              <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{notes}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasRecording && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPlayRecording}
              title="Play recording"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          )}

          {hasTranscript && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewTranscript}
              title="View transcript"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}

          {isHovered && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisposition}
                title="Set disposition"
              >
                Set Outcome
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onPlayRecording && hasRecording && (
                    <DropdownMenuItem onClick={onPlayRecording}>
                      Play Recording
                    </DropdownMenuItem>
                  )}
                  {onViewTranscript && hasTranscript && (
                    <DropdownMenuItem onClick={onViewTranscript}>
                      View Transcript
                    </DropdownMenuItem>
                  )}
                  {onDisposition && (
                    <DropdownMenuItem onClick={onDisposition}>
                      Set Disposition
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return date.toLocaleDateString()
}

