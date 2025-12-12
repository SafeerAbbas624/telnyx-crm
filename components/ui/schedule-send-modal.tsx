"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, AlertCircle } from "lucide-react"
import { format, addMinutes, setHours, setMinutes } from "date-fns"

interface ScheduleSendModalProps {
  isOpen: boolean
  onClose: () => void
  onSchedule: (scheduledAt: Date) => Promise<void>
  channel: 'SMS' | 'EMAIL'
  preview?: {
    to?: string
    subject?: string
    bodyPreview?: string
  }
}

export function ScheduleSendModal({
  isOpen,
  onClose,
  onSchedule,
  channel,
  preview,
}: ScheduleSendModalProps) {
  const [isScheduling, setIsScheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize with 10 minutes from now, rounded to nearest 5 minutes
  const getDefaultDateTime = () => {
    const now = new Date()
    const tenMinutesFromNow = addMinutes(now, 10)
    const minutes = tenMinutesFromNow.getMinutes()
    const roundedMinutes = Math.ceil(minutes / 5) * 5
    return setMinutes(tenMinutesFromNow, roundedMinutes)
  }

  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = getDefaultDateTime()
    return format(d, 'yyyy-MM-dd')
  })
  
  const [scheduledTime, setScheduledTime] = useState(() => {
    const d = getDefaultDateTime()
    return format(d, 'HH:mm')
  })

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      const d = getDefaultDateTime()
      setScheduledDate(format(d, 'yyyy-MM-dd'))
      setScheduledTime(format(d, 'HH:mm'))
      setError(null)
    }
  }, [isOpen])

  const handleSchedule = async () => {
    setError(null)
    
    // Combine date and time into a single Date object
    const [year, month, day] = scheduledDate.split('-').map(Number)
    const [hours, minutes] = scheduledTime.split(':').map(Number)
    const scheduledAt = new Date(year, month - 1, day, hours, minutes)
    
    // Validate it's at least 1 minute in the future
    const minTime = addMinutes(new Date(), 1)
    if (scheduledAt < minTime) {
      setError('Scheduled time must be at least 1 minute in the future')
      return
    }

    setIsScheduling(true)
    try {
      await onSchedule(scheduledAt)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to schedule message')
    } finally {
      setIsScheduling(false)
    }
  }

  const formattedDateTime = () => {
    try {
      const [year, month, day] = scheduledDate.split('-').map(Number)
      const [hours, minutes] = scheduledTime.split(':').map(Number)
      const d = new Date(year, month - 1, day, hours, minutes)
      return format(d, "MMMM d, yyyy 'at' h:mm a")
    } catch {
      return 'Invalid date/time'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Schedule {channel}
          </DialogTitle>
          <DialogDescription>
            Choose when to send this message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview section */}
          {preview && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              {preview.to && (
                <p><span className="font-medium text-gray-600">To:</span> {preview.to}</p>
              )}
              {preview.subject && (
                <p><span className="font-medium text-gray-600">Subject:</span> {preview.subject}</p>
              )}
              {preview.bodyPreview && (
                <p className="text-gray-500 truncate">{preview.bodyPreview}</p>
              )}
            </div>
          )}

          {/* Date picker */}
          <div className="space-y-2">
            <Label htmlFor="schedule-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date
            </Label>
            <Input
              id="schedule-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Time picker - using selects for better UX */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time
            </Label>
            <div className="flex gap-2 items-center">
              <Select
                value={scheduledTime.split(':')[0]}
                onValueChange={(hour) => {
                  const mins = scheduledTime.split(':')[1] || '00'
                  setScheduledTime(`${hour}:${mins}`)
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0')
                    const displayHour = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`
                    return (
                      <SelectItem key={hour} value={hour}>
                        {displayHour}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <span className="text-gray-500 font-medium">:</span>
              <Select
                value={scheduledTime.split(':')[1] || '00'}
                onValueChange={(mins) => {
                  const hour = scheduledTime.split(':')[0] || '00'
                  setScheduledTime(`${hour}:${mins}`)
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((min) => (
                    <SelectItem key={min} value={min}>
                      {min}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Display selected datetime */}
          <div className="text-sm text-center py-2 bg-blue-50 rounded-lg text-blue-700">
            Will send on <span className="font-medium">{formattedDateTime()}</span>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isScheduling}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={isScheduling} className="bg-blue-600 hover:bg-blue-700">
            {isScheduling ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

