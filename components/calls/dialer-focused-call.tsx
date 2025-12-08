'use client'

/**
 * Focused Call View - Shows when a call is connected
 * Full-screen focus on the connected contact with script and disposition
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Phone,
  PhoneOff,
  User,
  Building2,
  MapPin,
  Mail,
  Clock,
  Mic,
  MicOff,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Voicemail,
  Ban,
  PhoneMissed,
  Check,
  Loader2,
  X
} from 'lucide-react'
import type { ActiveLeg, DialerContact } from '@/lib/dialer/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CallDisposition {
  id: string
  name: string
  color: string
  icon?: string
}

interface CallScript {
  id: string
  name: string
  content: string
  variables: string[]
}

interface FocusedCallProps {
  leg: ActiveLeg
  script: CallScript | null
  dispositions: CallDisposition[]
  onHangup: () => void
  onDisposition: (dispositionId: string, notes?: string) => Promise<void>
  onClose: () => void
}

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  ThumbsUp, ThumbsDown, Calendar, Voicemail, Ban, PhoneMissed, PhoneOff, Check
}

function getIcon(iconName?: string) {
  if (!iconName) return ThumbsUp
  return iconMap[iconName] || ThumbsUp
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

function hydrateScript(content: string, contact: DialerContact): string {
  if (!content) return ''
  return content
    .replace(/\{\{firstName\}\}/gi, contact.firstName || '')
    .replace(/\{\{lastName\}\}/gi, contact.lastName || '')
    .replace(/\{\{fullName\}\}/gi, contact.fullName || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '')
    .replace(/\{\{llcName\}\}/gi, contact.llcName || '')
    .replace(/\{\{propertyAddress\}\}/gi, contact.propertyAddress || '')
    .replace(/\{\{city\}\}/gi, contact.city || '')
    .replace(/\{\{state\}\}/gi, contact.state || '')
    .replace(/\{\{zipCode\}\}/gi, contact.zipCode || '')
}

export function FocusedCall({ leg, script, dispositions, onHangup, onDisposition, onClose }: FocusedCallProps) {
  const [duration, setDuration] = useState('0:00')
  const [isMuted, setIsMuted] = useState(false)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDisposition, setSelectedDisposition] = useState<string | null>(null)

  const contact = leg.contact

  // Update duration timer
  useEffect(() => {
    const start = leg.answeredAt ? new Date(leg.answeredAt) : new Date(leg.startedAt)
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - start.getTime()) / 1000)
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      setDuration(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [leg.answeredAt, leg.startedAt])

  const handleDisposition = async (dispositionId: string) => {
    setIsSubmitting(true)
    setSelectedDisposition(dispositionId)
    try {
      await onDisposition(dispositionId, notes)
      toast.success('Disposition saved')
      onClose()
    } catch {
      toast.error('Failed to save disposition')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="h-full flex flex-col p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Badge className="bg-green-600 text-white text-lg px-4 py-2 animate-pulse">
              ● CONNECTED
            </Badge>
            <div className="flex items-center gap-2 text-2xl font-mono">
              <Clock className="h-6 w-6" />
              {duration}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
          {/* Left: Contact Info + Script */}
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Contact Card */}
            <Card className="border-green-500 border-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl">{contact.fullName}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {formatPhoneDisplay(contact.phone)}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contact.llcName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.llcName}</span>
                  </div>
                )}
                {contact.propertyAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.propertyAddress}{contact.city && `, ${contact.city}`}{contact.state && `, ${contact.state}`}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Script Panel */}
            {script ? (
              <Card className="flex-1 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">📜 {script.name}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-y-auto h-[calc(100%-60px)]">
                  <div
                    className="prose prose-lg max-w-none whitespace-pre-wrap text-base leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: hydrateScript(script.content, contact) }}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="flex-1 flex items-center justify-center text-muted-foreground text-lg">
                No script assigned to this list
              </Card>
            )}

            {/* Call Controls */}
            <div className="flex gap-2">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={onHangup}>
                <PhoneOff className="h-4 w-4 mr-2" />
                Hang Up
              </Button>
            </div>
          </div>

          {/* Right: Disposition Panel */}
          <div className="flex flex-col gap-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Select Disposition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {dispositions.map(dispo => {
                    const Icon = getIcon(dispo.icon)
                    const isSelected = selectedDisposition === dispo.id
                    return (
                      <Button
                        key={dispo.id}
                        variant="outline"
                        className={cn(
                          'h-16 flex flex-col items-center justify-center gap-1 text-white',
                          isSubmitting && 'opacity-50'
                        )}
                        style={{ backgroundColor: isSelected ? dispo.color : dispo.color + 'cc' }}
                        disabled={isSubmitting}
                        onClick={() => handleDisposition(dispo.id)}
                      >
                        {isSubmitting && isSelected ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                        <span className="text-xs">{dispo.name}</span>
                      </Button>
                    )
                  })}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Textarea
                    placeholder="Add notes about this call..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

