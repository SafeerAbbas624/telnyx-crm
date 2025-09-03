"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, PhoneOff, Mail, Clock, User, Home, DollarSign, Tag } from "lucide-react"
import { format } from "date-fns"
import { useActivities } from "@/lib/context/activities-context"
import type { Contact } from "@/lib/types"

interface CallInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  onEndCall?: () => void
}

export function CallInfoDialog({ open, onOpenChange, contact, onEndCall }: CallInfoDialogProps) {
  const [callDuration, setCallDuration] = useState(0)
  const [isCallActive, setIsCallActive] = useState(false)
  const [callNotes, setCallNotes] = useState("")
  const [activeTab, setActiveTab] = useState("info")
  const { activities, addActivity } = useActivities()

  // Start timer when dialog opens
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (open && isCallActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [open, isCallActive])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCallDuration(0)
      setIsCallActive(true)
      setCallNotes("")
    }
  }, [open])

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Get recent activities for this contact
  const contactActivities = contact
    ? activities
        .filter((activity) => activity.contactId === contact.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    : []

  const handleEndCall = () => {
    setIsCallActive(false)

    // Save call as an activity
    if (contact) {
      addActivity({
        id: `call-${Date.now()}`,
        contactId: contact.id,
        type: "call",
        title: `Call with ${contact.firstName} ${contact.lastName}`,
        description: `${callNotes || "No notes added"} (Duration: ${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')})`,
        status: "completed",
        createdAt: new Date().toISOString(),
        dueDate: new Date().toISOString(),
      })
    }

    if (onEndCall) onEndCall()
  }

  if (!contact) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              Call with {contact.firstName} {contact.lastName}
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant={isCallActive ? "default" : "outline"}
                className={isCallActive ? "bg-green-100 text-green-800 border-green-200" : ""}
              >
                {isCallActive ? "Active Call" : "Call Ended"}
              </Badge>
              <span className="text-sm font-normal">{formatDuration(callDuration)}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="info">Contact Info</TabsTrigger>
            <TabsTrigger value="history">Recent Activity</TabsTrigger>
            <TabsTrigger value="notes">Call Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 overflow-auto">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <User size={14} />
                      <span>Name</span>
                    </div>
                    <div className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone size={14} />
                      <span>Phone</span>
                    </div>
                    <div className="font-medium">{contact.phone1}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail size={14} />
                      <span>Email</span>
                    </div>
                    <div className="font-medium">{contact.email1}</div>
                  </div>

                  {contact.propertyAddress && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Home size={14} />
                        <span>Property Address</span>
                      </div>
                      <div className="font-medium">{contact.propertyAddress}</div>
                    </div>
                  )}

                  {contact.propertyType && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Home size={14} />
                        <span>Property Type</span>
                      </div>
                      <div className="font-medium">{contact.propertyType}</div>
                    </div>
                  )}

                  {contact.propertyValue && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <DollarSign size={14} />
                        <span>Property Value</span>
                      </div>
                      <div className="font-medium">${(contact.propertyValue / 1000).toFixed(0)}k</div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Tag size={14} />
                    <span>Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags?.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          border: `1px solid ${tag.color}40`,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {contact.dnc && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                    <strong>Warning:</strong> This contact is marked as Do Not Contact.
                    {contact.dncReason && <div className="mt-1">Reason: {contact.dncReason}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-auto">
            <ScrollArea className="h-[300px]">
              {contactActivities.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No recent activities found for this contact.
                </div>
              ) : (
                <div className="space-y-3">
                  {contactActivities.map((activity) => (
                    <Card key={activity.id}>
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{activity.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock size={12} />
                                {format(new Date(activity.createdAt), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-2">{activity.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <Textarea
                placeholder="Add notes about this call..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                These notes will be saved with the call record when the call ends.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="destructive"
            className="flex items-center gap-2"
            onClick={handleEndCall}
            disabled={!isCallActive}
          >
            <PhoneOff size={16} />
            End Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
