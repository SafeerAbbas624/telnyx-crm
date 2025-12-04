"use client"

import { formatDistanceToNow, format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, VoicemailIcon, Loader2, Play, Pause } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import Link from "next/link"

interface CallRecord {
  id: string
  direction: 'inbound' | 'outbound'
  status: string
  duration: number
  createdAt: string
  fromNumber: string
  toNumber: string
  recordingUrl?: string | null
  notes?: string | null
  contactId?: string | null
  contact?: {
    id: string
    firstName: string | null
    lastName: string | null
    phone1: string | null
  } | null
}

export default function CallHistory() {
  const [searchQuery, setSearchQuery] = useState("")
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchCalls()
  }, [searchQuery])

  const fetchCalls = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      params.set('limit', '100')

      const res = await fetch(`/api/calls?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch calls')

      const data = await res.json()
      setCalls(data.calls || [])
    } catch (err) {
      console.error('Error fetching calls:', err)
      setError('Failed to load call history')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return "0:00"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
      case 'answered':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'no_answer':
      case 'missed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'voicemail':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'initiated':
      case 'ringing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCallIcon = (direction: string, status: string) => {
    if (status === 'no_answer' || status === 'missed') {
      return <PhoneOff size={18} className="text-red-500 mr-2" />
    }
    if (status === 'voicemail') {
      return <VoicemailIcon size={18} className="text-amber-500 mr-2" />
    }
    if (direction === 'inbound') {
      return <PhoneIncoming size={18} className="text-blue-500 mr-2" />
    }
    return <PhoneOutgoing size={18} className="text-green-500 mr-2" />
  }

  const togglePlayRecording = (callId: string, url: string) => {
    if (playingId === callId) {
      audioRef.current?.pause()
      setPlayingId(null)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      audioRef.current = new Audio(url)
      audioRef.current.play()
      audioRef.current.onended = () => setPlayingId(null)
      setPlayingId(callId)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-6">
        <Input
          placeholder="Search by phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" onClick={fetchCalls}>Refresh</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading calls...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          <p>{error}</p>
          <Button variant="outline" onClick={fetchCalls} className="mt-2">Retry</Button>
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No call history found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => {
            const contactName = call.contact
              ? `${call.contact.firstName || ''} ${call.contact.lastName || ''}`.trim() || 'Unknown'
              : 'Unknown Contact'
            const phoneNumber = call.direction === 'inbound' ? call.fromNumber : call.toNumber

            return (
              <div key={call.id} className="border rounded-md p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    {getCallIcon(call.direction, call.status)}
                    {call.contact?.id ? (
                      <Link href={`/contacts/${call.contact.id}`} className="font-medium hover:underline text-blue-600">
                        {contactName}
                      </Link>
                    ) : (
                      <span className="font-medium">{contactName}</span>
                    )}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {call.direction}
                    </Badge>
                  </div>
                  <Badge className={getStatusBadgeClass(call.status)}>
                    {call.status?.replace("_", " ") || "Unknown"}
                  </Badge>
                </div>

                <div className="flex justify-between text-sm text-gray-500 mb-3">
                  <span>{formatPhoneNumberForDisplay(phoneNumber)}</span>
                  <span>{format(new Date(call.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Duration: {formatDuration(call.duration)}</span>
                  <div className="flex items-center gap-2">
                    {call.recordingUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePlayRecording(call.id, call.recordingUrl!)}
                        className="h-7 px-2"
                      >
                        {playingId === call.id ? (
                          <><Pause className="h-4 w-4 mr-1" /> Pause</>
                        ) : (
                          <><Play className="h-4 w-4 mr-1" /> Play Recording</>
                        )}
                      </Button>
                    )}
                    <span>{formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>

                {call.notes && (
                  <div className="bg-gray-50 p-3 rounded-md mt-3">
                    <p className="text-sm">{call.notes}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
