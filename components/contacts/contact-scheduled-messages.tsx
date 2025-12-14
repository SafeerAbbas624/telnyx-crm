"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Mail, MessageSquare, X, Calendar as CalendarIcon, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ContactScheduledMessagesProps {
  contactId: string
}

interface ScheduledMessage {
  id: string
  channel: 'SMS' | 'EMAIL'
  status: 'PENDING' | 'SENDING' | 'SENT' | 'CANCELED' | 'FAILED'
  scheduledAt: string
  sentAt?: string
  failedAt?: string
  fromNumber?: string
  toNumber?: string
  fromEmail?: string
  toEmail?: string
  subject?: string
  body: string
  errorMessage?: string
  createdBy?: {
    firstName: string
    lastName: string
  }
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: any; className: string }> = {
    PENDING: { variant: 'default', className: 'bg-blue-100 text-blue-800' },
    SENDING: { variant: 'default', className: 'bg-yellow-100 text-yellow-800' },
    SENT: { variant: 'default', className: 'bg-green-100 text-green-800' },
    CANCELED: { variant: 'default', className: 'bg-gray-100 text-gray-800' },
    FAILED: { variant: 'default', className: 'bg-red-100 text-red-800' },
  }
  const config = variants[status] || variants.PENDING
  return <Badge variant={config.variant} className={config.className}>{status}</Badge>
}

const getChannelIcon = (channel: string) => {
  if (channel === 'EMAIL') {
    return <Mail className="h-4 w-4 text-purple-600" />
  }
  return <MessageSquare className="h-4 w-4 text-blue-600" />
}

export default function ContactScheduledMessages({ contactId }: ContactScheduledMessagesProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [reschedulingMessage, setReschedulingMessage] = useState<ScheduledMessage | null>(null)
  const [newScheduleDate, setNewScheduleDate] = useState('')
  const [newScheduleTime, setNewScheduleTime] = useState('')
  const [isRescheduling, setIsRescheduling] = useState(false)

  const fetchMessages = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/scheduled-messages?contactId=${contactId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.data || [])
      } else {
        setError('Failed to fetch scheduled messages')
      }
    } catch (err) {
      setError('Error fetching scheduled messages')
      console.error('Error fetching scheduled messages:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [contactId])

  const handleCancel = async (messageId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled message?')) {
      return
    }

    setCancelingId(messageId)
    try {
      const response = await fetch(`/api/scheduled-messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELED' }),
      })

      if (response.ok) {
        toast.success('Scheduled message canceled')
        fetchMessages()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to cancel message')
      }
    } catch (error) {
      console.error('Error canceling message:', error)
      toast.error('Failed to cancel message')
    } finally {
      setCancelingId(null)
    }
  }

  const openRescheduleDialog = (message: ScheduledMessage) => {
    setReschedulingMessage(message)
    const scheduledDate = new Date(message.scheduledAt)
    setNewScheduleDate(format(scheduledDate, 'yyyy-MM-dd'))
    setNewScheduleTime(format(scheduledDate, 'HH:mm'))
  }

  const handleReschedule = async () => {
    if (!reschedulingMessage) return

    const [year, month, day] = newScheduleDate.split('-').map(Number)
    const [hours, minutes] = newScheduleTime.split(':').map(Number)
    const newScheduledAt = new Date(year, month - 1, day, hours, minutes)

    // Validate it's at least 1 minute in the future
    const minTime = new Date(Date.now() + 60 * 1000)
    if (newScheduledAt < minTime) {
      toast.error('Scheduled time must be at least 1 minute in the future')
      return
    }

    setIsRescheduling(true)
    try {
      const response = await fetch(`/api/scheduled-messages/${reschedulingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newScheduledAt.toISOString() }),
      })

      if (response.ok) {
        toast.success('Message rescheduled successfully')
        setReschedulingMessage(null)
        fetchMessages()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to reschedule message')
      }
    } catch (error) {
      console.error('Error rescheduling message:', error)
      toast.error('Failed to reschedule message')
    } finally {
      setIsRescheduling(false)
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Scheduled Messages</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchMessages}>
            <Clock className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex-1 pt-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading scheduled messages...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{error}</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No scheduled messages for this contact.</p>
              <p className="text-sm mt-1">Use the Schedule Send option when composing SMS or Email.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(message.channel)}
                        <span className="font-medium">{message.channel}</span>
                        {getStatusBadge(message.status)}
                      </div>
                      {message.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRescheduleDialog(message)}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            Reschedule
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(message.id)}
                            disabled={cancelingId === message.id}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-3 w-3 mr-1" />
                            {cancelingId === message.id ? 'Canceling...' : 'Cancel'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">Scheduled:</span>
                        <span>{format(new Date(message.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>

                      {message.channel === 'SMS' && (
                        <>
                          {message.fromNumber && (
                            <div className="text-gray-600">
                              <span className="font-medium">From:</span> {message.fromNumber}
                            </div>
                          )}
                          <div className="text-gray-600">
                            <span className="font-medium">To:</span> {message.toNumber}
                          </div>
                        </>
                      )}

                      {message.channel === 'EMAIL' && (
                        <>
                          {message.fromEmail && (
                            <div className="text-gray-600">
                              <span className="font-medium">From:</span> {message.fromEmail}
                            </div>
                          )}
                          <div className="text-gray-600">
                            <span className="font-medium">To:</span> {message.toEmail}
                          </div>
                          {message.subject && (
                            <div className="text-gray-600">
                              <span className="font-medium">Subject:</span> {message.subject}
                            </div>
                          )}
                        </>
                      )}

                      {message.sentAt && (
                        <div className="text-green-600">
                          <span className="font-medium">Sent:</span> {format(new Date(message.sentAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      )}

                      {message.failedAt && (
                        <div className="text-red-600 flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 mt-0.5" />
                          <div>
                            <span className="font-medium">Failed:</span> {format(new Date(message.failedAt), "MMM d, yyyy 'at' h:mm a")}
                            {message.errorMessage && (
                              <div className="text-xs mt-1">{message.errorMessage}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Message body preview */}
                    <div className="bg-gray-50 rounded p-2 text-sm text-gray-700">
                      <p className="line-clamp-3">{message.body.replace(/<[^>]*>/g, '')}</p>
                    </div>

                    {/* Created by */}
                    {message.createdBy && (
                      <div className="text-xs text-gray-500">
                        Created by {message.createdBy.firstName} {message.createdBy.lastName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={!!reschedulingMessage} onOpenChange={(open) => !open && setReschedulingMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Message</DialogTitle>
            <DialogDescription>
              Choose a new date and time for this scheduled message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reschedule-time">Time</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={newScheduleTime}
                onChange={(e) => setNewScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedulingMessage(null)} disabled={isRescheduling}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={isRescheduling}>
              {isRescheduling ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

