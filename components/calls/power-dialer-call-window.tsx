'use client'

/**
 * Individual Call Window Component
 * Shows a single active call with contact details, call state, and property info
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, PhoneCall, PhoneOff, User, Building2, MapPin, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CallWindowProps {
  lineNumber: number
  contact: {
    id: string
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
  } | null
  status: 'idle' | 'dialing' | 'ringing' | 'connected' | 'hanging_up'
  startedAt?: Date
  onHangup?: () => void
  callerIdNumber?: string // The number we're calling FROM
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

export function PowerDialerCallWindow({ lineNumber, contact, status, startedAt, onHangup, callerIdNumber }: CallWindowProps) {
  const [duration, setDuration] = useState('0:00')

  // Update duration timer
  useEffect(() => {
    if (!startedAt || status === 'idle') {
      setDuration('0:00')
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
    <Card className={cn('transition-all duration-300', getCardStyle())}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Line number + Status */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-semibold">
            Line {lineNumber}
          </Badge>
          {getStatusBadge()}
        </div>

        {/* Contact Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {contact.firstName} {contact.lastName}
              </h3>
              <p className="text-sm text-gray-600 font-mono">
                {formatPhoneDisplay(contact.phone)}
              </p>
              {contact.llcName && (
                <p className="text-xs text-gray-500 italic truncate">
                  {contact.llcName}
                </p>
              )}
            </div>
          </div>

          {/* Caller ID - Show which number we're calling FROM */}
          {callerIdNumber && (status === 'connected' || status === 'ringing' || status === 'dialing') && (
            <div className="flex items-center gap-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              <Phone className="h-3 w-3" />
              <span>Calling from: <span className="font-mono font-semibold">{formatPhoneDisplay(callerIdNumber)}</span></span>
            </div>
          )}

          {/* Property Addresses */}
          {propertyAddresses.length > 0 && (
            <div className="space-y-1.5">
              {propertyAddresses.map((addr, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-white/50 p-2 rounded">
                  <Building2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-500 font-semibold">Property {idx + 1}</span>
                    <p className="line-clamp-2">{addr}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Duration Timer & Hangup Button */}
        {status !== 'idle' && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-mono tabular-nums">{duration}</span>
            </div>
            {/* Hangup Button - always visible when call is active */}
            {(status === 'dialing' || status === 'ringing' || status === 'connected') && onHangup && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onHangup}
                className="flex items-center gap-1"
              >
                <PhoneOff className="h-4 w-4" />
                Hang Up
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

