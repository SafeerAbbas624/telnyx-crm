"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MessageSquare,
  Phone,
  Calendar,
  UserPlus
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format, isPast, isToday } from "date-fns"
import type { Activity, Contact } from "@/lib/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MapPin, CheckCircle, FileText, Mail, Trash2 } from "lucide-react"
import ContactName from "@/components/contacts/contact-name"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActivities } from "@/lib/context/activities-context"

interface DashboardStats {
  totalContacts: number
  recentContacts: number
  totalMessages: number
  totalMessagesSent: number
  totalMessagesReceived: number
  totalCalls: number
  totalOutboundCalls: number
  totalInboundCalls: number
  totalActivities: number
  completedActivities: number
  pendingActivities: number
  todayStats: {
    messages: number
    calls: number
    activities: number
    contacts: number
  }
  weekStats: {
    messages: number
    calls: number
    activities: number
    contacts: number
  }
  monthStats: {
    messages: number
    calls: number
    activities: number
    contacts: number
  }
  recentActivities: Activity[]
  contacts?: Contact[]
}

interface MetricCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  change: string
}

function MetricCard({ icon, title, value, change }: MetricCardProps) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-gray-500">{icon}</div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        </div>
        <div className="mt-3">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-2">{change}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardOverviewFigma() {
  const [activeTaskTab, setActiveTaskTab] = useState("today")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [messagesOverTimeData, setMessagesOverTimeData] = useState<any[]>([])
  const [callsThisWeekData, setCallsThisWeekData] = useState<any[]>([])
  const [showEditActivity, setShowEditActivity] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [activityType, setActivityType] = useState<Activity['type']>('task')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueTime, setDueTime] = useState("09:00")

  const { refreshActivities } = useActivities()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const now = new Date()
      const params = new URLSearchParams({
        todayStart: startOfDay(now).toISOString(),
        todayEnd: endOfDay(now).toISOString(),
        weekStart: startOfWeek(now).toISOString(),
        weekEnd: endOfWeek(now).toISOString(),
        monthStart: startOfMonth(now).toISOString(),
        monthEnd: endOfMonth(now).toISOString(),
        recentGte: subMonths(now, 1).toISOString(),
        now: now.toISOString(),
      })

      // Fetch both stats and chart data in parallel for faster loading
      const [statsResponse, chartResponse] = await Promise.all([
        fetch(`/api/dashboard/stats?${params.toString()}`),
        fetch('/api/dashboard/chart-data')
      ])

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch dashboard stats')
      }

      const data = await statsResponse.json()
      setStats(data)

      // Set chart data if available
      if (chartResponse.ok) {
        const chartData = await chartResponse.json()
        console.log('Chart data received:', chartData)
        setMessagesOverTimeData(chartData.messagesData || [])
        setCallsThisWeekData(chartData.callsData || [])
      } else {
        console.error('Chart data fetch failed:', chartResponse.status, await chartResponse.text())
      }

    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Get filtered tasks
  const getFilteredTasks = () => {
    if (!stats?.recentActivities) return []
    const now = new Date()

    // Filter to only show task-like activities
    const allTasks = stats.recentActivities.filter(
      (activity) => (activity.type === "task" || activity.type === "meeting" || activity.type === "call" || activity.type === "email" || activity.type === "note")
    )

    switch (activeTaskTab) {
      case 'today':
        return allTasks.filter(activity => {
          const dueDate = activity.dueDate ? new Date(activity.dueDate) : null
          return dueDate && (isToday(dueDate) || isPast(dueDate)) && activity.status !== 'completed'
        })
      case 'week':
        const weekEnd = endOfWeek(now)
        return allTasks.filter(activity => {
          const dueDate = activity.dueDate ? new Date(activity.dueDate) : null
          return dueDate && dueDate <= weekEnd && activity.status !== 'completed'
        })
      case 'all':
      default:
        return allTasks
    }
  }

  // Get contact by ID
  const getContactById = (contactId: string) => {
    return stats?.contacts?.find((contact: Contact) => contact.id === contactId) || null
  }

  // Handle task click for editing
  const handleTaskClick = (activity: Activity) => {
    const contact = activity.contact || getContactById(activity.contactId)
    if (!contact) return

    setSelectedActivity(activity)
    setSelectedContact(contact)
    setActivityType(activity.type)
    setTitle(activity.title)
    setDescription(activity.description || '')

    if (activity.dueDate) {
      const dueDate = new Date(activity.dueDate)
      setDueDate(format(dueDate, "yyyy-MM-dd"))
      setDueTime(format(dueDate, "HH:mm"))
    }

    setShowEditActivity(true)
  }

  // Handle completing a task
  const handleCompleteTask = async (activity: Activity) => {
    // Get contact first
    const contact = activity.contact || getContactById(activity.contactId)

    // Open dialog immediately for better UX
    if (contact) {
      setSelectedActivity(null)
      setSelectedContact(contact)
      setActivityType('task')
      setTitle('')
      setDescription('')
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setDueTime("09:00")
      setShowEditActivity(true)
    }

    // Complete task in background
    try {
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to complete task')
      }

      // Refresh in background
      Promise.all([
        fetchDashboardStats(),
        refreshActivities()
      ]).catch(err => console.error('Error refreshing data:', err))

    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  // Handle deleting a task
  const handleDeleteTask = async (activity: Activity) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete task')
      }

      // Refresh in background
      Promise.all([
        fetchDashboardStats(),
        refreshActivities()
      ]).catch(err => console.error('Error refreshing data:', err))

    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  // Handle saving activity (both create and update)
  const handleSaveActivity = async () => {
    if (!selectedContact) return

    // Close dialog immediately for better UX
    setShowEditActivity(false)

    try {
      // Combine date and time
      const dueDateObj = new Date(`${dueDate}T${dueTime}:00`)

      const activityData = {
        contactId: selectedContact.id,
        type: activityType,
        title,
        description: description || '',
        dueDate: dueDateObj.toISOString(),
      }

      let response
      if (selectedActivity) {
        // Update existing activity
        response = await fetch(`/api/activities/${selectedActivity.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(activityData),
        })
      } else {
        // Create new activity
        response = await fetch('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...activityData,
            status: 'planned' as const,
          }),
        })
      }

      if (!response.ok) {
        throw new Error('Failed to save activity')
      }

      // Reset form
      setTitle('')
      setDescription('')
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setDueTime("09:00")
      setSelectedContact(null)
      setSelectedActivity(null)

      // Refresh in background
      Promise.all([
        fetchDashboardStats(),
        refreshActivities()
      ]).catch(err => console.error('Error refreshing data:', err))

    } catch (error) {
      console.error('Error saving activity:', error)
      // Reopen dialog on error
      setShowEditActivity(true)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f8f9fa]">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <div className="border-b bg-white p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600">Overview of your CRM activity and performance</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto space-y-6" style={{ maxWidth: 'calc(100% - 4rem)' }}>
          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Messages"
              value={stats?.totalMessages.toLocaleString() || '0'}
              change={`${stats?.weekStats.messages || 0} this week`}
            />
            <MetricCard
              icon={<Phone className="h-5 w-5" />}
              title="Calls"
              value={stats?.totalCalls.toLocaleString() || '0'}
              change={`${stats?.weekStats.calls || 0} this week`}
            />
            <MetricCard
              icon={<Calendar className="h-5 w-5" />}
              title="Activities"
              value={stats?.totalActivities.toLocaleString() || '0'}
              change={`${stats?.weekStats.activities || 0} this week`}
            />
            <MetricCard
              icon={<UserPlus className="h-5 w-5" />}
              title="New Contacts"
              value={stats?.monthStats.contacts.toLocaleString() || '0'}
              change="This month"
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Messages Over Time */}
            <Card className="border border-gray-200">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-900">Messages Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={messagesOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      stroke="#d1d5db"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      stroke="#d1d5db"
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      iconType="circle"
                    />
                    <Line
                      type="monotone"
                      dataKey="received"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 3 }}
                      name="Received"
                    />
                    <Line
                      type="monotone"
                      dataKey="sent"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      name="Sent"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Calls This Week */}
            <Card className="border border-gray-200">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-900">Calls This Week</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={callsThisWeekData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      stroke="#d1d5db"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      stroke="#d1d5db"
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar
                      dataKey="calls"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Tasks */}
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Upcoming Tasks</h3>
                <Tabs value={activeTaskTab} onValueChange={setActiveTaskTab}>
                  <TabsList>
                    <TabsTrigger value="today">Today</TabsTrigger>
                    <TabsTrigger value="week">This Week</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Task List */}
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {getFilteredTasks().length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks found</p>
                    </div>
                  ) : (
                    getFilteredTasks().map((activity) => {
                      const contact = activity.contact || getContactById(activity.contactId)
                      return (
                        <div
                          key={activity.id}
                          className="border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {/* Contact Information - Top Section */}
                          {contact && (
                            <div className="p-3 bg-gray-50 border-b">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex-shrink-0">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                        {contact.firstName?.[0]}{contact.lastName?.[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      <ContactName contact={contact as any} clickMode="popup" />
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      {contact.propertyAddress && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {contact.propertyAddress}
                                        </span>
                                      )}
                                      {contact.phone1 && (
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {contact.phone1}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                  {activity.status !== 'completed' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCompleteTask(activity)
                                      }}
                                      title="Mark as completed"
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteTask(activity)
                                    }}
                                    title="Delete task"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Task Details - Bottom Section */}
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => handleTaskClick(activity)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-1">
                                {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                                {activity.type === 'email' && <Mail className="h-4 w-4 text-green-500" />}
                                {activity.type === 'meeting' && <Calendar className="h-4 w-4 text-purple-500" />}
                                {activity.type === 'task' && <CheckCircle className="h-4 w-4 text-orange-500" />}
                                {activity.type === 'note' && <FileText className="h-4 w-4 text-gray-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                                {activity.description && (
                                  <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                                )}

                                <div className="flex items-center gap-2 mt-2">
                                  <Badge
                                    variant={
                                      activity.dueDate && isPast(new Date(activity.dueDate)) && activity.status !== 'completed'
                                        ? 'destructive'
                                        : activity.status === 'completed'
                                          ? 'default'
                                          : 'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {activity.status}
                                  </Badge>
                                  {activity.dueDate && (
                                    <span className="text-xs text-gray-400">
                                      📅 {format(new Date(activity.dueDate), 'MMM d, yyyy h:mm a')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit/Add Activity Dialog */}
      <Dialog open={showEditActivity} onOpenChange={setShowEditActivity}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedActivity ? 'Edit Activity' : 'Add Activity'} for {selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activity-type">Activity Type</Label>
              <Select value={activityType} onValueChange={(value) => setActivityType(value as Activity['type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activity title" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about this activity"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-time">Due Time</Label>
                <Input id="due-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditActivity(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveActivity} disabled={!title || !dueDate}>
              {selectedActivity ? 'Update Activity' : 'Add Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

