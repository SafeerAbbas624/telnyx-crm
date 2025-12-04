'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface CallDispositionPopupProps {
  isOpen: boolean
  onClose: () => void
  callId: string
  callType: 'telnyx' | 'vapi' | 'power_dialer'
  contactName?: string
  onSuccess?: () => void
}

const CALL_OUTCOMES = [
  { value: 'interested', label: '✅ Interested', color: 'bg-green-100' },
  { value: 'not_interested', label: '❌ Not Interested', color: 'bg-red-100' },
  { value: 'callback', label: '📞 Callback', color: 'bg-blue-100' },
  { value: 'voicemail', label: '📧 Voicemail', color: 'bg-gray-100' },
  { value: 'wrong_number', label: '❓ Wrong Number', color: 'bg-yellow-100' },
  { value: 'no_answer', label: '⏱️ No Answer', color: 'bg-orange-100' },
  { value: 'busy', label: '🔴 Busy', color: 'bg-red-200' },
]

export function CallDispositionPopup({
  isOpen,
  onClose,
  callId,
  callType,
  contactName,
  onSuccess,
}: CallDispositionPopupProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [scheduleCallback, setScheduleCallback] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!selectedOutcome) {
      toast({
        title: 'Error',
        description: 'Please select a call outcome',
        variant: 'destructive',
      })
      return
    }

    if (scheduleCallback && (!callbackDate || !callbackTime)) {
      toast({
        title: 'Error',
        description: 'Please provide callback date and time',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/calls/disposition', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          callType,
          outcome: selectedOutcome,
          notes: notes || null,
          tags: selectedOutcome === 'interested' ? ['interested'] : [],
          scheduleCallback: scheduleCallback
            ? { date: callbackDate, time: callbackTime }
            : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to set disposition')
      }

      toast({
        title: 'Success',
        description: `Call disposition set to ${selectedOutcome}`,
      })

      // Reset form
      setSelectedOutcome('')
      setNotes('')
      setScheduleCallback(false)
      setCallbackDate('')
      setCallbackTime('')

      onClose()
      onSuccess?.()
    } catch (error) {
      console.error('Error setting disposition:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set disposition',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Call Disposition</DialogTitle>
          <DialogDescription>
            {contactName ? `Set outcome for call with ${contactName}` : 'Set the outcome for this call'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome Selection */}
          <div className="space-y-2">
            <Label>Call Outcome</Label>
            <div className="grid grid-cols-2 gap-2">
              {CALL_OUTCOMES.map((outcome) => (
                <Button
                  key={outcome.value}
                  variant={selectedOutcome === outcome.value ? 'default' : 'outline'}
                  className={`text-xs ${
                    selectedOutcome === outcome.value ? '' : outcome.color
                  }`}
                  onClick={() => setSelectedOutcome(outcome.value)}
                >
                  {outcome.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24"
            />
          </div>

          {/* Schedule Callback */}
          {selectedOutcome === 'callback' && (
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={scheduleCallback}
                  onChange={(e) => setScheduleCallback(e.target.checked)}
                  className="rounded"
                />
                Schedule Callback
              </Label>

              {scheduleCallback && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="date" className="text-xs">
                      Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={callbackDate}
                      onChange={(e) => setCallbackDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time" className="text-xs">
                      Time
                    </Label>
                    <Input
                      id="time"
                      type="time"
                      value={callbackTime}
                      onChange={(e) => setCallbackTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Disposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

