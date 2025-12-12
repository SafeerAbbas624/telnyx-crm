"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, PlusCircle, Mic, Phone } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { useMakeCall } from "@/hooks/use-make-call"
import type { Call } from "@/lib/types"

interface ContactCallsProps {
  contactId: string
}

const getCallIcon = (direction: string, status: string) => {
  if (status === "failed" || status === "missed") {
    return <PhoneMissed className="h-4 w-4 text-red-500" />
  }
  if (direction === "inbound") {
    return <PhoneIncoming className="h-4 w-4 text-green-500" />
  }
  return <PhoneOutgoing className="h-4 w-4 text-blue-500" />
}

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

export default function ContactCalls({ contactId }: ContactCallsProps) {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const { toast } = useToast()
  const { makeCall } = useMakeCall()

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/calls?contactId=${contactId}`)
        if (response.ok) {
          const data = await response.json()
          setCalls(data)
        } else {
          setError('Failed to fetch calls')
        }
      } catch (err) {
        setError('Error fetching calls')
        console.error('Error fetching calls:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCalls()
  }, [contactId])

  // Now using real data from API

  const handleLogCall = async () => {
    try {
      // Get contact info to find phone number
      const contactResponse = await fetch(`/api/contacts/${contactId}`)
      if (!contactResponse.ok) {
        toast({
          title: "Error",
          description: "Could not find contact information",
          variant: "destructive",
        })
        return
      }

      const contact = await contactResponse.json()
      const phoneNumber = contact.phone1 || contact.phone2 || contact.phone3

      if (!phoneNumber) {
        toast({
          title: "No Phone Number",
          description: "This contact doesn't have a phone number.",
          variant: "destructive",
        })
        return
      }

      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      await makeCall({
        phoneNumber,
        contactId: contact.id,
        contactName,
      })
    } catch (error: any) {
      console.error('Error starting call:', error)
      toast({
        title: "Error",
        description: error?.message || "Failed to start call",
        variant: "destructive",
      })
    }
  }

  const handleActivityAdded = () => {
    // Refresh calls data after activity is added
    const fetchCalls = async () => {
      try {
        const response = await fetch(`/api/calls?contactId=${contactId}`)
        if (response.ok) {
          const data = await response.json()
          setCalls(data)
        }
      } catch (err) {
        console.error('Error refreshing calls:', err)
      }
    }
    fetchCalls()
  }

  return (
    <>
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Calls</CardTitle>
        <Button variant="default" size="sm" onClick={handleLogCall} className="bg-green-600 hover:bg-green-700">
          <Phone className="h-4 w-4 mr-2" /> Call
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading calls...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : calls.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No calls found for this contact.</div>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4">
              {calls.map((call) => (
                <div key={call.id} className="flex items-start space-x-3 p-3 border rounded-md">
                  <div className="flex-shrink-0 mt-1">{getCallIcon(call.direction, call.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium capitalize">
                        {call.direction} Call ({call.status})
                      </h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(call.timestamp || call.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    {call.duration > 0 && (
                      <p className="text-sm text-gray-600 mt-1">Duration: {formatDuration(call.duration)}</p>
                    )}
                    {call.notes && <p className="text-sm text-gray-600 mt-1">Notes: {call.notes}</p>}
                    {call.recordingUrl && (
                      <Button variant="ghost" size="sm" className="mt-2">
                        <Mic className="h-4 w-4 mr-2" /> Listen to Recording
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>

  </>
  )
}
