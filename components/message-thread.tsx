"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, Info, Send, Home, MapPin, Building } from "lucide-react"
import type { Conversation, Message } from "@/lib/types"
import { formatMessageTime } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import ContactDetailsDialog from "./contact-details-dialog"

type MessageThreadProps = {
  conversation: Conversation
  onSendMessage: (text: string) => void
  onCallContact: (phoneNumber: string) => void
}

export default function MessageThread({ conversation, onSendMessage, onCallContact }: MessageThreadProps) {
  const [messageText, setMessageText] = useState("")
  const [showContactDetails, setShowContactDetails] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialMessage = conversation.messages.find((msg) => msg.isInitial)
  const regularMessages = conversation.messages.filter((msg) => !msg.isInitial)

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom()
  }, [conversation.messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (messageText.trim()) {
      onSendMessage(messageText.trim())
      setMessageText("")
    }
  }

  const handleCall = () => {
    onCallContact(conversation.contact.phoneNumber)
  }

  const renderPropertyDetails = () => {
    const { contact } = conversation

    return (
      <Card className="mb-4 bg-accent/30">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{contact.name}</h3>
              <span className="text-sm text-muted-foreground">{contact.phoneNumber}</span>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Home className="h-4 w-4 mt-1 text-primary" />
                <div>
                  <p className="font-medium">Property Address</p>
                  <p className="text-sm text-muted-foreground">{contact.propertyAddress}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-primary" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{contact.cityState}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-1 text-primary" />
                <div>
                  <p className="font-medium">Property Type</p>
                  <p className="text-sm text-muted-foreground">{contact.propertyType}</p>
                </div>
              </div>

              {contact.llcName && (
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-1 text-primary" />
                  <div>
                    <p className="font-medium">LLC Name</p>
                    <p className="text-sm text-muted-foreground">{contact.llcName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderInitialMessage = () => {
    if (!initialMessage) return null

    return (
      <div className="mb-6 border border-border rounded-lg p-4 bg-accent/20">
        <div className="text-sm text-muted-foreground mb-1">
          Initial message sent {formatMessageTime(initialMessage.timestamp)}
        </div>
        <div className="text-foreground">{initialMessage.text}</div>
      </div>
    )
  }

  const renderMessages = () => {
    const messageGroups: Message[][] = []
    let currentGroup: Message[] = []
    let lastSender: boolean | null = null

    regularMessages.forEach((message) => {
      // If this is the first message or sender changed
      if (lastSender === null || lastSender !== message.isInbound) {
        if (currentGroup.length > 0) {
          messageGroups.push([...currentGroup])
          currentGroup = []
        }
        lastSender = message.isInbound
      }

      currentGroup.push(message)
    })

    // Add the last group
    if (currentGroup.length > 0) {
      messageGroups.push(currentGroup)
    }

    return messageGroups.map((group, groupIndex) => {
      const isInbound = group[0].isInbound

      return (
        <div key={`group-${groupIndex}`} className={`flex ${isInbound ? "justify-start" : "justify-end"} mb-4`}>
          {isInbound && (
            <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
              <AvatarImage src={conversation.contact.avatarUrl} alt={conversation.contact.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {conversation.contact.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}

          <div className={`flex flex-col ${isInbound ? "items-start" : "items-end"} max-w-[75%]`}>
            {group.map((message, messageIndex) => (
              <div key={message.id} className={`flex flex-col ${messageIndex === 0 ? "mt-0" : "mt-1"}`}>
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    isInbound
                      ? "bg-accent text-accent-foreground rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  }`}
                >
                  {message.text}
                </div>

                {messageIndex === group.length - 1 && (
                  <div className={`text-xs text-muted-foreground mt-1 ${isInbound ? "text-left" : "text-right"}`}>
                    {formatMessageTime(message.timestamp)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center">
          <Avatar className="h-10 w-10 mr-3">
            <AvatarImage src={conversation.contact.avatarUrl} alt={conversation.contact.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {conversation.contact.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div>
            <h2 className="font-medium">{conversation.contact.name}</h2>
            <p className="text-sm text-muted-foreground">{conversation.contact.propertyAddress}</p>
          </div>
        </div>

        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" title="Call" onClick={handleCall}>
            <Phone size={18} />
          </Button>
          <Button variant="ghost" size="icon" title="Contact Details" onClick={() => setShowContactDetails(true)}>
            <Info size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {renderPropertyDetails()}
        {renderInitialMessage()}
        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!messageText.trim()} title="Send message">
            <Send size={18} />
          </Button>
        </form>
      </div>

      <ContactDetailsDialog
        contact={conversation.contact}
        open={showContactDetails}
        onOpenChange={setShowContactDetails}
      />
    </div>
  )
}
