'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Phone, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePhoneNumber } from '@/lib/context/phone-number-context'

interface CallButtonWithCellHoverProps {
  phoneNumber: string
  contactId?: string
  contactName?: string
  onWebRTCCall: () => void // Handler for regular WebRTC call
  className?: string
  variant?: 'ghost' | 'outline' | 'default'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  iconClassName?: string
  disabled?: boolean
}

/**
 * Call button that shows a "Call via Cell" option when hovered for 1 second.
 * - Quick click: initiates regular WebRTC call
 * - Hover 1 second: shows popup to call via user's cell phone
 */
export function CallButtonWithCellHover({
  phoneNumber,
  contactId,
  contactName,
  onWebRTCCall,
  className,
  variant = 'ghost',
  size = 'sm',
  iconClassName = 'h-3.5 w-3.5 text-blue-600',
  disabled = false,
}: CallButtonWithCellHoverProps) {
  const [showCellOption, setShowCellOption] = useState(false)
  const [isCallingCell, setIsCallingCell] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { selectedPhoneNumber } = usePhoneNumber()

  const handleMouseEnter = useCallback(() => {
    // Start 1-second timer to show cell option
    hoverTimeoutRef.current = setTimeout(() => {
      setShowCellOption(true)
    }, 1000)
  }, [])

  const handleMouseLeave = useCallback(() => {
    // Clear timer and hide cell option
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    // Small delay before hiding to allow clicking the cell option
    setTimeout(() => {
      setShowCellOption(false)
    }, 300)
  }, [])

  const handleWebRTCClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Clear hover timer
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setShowCellOption(false)
    onWebRTCCall()
  }, [onWebRTCCall])

  const handleCellCall = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowCellOption(false)
    
    if (!selectedPhoneNumber?.phoneNumber) {
      toast.error('No outbound number selected')
      return
    }

    if (!phoneNumber) {
      toast.error('No phone number to call')
      return
    }

    try {
      setIsCallingCell(true)
      toast.info('Calling your cell phone...')

      const response = await fetch('/api/click-to-call-via-cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadPhone: phoneNumber,
          fromTelnyxNumber: selectedPhoneNumber.phoneNumber,
          contactId: contactId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate call')
      }

      toast.success(`Calling your cell! Answer to connect to ${contactName || 'prospect'}`)
    } catch (error: any) {
      console.error('Click-to-call-via-cell error:', error)
      toast.error(error.message || 'Failed to initiate call')
    } finally {
      setIsCallingCell(false)
    }
  }, [phoneNumber, contactId, contactName, selectedPhoneNumber])

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cell call option popup - appears above the button */}
      {showCellOption && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 animate-in fade-in-0 zoom-in-95 duration-100"
          onMouseEnter={() => {
            // Keep showing when hovering over popup
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
            }
          }}
        >
          <Button
            variant="default"
            size="sm"
            className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white text-xs whitespace-nowrap shadow-lg"
            onClick={handleCellCall}
            disabled={isCallingCell || disabled}
            title="Call via your cell phone"
          >
            <Smartphone className="h-3 w-3 mr-1" />
            {isCallingCell ? 'Calling...' : 'Via Cell'}
          </Button>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-600" />
        </div>
      )}

      {/* Main call button */}
      <Button
        variant={variant}
        size={size}
        className={cn('p-0', size === 'sm' && 'h-7 w-7', className)}
        onClick={handleWebRTCClick}
        disabled={disabled}
        title="Call (WebRTC)"
      >
        <Phone className={iconClassName} />
      </Button>
    </div>
  )
}

