"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Clock, 
  User,
  CheckCircle,
  AlertCircle,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

interface TimelineItem {
  id: string
  type: 'call' | 'message' | 'email' | 'activity' | 'note'
  title: string
  description?: string
  timestamp: string
  status?: string
  direction?: 'inbound' | 'outbound'
  duration?: number
  metadata?: any
}

interface ContactTimelineProps {
  contactId: string
}

export default function ContactTimeline({ contactId }: ContactTimelineProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTimelineData()
  }, [contactId])

  const fetchTimelineData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all communication types in parallel (with error handling)
      const [activitiesRes, callsRes, messagesRes, emailsRes] = await Promise.allSettled([
        fetch(`/api/activities?contactId=${contactId}`).catch(() => ({ ok: false })),
        fetch(`/api/calls?contactId=${contactId}`).catch(() => ({ ok: false })),
        fetch(`/api/messages?contactId=${contactId}`).catch(() => ({ ok: false })),
        fetch(`/api/emails?contactId=${contactId}`).catch(() => ({ ok: false }))
      ])

      const activities = activitiesRes.status === 'fulfilled' && activitiesRes.value.ok
        ? await activitiesRes.value.json() : []
      const calls = callsRes.status === 'fulfilled' && callsRes.value.ok
        ? await callsRes.value.json() : []
      const messages = messagesRes.status === 'fulfilled' && messagesRes.value.ok
        ? await messagesRes.value.json() : []
      const emails = emailsRes.status === 'fulfilled' && emailsRes.value.ok
        ? await emailsRes.value.json() : []

      // Transform data into timeline items
      const items: TimelineItem[] = [
        // Activities
        ...activities.map((activity: any) => ({
          id: `activity-${activity.id}`,
          type: 'activity' as const,
          title: activity.title || `${activity.type} Activity`,
          description: activity.description,
          timestamp: activity.createdAt || activity.dueDate,
          status: activity.status,
          metadata: activity
        })),
        
        // Calls
        ...calls.map((call: any) => ({
          id: `call-${call.id}`,
          type: 'call' as const,
          title: `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call`,
          description: call.notes || `Duration: ${call.duration || 0}s`,
          timestamp: call.createdAt || call.startTime,
          direction: call.direction,
          duration: call.duration,
          status: call.status,
          metadata: call
        })),
        
        // Messages
        ...messages.map((message: any) => ({
          id: `message-${message.id}`,
          type: 'message' as const,
          title: `${message.direction === 'inbound' ? 'Received' : 'Sent'} Message`,
          description: message.content || message.body,
          timestamp: message.createdAt || message.sentAt,
          direction: message.direction,
          status: message.status,
          metadata: message
        })),
        
        // Emails
        ...emails.map((email: any) => ({
          id: `email-${email.id}`,
          type: 'email' as const,
          title: `${email.direction === 'inbound' ? 'Received' : 'Sent'} Email`,
          description: email.subject || email.content,
          timestamp: email.createdAt || email.sentAt,
          direction: email.direction,
          status: email.status,
          metadata: email
        }))
      ]

      // Sort by timestamp (newest first)
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
      setTimelineItems(items)
    } catch (err) {
      console.error('Error fetching timeline data:', err)
      setError('Failed to load timeline data')
    } finally {
      setLoading(false)
    }
  }

  const getItemIcon = (item: TimelineItem) => {
    switch (item.type) {
      case 'call':
        if (item.direction === 'inbound') return <PhoneIncoming size={16} />
        if (item.direction === 'outbound') return <PhoneOutgoing size={16} />
        return <Phone size={16} />
      case 'message':
        return <MessageSquare size={16} />
      case 'email':
        return <Mail size={16} />
      case 'activity':
        return <Calendar size={16} />
      case 'note':
        return <User size={16} />
      default:
        return <Clock size={16} />
    }
  }

  const getItemColor = (item: TimelineItem) => {
    switch (item.type) {
      case 'call':
        return item.direction === 'inbound' ? 'text-green-600' : 'text-blue-600'
      case 'message':
        return item.direction === 'inbound' ? 'text-purple-600' : 'text-indigo-600'
      case 'email':
        return item.direction === 'inbound' ? 'text-orange-600' : 'text-red-600'
      case 'activity':
        return 'text-gray-600'
      case 'note':
        return 'text-yellow-600'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBadge = (item: TimelineItem) => {
    if (!item.status) return null

    const statusConfig = {
      completed: { variant: 'default' as const, label: 'Completed' },
      planned: { variant: 'secondary' as const, label: 'Planned' },
      cancelled: { variant: 'destructive' as const, label: 'Cancelled' },
      answered: { variant: 'default' as const, label: 'Answered' },
      missed: { variant: 'destructive' as const, label: 'Missed' },
      sent: { variant: 'default' as const, label: 'Sent' },
      delivered: { variant: 'default' as const, label: 'Delivered' },
      failed: { variant: 'destructive' as const, label: 'Failed' }
    }

    const config = statusConfig[item.status as keyof typeof statusConfig]
    if (!config) return null

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start space-x-4 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchTimelineData} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  if (timelineItems.length === 0) {
    return (
      <div className="p-6 text-center">
        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500 mb-2">No communication history found</p>
        <p className="text-sm text-gray-400">
          Activities, calls, messages, and emails will appear here once they're created.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        {timelineItems.map((item, index) => (
          <div key={item.id} className="relative">
            {/* Timeline line */}
            {index < timelineItems.length - 1 && (
              <div className="absolute left-4 top-8 w-0.5 h-16 bg-gray-200"></div>
            )}
            
            {/* Timeline item */}
            <div className="flex items-start space-x-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${getItemColor(item)} bg-white`}>
                {getItemIcon(item)}
              </div>
              
              {/* Content */}
              <Card className="flex-1 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{format(new Date(item.timestamp), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>{format(new Date(item.timestamp), 'h:mm a')}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {getStatusBadge(item)}
                  </div>
                  
                  {item.description && (
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  
                  {/* Additional metadata */}
                  {item.type === 'call' && item.duration && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>Duration: {Math.floor(item.duration / 60)}m {item.duration % 60}s</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
