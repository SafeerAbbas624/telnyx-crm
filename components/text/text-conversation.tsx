"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Phone, Mail, Info, Send, PhoneOff, Clock, MessageSquare, Paperclip, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useActivities } from "@/lib/context/activities-context"
import { formatDistanceToNow } from "date-fns"
import type { Contact } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { templates } from "@/lib/mock-templates"

import ContactName from "@/components/contacts/contact-name"

// Mock messages for demo
const mockMessages = [
  {
    id: "1",
    text: "Hi there! I noticed your property at 123 Main St. Would you be interested in discussing refinancing options?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    isInbound: false,
  },
  {
    id: "2",
    text: "I might be interested. What rates are you offering?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isInbound: true,
  },
  {
    id: "3",
    text: "We currently have rates as low as 3.5% for qualified borrowers. Would you like to schedule a call to discuss further?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    isInbound: false,
  },
]

interface TextConversationProps {
  contact: Contact
  onBack?: () => void
}

export default function TextConversation({ contact, onBack }: TextConversationProps) {
  const [messages, setMessages] = useState(mockMessages)
  const [newMessage, setNewMessage] = useState("")
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [showCallInfo, setShowCallInfo] = useState(false)
  const [callNotes, setCallNotes] = useState("")
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { activities } = useActivities()

  // Get recent activities for this contact
  const contactActivities = activities
    .filter((activity) => activity.contactId === contact.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  // Timer for call duration
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    if (isCallActive) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      setCallDuration(0)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isCallActive])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = () => {
    if (!newMessage.trim()) return

    const newMsg = {
      id: `msg-${Date.now()}`,
      text: newMessage,
      timestamp: new Date().toISOString(),
      isInbound: false,
    }

    setMessages([...messages, newMsg])
    setNewMessage("")

    toast({
      title: "Message sent",
      description: "Your message has been sent successfully",
    })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString()
  }

  const handleInitiateCall = () => {
    setIsCallActive(true)
    setShowCallInfo(true)

    toast({
      title: "Call initiated",
      description: `Calling ${contact.firstName} ${contact.lastName}...`,
    })
  }

  const handleEndCall = () => {
    setIsCallActive(false)

    toast({
      title: "Call ended",
      description: `Call duration: ${formatDuration(callDuration)}`,
    })
  }

  const handleSaveCallNotes = () => {
    toast({
      title: "Call notes saved",
      description: "Your call notes have been saved successfully",
    })
    setShowCallInfo(false)
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const handleEmailClick = () => {
    // Open email dialog
    setEmailSubject("")
    setEmailBody("")
    setAttachments([])
    setShowEmailDialog(true)
  }

  const handleSendEmail = () => {
    if (!emailSubject.trim() || !emailBody.trim()) return

    // In a real app, this would send the email
    console.log("Sending email:", {
      to: contact.email,
      subject: emailSubject,
      body: emailBody,
      attachments,
    })

    toast({
      title: "Email sent",
      description: `Email sent to ${contact.firstName} ${contact.lastName}`,
    })

    setShowEmailDialog(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setAttachments([...attachments, ...newFiles])
    }
  }

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...attachments]
    newAttachments.splice(index, 1)
    setAttachments(newAttachments)
  }

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return

    setEmailSubject(template.subject || emailSubject)

    let templateBody = template.content

    // Replace dynamic fields
    templateBody = templateBody
      .replace(/\[firstName\]/g, contact.firstName || "")
      .replace(/\[lastName\]/g, contact.lastName || "")
      .replace(/\[fullName\]/g, `${contact.firstName || ""} ${contact.lastName || ""}`.trim())
      .replace(/\[email\]/g, contact.email || "")
      .replace(/\[phone\]/g, contact.phone || "")
      .replace(/\[propertyAddress\]/g, contact.propertyAddress || "")
      .replace(/\[propertyType\]/g, contact.propertyType || "")

    setEmailBody(templateBody)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4 text-green-500" />
      case "meeting":
        return <Clock className="h-4 w-4 text-purple-500" />
      case "email":
        return <Mail className="h-4 w-4 text-blue-500" />
      case "text":
        return <MessageSquare className="h-4 w-4 text-amber-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {contact.firstName ? contact.firstName[0] : "?"}
              {contact.lastName ? contact.lastName[0] : ""}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">
              <ContactName contact={contact as any} clickMode="popup" stopPropagation={false} className="!no-underline underline-offset-2 hover:underline" />
            </h3>
            <p className="text-sm text-gray-500">{contact.phone || "No phone"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isCallActive ? (
            <Button variant="destructive" size="sm" onClick={handleEndCall} className="flex items-center gap-1">
              <PhoneOff className="h-4 w-4" />
              <span>{formatDuration(callDuration)}</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              onClick={handleInitiateCall}
              className={isCallActive ? "bg-green-500 text-white hover:bg-green-600" : ""}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleEmailClick}>
            <Mail className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowContactInfo(true)}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => {
            // Check if we need to show a date separator
            const showDateSeparator =
              index === 0 || formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp)

            return (
              <div key={message.id}>
                {showDateSeparator && (
                  <div className="flex justify-center my-4">
                    <div className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                      {formatDate(message.timestamp)}
                    </div>
                  </div>
                )}
                <div className={`flex ${message.isInbound ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.isInbound ? "bg-gray-100 text-gray-900" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <div
                      className={`text-xs mt-1 ${message.isInbound ? "text-gray-500" : "text-primary-foreground/80"}`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Message input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button className="self-end" size="icon" onClick={handleSendMessage} disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact Info Dialog */}
      <Dialog open={showContactInfo} onOpenChange={setShowContactInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {contact.firstName ? contact.firstName[0] : "?"}
                  {contact.lastName ? contact.lastName[0] : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">
                  {contact.firstName || "Unknown"} {contact.lastName || ""}
                </h3>
                <p className="text-gray-500">{contact.phone || "No phone"}</p>
                <p className="text-gray-500">{contact.email || "No email"}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-1">Property Address</h4>
              <p>{contact.propertyAddress || "No address"}</p>
            </div>

            {contact.propertyType && (
              <div>
                <h4 className="font-medium mb-1">Property Type</h4>
                <p>{contact.propertyType}</p>
              </div>
            )}

            {contact.propertyValue && (
              <div>
                <h4 className="font-medium mb-1">Property Value</h4>
                <p>${contact.propertyValue.toLocaleString()}</p>
              </div>
            )}

            {contact.debtOwed && (
              <div>
                <h4 className="font-medium mb-1">Debt Owed</h4>
                <p>${contact.debtOwed.toLocaleString()}</p>
              </div>
            )}

            {contact.tags && contact.tags.length > 0 && (
              <div>
                <h4 className="font-medium mb-1">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag) => (
                    <div
                      key={typeof tag === "object" ? tag.id : tag}
                      className="px-2 py-1 rounded-full text-xs"
                      style={{
                        backgroundColor: `${typeof tag === "object" ? tag.color : "#6b7280"}20`,
                        color: typeof tag === "object" ? tag.color : "#6b7280",
                        border: `1px solid ${typeof tag === "object" ? tag.color : "#6b7280"}40`,
                      }}
                    >
                      {typeof tag === "object" ? tag.name : tag}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">Recent Activities</h4>
              {contactActivities.length > 0 ? (
                <div className="space-y-2">
                  {contactActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1">
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent activities</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactInfo(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowContactInfo(false)
                window.location.href = `/dashboard?section=contacts&contactId=${contact.id}`
              }}
            >
              View Full Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Info Dialog */}
      <Dialog open={showCallInfo} onOpenChange={setShowCallInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Call with {contact.firstName || "Unknown"} {contact.lastName || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {contact.firstName ? contact.firstName[0] : "?"}
                  {contact.lastName ? contact.lastName[0] : ""}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="text-center">
              <p className="text-lg font-medium">{contact.phone || "No phone"}</p>
              <p className="text-sm text-gray-500">{contact.propertyAddress || "No address"}</p>
            </div>

            <div className="text-center">
              {isCallActive ? (
                <div>
                  <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="font-medium">Call in progress</span>
                  </div>
                  <p className="text-xl font-bold">{formatDuration(callDuration)}</p>
                  <Button variant="destructive" onClick={handleEndCall} className="mt-4">
                    End Call
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 mb-2">Call ended</p>
                  <p className="text-lg font-medium">Duration: {formatDuration(callDuration)}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Recent Activities</h4>
              {contactActivities.length > 0 ? (
                <div className="space-y-2">
                  {contactActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1">
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent activities</p>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Call Notes</h4>
              <Textarea
                placeholder="Enter notes about this call..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallInfo(false)}>
              Close
            </Button>
            <Button onClick={handleSaveCallNotes}>Save Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Send Email to {contact.firstName || "Unknown"} {contact.lastName || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="email-subject">Subject</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate("template-1")}
                    className="text-xs h-7"
                  >
                    Introduction
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate("template-2")}
                    className="text-xs h-7"
                  >
                    Follow-up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate("template-3")}
                    className="text-xs h-7"
                  >
                    Offer
                  </Button>
                </div>
              </div>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Write your email here..."
                className="min-h-[200px]"
              />
            </div>

            {attachments.length > 0 && (
              <div>
                <Label>Attachments</Label>
                <div className="space-y-2 mt-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <Paperclip size={14} className="text-gray-500" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-auto mr-2">{(file.size / 1024).toFixed(0)} KB</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              onChange={handleFileChange}
              ref={fileInputRef}
            />
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={triggerFileUpload} className="mr-auto">
              <Paperclip size={16} className="mr-2" />
              Attach Files
            </Button>
            <div>
              <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="mr-2">
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={!emailSubject.trim() || !emailBody.trim()}>
                <Send size={16} className="mr-2" />
                Send Email
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
