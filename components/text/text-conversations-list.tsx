"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Plus, LogOut, Phone, PhoneOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useCallUI } from "@/lib/context/call-ui-context"
import type { Contact } from "@/lib/types"

interface TextConversationsListProps {
  contacts: Contact[]
  selectedContactId?: string
  onSelectContact: (contact: Contact) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export default function TextConversationsList({
  contacts,
  selectedContactId,
  onSelectContact,
  searchQuery,
  setSearchQuery,
}: TextConversationsListProps) {
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false)
  const [activeCall, setActiveCall] = useState<{ contactId: string; duration: number } | null>(null)
  const [callTimerId, setCallTimerId] = useState<NodeJS.Timeout | null>(null)
  const { toast } = useToast()
  const { openCall } = useCallUI()

  const handleStartCall = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const contact = contacts.find(c => c.id === contactId)
      if (!contact) return
      const toNumber = (contact as any).phone1 || (contact as any).phone2 || (contact as any).phone3 || (contact as any).phone
      if (!toNumber) {
        toast({ title: "No phone", description: "This contact has no phone number.", variant: "destructive" })
        return
      }
      const numbersRes = await fetch('/api/telnyx/phone-numbers')
      if (!numbersRes.ok) throw new Error('Failed to load phone numbers')
      const numbersData = await numbersRes.json()
      const fromNumber = (numbersData.phoneNumbers?.[0]?.phoneNumber) || numbersData?.[0]?.phoneNumber
      if (!fromNumber) throw new Error('No Telnyx phone numbers available')

      // Try WebRTC first
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.ensureRegistered()
        const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber })
        openCall({
          contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
          fromNumber,
          toNumber,
          mode: 'webrtc',
          webrtcSessionId: sessionId,
        })
        toast({ title: 'Calling (WebRTC)', description: `Calling ${contact.firstName} ${contact.lastName}` })
        return
      } catch (webrtcErr) {
        console.warn('WebRTC attempt failed, falling back to Call Control:', webrtcErr)
      }

      const callRes = await fetch('/api/telnyx/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromNumber, toNumber, contactId })
      })
      if (!callRes.ok) throw new Error('Failed to initiate call')
      const data = await callRes.json()
      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber,
        toNumber,
        mode: 'call_control',
        telnyxCallId: data.telnyxCallId,
      })
      toast({ title: 'Call started', description: `Calling ${contact.firstName} ${contact.lastName}` })
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to start call', variant: 'destructive' })
    }
  }

  const handleEndCall = async (e: React.MouseEvent) => {
    e.stopPropagation()
    // This list UI no longer ends calls directly; actions are in the global popup.
    toast({ title: 'Open call popup', description: 'Use the call popup to end the call.' })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search conversations..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button size="icon" onClick={() => setShowNewMessageDialog(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No conversations found</p>
          </div>
        ) : (
          <div>
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedContactId === contact.id ? "bg-primary/5" : ""
                }`}
                onClick={() => onSelectContact(contact)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {contact.firstName[0]}
                      {contact.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium truncate">
                        {contact.firstName} {contact.lastName}
                      </h3>
                      <div className="flex items-center gap-1">
                        {activeCall && activeCall.contactId === contact.id ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 flex items-center gap-1"
                            onClick={(e) => handleEndCall(e)}
                          >
                            <PhoneOff className="h-3 w-3" />
                            <span>{formatDuration(activeCall.duration)}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => handleStartCall(contact.id, e)}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 truncate">{contact.phone}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t mt-auto">
        <Button variant="outline" className="w-full" size="sm">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* New Message Dialog */}
      <Dialog open={showNewMessageDialog} onOpenChange={setShowNewMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Select a contact to start a new conversation</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMessageDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
