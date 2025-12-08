"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, Mail, MessageSquare, RefreshCw, User, Calendar, CheckCircle, XCircle, AlertCircle, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface ScheduledMessage {
  id: string
  channel: 'SMS' | 'EMAIL'
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
  scheduledAt: string
  body: string
  subject?: string
  fromNumber?: string
  toNumber?: string
  fromEmail?: string
  toEmail?: string
  createdAt: string
  sentAt?: string
  errorMessage?: string
  contact?: { id: string; firstName?: string; lastName?: string; phone1?: string; email1?: string }
  createdBy?: { firstName?: string; lastName?: string }
}

export default function ScheduledMessagesSettings() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [channelFilter, setChannelFilter] = useState<string>('ALL')

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (channelFilter !== 'ALL') params.set('channel', channelFilter)
      params.set('limit', '100')
      
      const response = await fetch(`/api/scheduled-messages?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.data || [])
      } else {
        toast.error('Failed to fetch scheduled messages')
      }
    } catch (err) {
      toast.error('Error fetching scheduled messages')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, channelFilter])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  const cancelMessage = async (id: string) => {
    try {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' })
      })
      if (response.ok) {
        toast.success('Message cancelled')
        fetchMessages()
      } else {
        toast.error('Failed to cancel message')
      }
    } catch (err) {
      toast.error('Error cancelling message')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'SENT': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>
      case 'FAILED': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'CANCELLED': return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const pendingCount = messages.filter(m => m.status === 'PENDING').length
  const sentCount = messages.filter(m => m.status === 'SENT').length
  const failedCount = messages.filter(m => m.status === 'FAILED').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scheduled Messages</h2>
          <p className="text-sm text-muted-foreground">View and manage all scheduled emails and SMS</p>
        </div>
        <Button onClick={fetchMessages} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Clock className="h-4 w-4 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{messages.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg"><AlertCircle className="h-4 w-4 text-yellow-600" /></div>
          <div><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">{pendingCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="h-4 w-4 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground">Sent</p><p className="text-xl font-bold">{sentCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg"><XCircle className="h-4 w-4 text-red-600" /></div>
          <div><p className="text-xs text-muted-foreground">Failed</p><p className="text-xl font-bold">{failedCount}</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList><TabsTrigger value="ALL">All</TabsTrigger><TabsTrigger value="PENDING">Pending</TabsTrigger><TabsTrigger value="SENT">Sent</TabsTrigger><TabsTrigger value="FAILED">Failed</TabsTrigger></TabsList>
        </Tabs>
        <Tabs value={channelFilter} onValueChange={setChannelFilter}>
          <TabsList><TabsTrigger value="ALL">All</TabsTrigger><TabsTrigger value="SMS"><MessageSquare className="h-3 w-3 mr-1" />SMS</TabsTrigger><TabsTrigger value="EMAIL"><Mail className="h-3 w-3 mr-1" />Email</TabsTrigger></TabsList>
        </Tabs>
      </div>

      {/* Messages List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Message Queue</CardTitle>
          <CardDescription>Messages waiting to be sent or recently processed</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No scheduled messages found</p>
              <p className="text-xs mt-1">Schedule emails or SMS from any contact page</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${message.channel === 'SMS' ? 'bg-green-100' : 'bg-blue-100'}`}>
                          {message.channel === 'SMS' ? <MessageSquare className="h-3 w-3 text-green-600" /> : <Mail className="h-3 w-3 text-blue-600" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{message.channel}</span>
                            {getStatusBadge(message.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {message.contact ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {[message.contact.firstName, message.contact.lastName].filter(Boolean).join(' ') || 'Unknown'}
                              </span>
                            ) : (message.channel === 'SMS' ? message.toNumber : message.toEmail)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(message.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {message.status === 'PENDING' && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-red-600 hover:text-red-700 mt-1" onClick={() => cancelMessage(message.id)}>
                            <Trash2 className="h-3 w-3 mr-1" />Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                    {message.channel === 'EMAIL' && message.subject && (
                      <p className="text-xs font-medium mb-1">Subject: {message.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{message.body?.replace(/<[^>]*>/g, '') || 'No content'}</p>
                    {message.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> {message.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

