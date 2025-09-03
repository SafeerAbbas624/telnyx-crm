"use client"

import React, { useState, useEffect } from "react"
import ConversationsList from "@/components/conversations-list"
import MessageThread from "@/components/message-thread"
import { getActiveConversations } from "@/lib/mock-data"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Conversation, Contact } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export default function MessagingInterface() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState(getActiveConversations())
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [showConversations, setShowConversations] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // On first load, select the first conversation
    if (conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0])
    }
  }, [conversations, selectedConversation])

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    if (isMobile) {
      setShowConversations(false)
    }
  }

  const handleSendMessage = (text: string) => {
    if (!selectedConversation) return

    const newMessage = {
      id: `msg-${Date.now()}`,
      text,
      timestamp: new Date().toISOString(),
      isInbound: false,
    }

    // Add message to the selected conversation
    const updatedConversations = conversations.map((conv) => {
      if (conv.id === selectedConversation.id) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: text,
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
        }
      }
      return conv
    })

    setConversations(updatedConversations)
    setSelectedConversation({
      ...selectedConversation,
      messages: [...selectedConversation.messages, newMessage],
      lastMessage: text,
      lastMessageTime: new Date().toISOString(),
    })
  }

  const handleCallContact = (phoneNumber: string) => {
    toast({
      title: "Initiating call",
      description: `Calling ${phoneNumber}...`,
    })
  }

  const handleNewMessage = (phoneNumber: string, name: string, message: string, propertyDetails: Record<string, unknown>) => {
    // Create a new contact
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      name: name || "Unknown",
      phoneNumber: phoneNumber,
      propertyAddress: propertyDetails.propertyAddress || "",
      cityState: propertyDetails.cityState || "",
      propertyType: propertyDetails.propertyType || "",
      llcName: propertyDetails.llcName || "",
    }

    // Create a new conversation with the initial message
    const initialMessage = {
      id: `msg-${Date.now()}`,
      text: message,
      timestamp: new Date().toISOString(),
      isInbound: false,
      isInitial: true,
    }

    const newConversation: Conversation = {
      id: `conv-${Date.now()}`,
      contact: newContact,
      messages: [initialMessage],
      lastMessage: message,
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      hasReplied: false,
    }

    setConversations([newConversation, ...conversations])
    setSelectedConversation(newConversation)
  }

  const toggleView = () => {
    setShowConversations(!showConversations)
  }

  // Simple layout with two columns
  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r border-gray-200">
        <ConversationsList
          conversations={conversations}
          selectedConversationId={selectedConversation?.id}
          onSelectConversation={handleSelectConversation}
          onNewMessage={handleNewMessage}
        />
      </div>
      <div className="w-2/3">
        {selectedConversation ? (
          <MessageThread
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            onCallContact={handleCallContact}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  )
}
