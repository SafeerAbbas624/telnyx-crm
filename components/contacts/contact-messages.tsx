"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { PlusCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useRouter } from "next/navigation"
import type { Message } from "@/lib/types"

interface ContactMessagesProps {
  contactId: string
}

const getMessageIcon = (direction: string) => {
  if (direction === "inbound") {
    return <ArrowDownLeft className="h-4 w-4 text-green-500" />
  }
  return <ArrowUpRight className="h-4 w-4 text-blue-500" />
}

export default function ContactMessages({ contactId }: ContactMessagesProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/messages?contactId=${contactId}`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data)
        } else {
          setError('Failed to fetch messages')
        }
      } catch (err) {
        setError('Error fetching messages')
        console.error('Error fetching messages:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [contactId])

  // Now using real data from API

  const handleSendMessage = () => {
    // Navigate to messaging section with this contact selected
    router.push(`/dashboard?section=messaging&contactId=${contactId}`)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Messages</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleSendMessage}>
          <PlusCircle className="h-4 w-4 mr-2" /> Send Message
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading messages...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No messages found for this contact.</div>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)]">
            {" "}
            {/* Adjust height as needed */}
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3 p-3 border rounded-md">
                  <div className="flex-shrink-0 mt-1">{getMessageIcon(message.direction)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium capitalize">
                        {message.direction} Message {message.status && `(${message.status})`}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(message.timestamp || message.createdAt), "MMM dd, yyyy hh:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{message.content || message.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
