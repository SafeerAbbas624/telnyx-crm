"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, LogOut } from "lucide-react"
import type { Conversation } from "@/lib/types"
import { formatRelativeTime } from "@/lib/utils"
import { useRouter } from "next/navigation"
import NewMessageDialog from "./new-message-dialog"

type ConversationsListProps = {
  conversations: Conversation[]
  selectedConversationId: string | undefined
  onSelectConversation: (conversation: Conversation) => void
  onNewMessage: (phoneNumber: string, name: string, message: string, propertyDetails: Record<string, unknown>) => void
}

export default function ConversationsList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewMessage,
}: ConversationsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false)
  const router = useRouter()

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conversation) => {
    // Only include conversations with replies
    if (!conversation.hasReplied) return false

    const searchLower = searchQuery.toLowerCase()

    // Search in contact details
    const contactMatches =
      conversation.contact.name.toLowerCase().includes(searchLower) ||
      conversation.contact.phoneNumber.includes(searchLower) ||
      (conversation.contact.propertyAddress?.toLowerCase() || "").includes(searchLower) ||
      (conversation.contact.cityState?.toLowerCase() || "").includes(searchLower) ||
      (conversation.contact.propertyType?.toLowerCase() || "").includes(searchLower) ||
      (conversation.contact.llcName?.toLowerCase() || "").includes(searchLower)

    // Search in message content
    const messageMatches = conversation.messages.some((msg) => msg.text.toLowerCase().includes(searchLower))

    return contactMatches || messageMatches
  })

  const handleSignOut = () => {
    router.push("/")
  }

  const handleNewMessage = (contact: { phoneNumber: string; name: string; propertyAddress: string; cityState: string; propertyType: string; equity: number }, message: string) => {
    onNewMessage(contact.phoneNumber, contact.name, message, {
      propertyAddress: contact.propertyAddress,
      cityState: contact.cityState,
      propertyType: contact.propertyType,
      llcName: contact.llcName,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-bold">Messages</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="New Conversation" onClick={() => setShowNewMessageDialog(true)}>
            <Plus size={18} />
          </Button>
          <Button variant="ghost" size="icon" title="Sign Out" onClick={handleSignOut}>
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages and contacts..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No conversations found</div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                conversation.id === selectedConversationId ? "bg-accent" : ""
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              <Avatar>
                <AvatarImage src={conversation.contact.avatarUrl} alt={conversation.contact.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {conversation.contact.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium truncate">{conversation.contact.name}</h3>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {formatRelativeTime(conversation.lastMessageTime)}
                  </span>
                </div>

                <div className="flex justify-between items-center mt-0.5">
                  <p className="text-sm text-muted-foreground truncate">{conversation.contact.propertyAddress}</p>

                  {conversation.unreadCount > 0 && (
                    <span className="ml-2 flex-shrink-0 rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <NewMessageDialog
        open={showNewMessageDialog}
        onOpenChange={setShowNewMessageDialog}
        onSendMessage={handleNewMessage}
      />
    </div>
  )
}
