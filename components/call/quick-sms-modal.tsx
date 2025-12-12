"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { ScheduleSendModal } from "@/components/ui/schedule-send-modal"
import { ChevronDown, Clock } from "lucide-react"
import { format } from "date-fns"
import type { Contact } from "@/lib/types"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  state?: string
  city?: string
  isActive: boolean
}

interface QuickSmsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  phoneNumber: string
  onMessageSent?: () => void
}

export default function QuickSmsModal({
  open,
  onOpenChange,
  contact,
  phoneNumber,
  onMessageSent
}: QuickSmsModalProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [message, setMessage] = useState("")
  const [selectedSenderNumber, setSelectedSenderNumber] = useState<string>("")
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isSending, setIsSending] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Load available phone numbers
  useEffect(() => {
    if (open) {
      loadAvailableNumbers()
    }
  }, [open])

  const loadAvailableNumbers = async () => {
    try {
      // Use user-specific phone numbers endpoint (respects permissions)
      const response = await fetch('/api/user/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        const numbers = data.phoneNumbers || []
        setAvailableNumbers(numbers.filter((n: TelnyxPhoneNumber) => n.isActive))

        // Use default phone number if set, otherwise first available
        if (data.defaultPhoneNumber) {
          setSelectedSenderNumber(data.defaultPhoneNumber.phoneNumber)
        } else if (numbers.length > 0) {
          setSelectedSenderNumber(numbers[0].phoneNumber)
        }

        // Show warning if no numbers available
        if (numbers.length === 0) {
          toast({
            title: 'No Phone Numbers',
            description: 'You have no phone numbers assigned. Contact your admin.',
            variant: 'destructive'
          })
        }
      }
    } catch (error) {
      console.error('Failed to load phone numbers:', error)
      toast({ title: 'Error', description: 'Failed to load phone numbers', variant: 'destructive' })
    }
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: 'Error', description: 'Please enter a message', variant: 'destructive' })
      return
    }

    if (!selectedSenderNumber) {
      toast({ title: 'Error', description: 'Please select a sender number', variant: 'destructive' })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/telnyx/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          from: selectedSenderNumber,
          text: message,
          contactId: contact?.id
        })
      })

      if (response.ok) {
        toast({ title: 'Success', description: 'SMS sent successfully' })
        setMessage("")
        onOpenChange(false)
        onMessageSent?.()
      } else {
        const error = await response.json()
        toast({ title: 'Error', description: error.message || 'Failed to send SMS', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      toast({ title: 'Error', description: 'Failed to send SMS', variant: 'destructive' })
    } finally {
      setIsSending(false)
    }
  }

  // Schedule send handler
  const handleScheduleSend = async (scheduledAt: Date) => {
    if (!message.trim()) {
      throw new Error('Please enter a message')
    }
    if (!selectedSenderNumber) {
      throw new Error('Please select a sender number')
    }
    if (!contact?.id) {
      throw new Error('No contact selected')
    }

    const response = await fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'SMS',
        contactId: contact.id,
        scheduledAt: scheduledAt.toISOString(),
        fromNumber: selectedSenderNumber,
        toNumber: phoneNumber,
        body: message,
        metadata: { source: 'quick_sms_modal' },
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to schedule SMS')
    }

    toast({ title: 'Success', description: `SMS scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}` })
    setMessage("")
    onOpenChange(false)
    onMessageSent?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contact Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">To:</p>
              <p className="font-semibold">
                {contact?.firstName} {contact?.lastName}
              </p>
              <p className="text-sm text-gray-600">
                {formatPhoneNumberForDisplay(phoneNumber)}
              </p>
            </div>

            {/* Sender Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium">From:</label>
              <Select value={selectedSenderNumber} onValueChange={setSelectedSenderNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sender number" />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.map((num) => (
                    <SelectItem key={num.id} value={num.phoneNumber}>
                      <div className="flex flex-col">
                        <span>{formatPhoneNumberForDisplay(num.phoneNumber)}</span>
                        {num.friendlyName && (
                          <span className="text-xs text-muted-foreground">{num.friendlyName}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Message:</label>
              <Textarea
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px]"
              />
              <p className="text-xs text-gray-500">{message.length} characters</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex">
              <Button
                onClick={handleSend}
                disabled={isSending || !message.trim()}
                className="rounded-r-none"
              >
                {isSending ? 'Sending...' : 'Send SMS'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={isSending || !message.trim()}
                    className="rounded-l-none border-l border-blue-400 px-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowScheduleModal(true)}>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule send...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Send Modal */}
      {showScheduleModal && (
        <ScheduleSendModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleSend}
          channel="SMS"
          preview={{
            to: formatPhoneNumberForDisplay(phoneNumber),
            bodyPreview: message.substring(0, 100),
          }}
        />
      )}
    </>
  )
}

