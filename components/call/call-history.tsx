"use client"

import { calls, getContactById } from "@/lib/mock-data"
import { formatDistanceToNow, format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Phone, PhoneOff, VoicemailIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function CallHistory() {
  const [searchQuery, setSearchQuery] = useState("")

  // Sort calls by timestamp (newest first)
  const sortedCalls = [...calls].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Filter calls based on search query
  const filteredCalls = sortedCalls.filter((call) => {
    const contact = getContactById(call.contactId)
    if (!contact) return false

    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      (contact.phone1 && contact.phone1.includes(searchQuery)) ||
      (call.notes && call.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "0:00"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-6">
        <Input
          placeholder="Search call history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline">Export</Button>
      </div>

      {filteredCalls.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No call history found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCalls.map((call) => {
            const contact = getContactById(call.contactId)
            if (!contact) return null

            return (
              <div key={call.id} className="border rounded-md p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    {call.status === "completed" && <Phone size={18} className="text-green-500 mr-2" />}
                    {call.status === "no_answer" && <PhoneOff size={18} className="text-red-500 mr-2" />}
                    {call.status === "voicemail" && <VoicemailIcon size={18} className="text-amber-500 mr-2" />}
                    <span className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </span>
                  </div>
                  <Badge
                    className={`
                      ${call.status === "completed" ? "bg-green-100 text-green-800 border-green-200" : ""}
                      ${call.status === "no_answer" ? "bg-red-100 text-red-800 border-red-200" : ""}
                      ${call.status === "voicemail" ? "bg-amber-100 text-amber-800 border-amber-200" : ""}
                      ${call.status === "in_progress" ? "bg-blue-100 text-blue-800 border-blue-200" : ""}
                    `}
                  >
                    {call.status?.replace("_", " ") || "Unknown"}
                  </Badge>
                </div>

                <div className="flex justify-between text-sm text-gray-500 mb-3">
                  <span>{contact.phone1}</span>
                  <span>{format(new Date(call.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>

                <div className="flex justify-between text-sm text-gray-500 mb-3">
                  <span>Duration: {formatDuration(call.duration)}</span>
                  <span>{formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}</span>
                </div>

                {call.notes && (
                  <div className="bg-gray-50 p-3 rounded-md">
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
