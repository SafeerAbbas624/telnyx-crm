"use client"

import { useActivities } from "@/lib/context/activities-context"
import { useContacts } from "@/lib/context/contacts-context"
import type { Activity } from "@/lib/types"
import { format } from "date-fns"
import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  Clock,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  FileText,
  AlertCircle,
  Paperclip,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ActivityTimelineProps {
  contactId: string
}

export function ActivityTimeline({ contactId }: ActivityTimelineProps) {
  const { activities } = useActivities()
  const { getContactById } = useContacts()

  // Get all activities for this contact
  const contactActivities = activities
    .filter((activity) => activity.contactId === contactId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Get mock data for messages, calls, and emails
  // In a real app, these would come from your backend
  const messages = [
    {
      id: "msg1",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      direction: "incoming",
      content: "Yes, I'm interested in discussing this further. When can we talk?",
    },
    {
      id: "msg2",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      direction: "outgoing",
      content:
        "Hello! I wanted to follow up on our conversation about your property. Are you still interested in our services?",
    },
    {
      id: "msg3",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      direction: "outgoing",
      content:
        "Hi there! I'm reaching out about your property at 123 Main St. We have some options that might interest you.",
    },
  ]

  const calls = [
    {
      id: "call1",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      direction: "outgoing",
      status: "completed",
      duration: 320, // seconds
      notes: "Discussed refinancing options. Client is interested but wants to think it over.",
    },
    {
      id: "call2",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
      direction: "outgoing",
      status: "missed",
      duration: 0,
      notes: "No answer, will try again tomorrow.",
    },
    {
      id: "call3",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
      direction: "incoming",
      status: "completed",
      duration: 180, // seconds
      notes: "Client called to ask about our services. Explained our refinancing options.",
    },
  ]

  const emails = [
    {
      id: "email1",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
      subject: "Property Refinancing Options",
      content:
        "Dear Client,\n\nThank you for your interest in our services. As discussed, here are the refinancing options we offer...\n\nBest regards,\nYour Name",
      attachments: ["proposal.pdf"],
    },
    {
      id: "email2",
      contactId,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), // 4 days ago
      subject: "Introduction to Our Services",
      content:
        "Dear Client,\n\nI hope this email finds you well. I'm reaching out because we specialize in helping property owners like yourself...\n\nLooking forward to your response,\nYour Name",
      attachments: [],
    },
  ]

  // Combine all activities into a single timeline
  const timelineItems = [
    ...contactActivities.map((activity) => ({
      type: "activity",
      data: activity,
      timestamp: new Date(activity.createdAt),
    })),
    ...messages.map((message) => ({
      type: "message",
      data: message,
      timestamp: new Date(message.timestamp),
    })),
    ...calls.map((call) => ({
      type: "call",
      data: call,
      timestamp: new Date(call.timestamp),
    })),
    ...emails.map((email) => ({
      type: "email",
      data: email,
      timestamp: new Date(email.timestamp),
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  // Format duration from seconds to mm:ss
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Get icon for activity type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-5 w-5 text-blue-500" />
      case "meeting":
        return <Calendar className="h-5 w-5 text-purple-500" />
      case "email":
        return <Mail className="h-5 w-5 text-amber-500" />
      case "text":
        return <MessageSquare className="h-5 w-5 text-green-500" />
      case "task":
        return <CheckCircle className="h-5 w-5 text-indigo-500" />
      case "note":
        return <FileText className="h-5 w-5 text-blue-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  // Get icon for call direction and status
  const getCallIcon = (direction: string, status: string) => {
    if (status === "missed") {
      return <PhoneMissed className="h-5 w-5 text-red-500" />
    }

    if (direction === "outgoing") {
      return <PhoneOutgoing className="h-5 w-5 text-blue-500" />
    }

    return <PhoneIncoming className="h-5 w-5 text-green-500" />
  }

  // Get status badge for activity
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>
      case "planned":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Planned</Badge>
      case "in-progress":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">In Progress</Badge>
      case "missed":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Missed</Badge>
      default:
        return null
    }
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4">
        {timelineItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No activity history found for this contact.</div>
        ) : (
          timelineItems.map((item, index) => (
            <div key={`${item.type}-${index}`} className="relative pl-6 border-l-2 border-gray-200 pb-4">
              <div className="absolute -left-[9px] bg-white p-1 rounded-full">
                {item.type === "activity" && getActivityIcon((item.data as Activity).type)}
                {item.type === "message" && <MessageSquare className="h-5 w-5 text-green-500" />}
                {item.type === "call" && getCallIcon((item.data as any).direction, (item.data as any).status)}
                {item.type === "email" && <Mail className="h-5 w-5 text-amber-500" />}
              </div>

              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {item.type === "activity" && (item.data as Activity).type.charAt(0).toUpperCase() + (item.data as Activity).type.slice(1)}
                    {item.type === "message" && "Text Message"}
                    {item.type === "call" && "Phone Call"}
                    {item.type === "email" && "Email"}
                  </span>

                  {item.type === "activity" && getStatusBadge((item.data as Activity).status)}
                  {item.type === "call" && getStatusBadge((item.data as any).status)}
                </div>

                <span className="text-xs text-muted-foreground">
                  {format(item.timestamp, "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>

              <Card className="p-3 mt-1">
                {item.type === "activity" && (
                  <div>
                    <h4 className="font-medium">{(item.data as Activity).title}</h4>
                    {(item.data as Activity).description && (
                      <div className={`mt-2 ${(item.data as Activity).type === "note" ? "bg-muted/50 p-2 rounded-md" : ""}`}>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{(item.data as Activity).description}</p>
                      </div>
                    )}
                    {(item.data as Activity).dueDate && (item.data as Activity).type !== "note" && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock size={12} />
                        <span>Due: {format(new Date((item.data as Activity).dueDate), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    )}
                  </div>
                )}

                {item.type === "message" && (
                  <div>
                    <div
                      className={`flex items-start gap-2 ${(item.data as any).direction === "outgoing" ? "justify-end" : ""}`}
                    >
                      <div
                        className={`max-w-[80%] p-2 rounded-lg ${
                          (item.data as any).direction === "outgoing" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{(item.data as any).content}</p>
                      </div>
                    </div>
                  </div>
                )}

                {item.type === "call" && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{(item.data as any).direction} Call</span>
                      {(item.data as any).duration > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Duration: {formatDuration((item.data as any).duration)}
                        </span>
                      )}
                    </div>
                    {(item.data as any).notes && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">{(item.data as any).notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {item.type === "email" && (
                  <div>
                    <h4 className="font-medium">{(item.data as any).subject}</h4>
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{(item.data as any).content}</p>
                    </div>
                    {(item.data as any).attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(item.data as any).attachments.map((attachment: any, i: number) => (
                          <Badge key={i} variant="outline" className="flex items-center gap-1">
                            <Paperclip size={12} />
                            {attachment}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  )
}
