"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, MessageSquare, Phone, Mail, Plus, Search, Calendar, TrendingUp, Clock, Activity, BarChart3, DollarSign, Target, CheckCircle, AlertCircle, PhoneCall, Send, ArrowUpRight, ArrowDownRight, Timer, MapPin, FileText, Zap, Trash2, Edit } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { format, isToday, isPast, addDays, addMonths, isBefore, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns"
import type { Activity, Contact, Tag } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import AddContactDialog from "@/components/contacts/add-contact-dialog"
import { useActivities } from "@/lib/context/activities-context"
import { useTaskUI } from "@/lib/context/task-ui-context"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useCallUI } from "@/lib/context/call-ui-context"
import { usePhoneNumber } from "@/lib/context/phone-number-context"
import { toast } from "sonner"

import ContactName from "@/components/contacts/contact-name"
import { normalizePropertyType } from "@/lib/property-type-mapper"

interface DashboardStats {
  // Contact stats
  totalContacts: number;
  recentContacts: number;
  totalContactsContacted: number;
  totalContactsLeftForContact: number;

  // Message stats
  totalMessages: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;

  // Call stats
  totalCalls: number;
  totalOutboundCalls: number;
  totalInboundCalls: number;

  // Telnyx specific stats
  telnyxMessages: number;
  telnyxCalls: number;
  telnyxCost: number;
  telnyxPhoneNumbers: number;

  // Activity stats
  totalActivities: number;
  completedActivities: number;
  pendingActivities: number;
  overdueActivities: number;

  // Deal stats
  totalDeals: number;
  dealsValue: number;
  dealsWon: number;
  dealsLost: number;

  // Time-based stats
  todayStats: {
    messages: number;
    calls: number;
    activities: number;
    contacts: number;
  };
  weekStats: {
    messages: number;
    calls: number;
    activities: number;
    contacts: number;
  };
  monthStats: {
    messages: number;
    calls: number;
    activities: number;
    contacts: number;
  };

  // Additional data
  contactsByPropertyType: Array<{
    type: string;
    count: number;
  }>;
  recentActivities: Activity[];
  contacts?: Contact[];
}

type TaskFilter = "overdue-today" | "next-7-days" | "next-month" | "all-time"

export function DashboardOverview() {
  console.log('DashboardOverview component rendering')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("overdue-today")
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [activityType, setActivityType] = useState<Activity['type']>('task')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [activeTab, setActiveTab] = useState("activity")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueTime, setDueTime] = useState("09:00")
  const [selectedTask, setSelectedTask] = useState<Activity | null>(null)

  // Use activities context to refresh contact activities
  const { refreshActivities } = useActivities()

  // Use task UI context for floating panel
  const { openTask } = useTaskUI()
  const { openEmail } = useEmailUI()
  const { openSms } = useSmsUI()
  const { openCall } = useCallUI()
  const { selectedPhoneNumber } = usePhoneNumber()

  // Handle initiating a call via WebRTC
  const handleInitiateCall = async (contact: { id: string; firstName?: string; lastName?: string; phone1?: string }) => {
    const phoneNumber = contact.phone1
    if (!phoneNumber) {
      toast.error('No phone number available for this contact')
      return
    }
    if (!selectedPhoneNumber) {
      toast.error('No phone number selected. Please select a calling number from the header.')
      return
    }
    const fromNumber = selectedPhoneNumber.phoneNumber

    try {
      // Use WebRTC to make the call
      const { formatPhoneNumberForTelnyx } = await import('@/lib/phone-utils')
      const toNumber = formatPhoneNumberForTelnyx(phoneNumber) || phoneNumber

      // Get WebRTC client
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.ensureRegistered()
      const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber })

      // Log the call to database
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          contactId: contact.id,
          fromNumber,
          toNumber,
        })
      }).catch(err => console.error('Failed to log call:', err))

      openCall({
        contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName },
        fromNumber,
        toNumber,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
      })

      toast.success(`Calling ${contact.firstName || ''} ${contact.lastName || ''}`.trim())
    } catch (error: any) {
      console.error('Error initiating call:', error)
      toast.error(error.message || 'Failed to initiate call')
    }
  }

  const addActivity = async (activity: Omit<Activity, 'id' | 'createdAt' | 'status' | 'contactId'> & { contactId: string }) => {
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...activity,
          status: 'planned' as const,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add activity');
      }

      // Refresh the dashboard stats to show the new activity
      await fetchDashboardStats();

      // Also refresh the activities context so contact pages show the new activity
      await refreshActivities();

      return await response.json();

    } catch (error) {
      console.error('Error adding activity:', error);
      throw error;
    }
  };

  const fetchDashboardStats = async (): Promise<DashboardStats | null> => {
    try {
      console.log('Fetching dashboard stats...')
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
      const response = await fetch(`/api/dashboard/stats?${params.toString()}`)
      console.log('Response status:', response.status, response.ok)
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats')
      }
      const data = await response.json()
      console.log('Received data:', data)
      console.log('Recent activities in data:', data.recentActivities?.length || 0)
      setStats(data)
      console.log('Stats state updated')
      return data;
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard data')
      throw err;
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    console.log('useEffect running, calling fetchDashboardStats')
    try {
      fetchDashboardStats().catch(err => {
        console.error('Error in useEffect fetchDashboardStats:', err)
      })
    } catch (err) {
      console.error('Synchronous error in useEffect:', err)
    }
  }, [])

  // Get all tasks (activities of all types that should be shown in task management)
  const allTasks = stats?.recentActivities.filter(
    (activity) => (activity.type === "task" || activity.type === "meeting" || activity.type === "call" || activity.type === "email" || activity.type === "note")
  ) || []

  // Debug logging
  console.log('Stats loaded:', !!stats)
  console.log('Recent activities count:', stats?.recentActivities?.length || 0)
  console.log('All tasks count:', allTasks.length)
  console.log('Sample tasks:', allTasks.slice(0, 3))

  // Filter tasks based on selected time period
  const getFilteredTasks = () => {
    const now = new Date()
    const nextWeek = addDays(now, 7)
    const nextMonth = addMonths(now, 1)

    return allTasks.filter((task) => {
      // Handle null/undefined dueDate
      if (!task.dueDate) {
        // If no due date, only show in "all-time" filter
        return taskFilter === "all-time"
      }

      const dueDate = new Date(task.dueDate)

      // Check if date is valid
      if (isNaN(dueDate.getTime())) {
        console.warn('Invalid due date for task:', task.id, task.dueDate)
        return taskFilter === "all-time"
      }

      switch (taskFilter) {
        case "overdue-today":
          return isPast(dueDate) || isToday(dueDate)
        case "next-7-days":
          return !isPast(dueDate) && !isToday(dueDate) && isBefore(dueDate, nextWeek)
        case "next-month":
          return isBefore(dueDate, nextMonth) && !isBefore(dueDate, nextWeek)
        case "all-time":
          return true
        default:
          return true
      }
    })
  }

  const filteredTasks = getFilteredTasks()
  console.log('Filtered tasks count:', filteredTasks.length)
  console.log('Task filter:', taskFilter)

  // Get task title
  const getTaskTitle = (taskFilter: TaskFilter) => {
    switch (taskFilter) {
      case "overdue-today":
        return "Overdue & Today's Tasks"
      case "next-7-days":
        return "Upcoming Week Tasks"
      case "next-month":
        return "Next Month Tasks"
      case "all-time":
        return "All Tasks"
      default:
        return "Tasks"
    }
  }

  // Get contact by ID
  const getContactById = (contactId: string) => {
    return stats?.contacts?.find((contact: Contact) => contact.id === contactId) || null
  }

  // Filter tasks by search query
  const searchFilteredTasks = (filteredTasks || []).filter((task) => {
    const contact = task.contact || getContactById(task.contactId)
    if (!contact) {
      console.log('No contact found for task:', task.id, 'contactId:', task.contactId)
      return false
    }

    // If no search query, return all tasks
    if (!searchQuery.trim()) {
      return true
    }

    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
    const query = searchQuery.toLowerCase()
    const contactEmail = contact.email ? contact.email.toLowerCase() : ''
    const contactPhone = contact.phone || ''
    const taskDescription = task.description || ''

    // Safely access contact tags
    const contactTags = 'tags' in contact ? (contact as Record<string, unknown>).tags || [] : []

    // Check if the task matches the search query
    return (
      fullName.includes(query) ||
      contactEmail.includes(query) ||
      contactPhone.includes(query) ||
      task.title.toLowerCase().includes(query) ||
      taskDescription.toLowerCase().includes(query) ||
      contactTags.some((tag: string) => tag.toLowerCase().includes(query))
    )
  })

  console.log('Search filtered tasks count:', searchFilteredTasks.length)
  console.log('Search query:', searchQuery)

  const handleAddActivity = (contact: Contact) => {
    setSelectedContact(contact)
    setActivityType("task")
    setTitle("")
    setDescription("")
    setDueDate(format(new Date(), "yyyy-MM-dd"))
    setDueTime("09:00")
    setShowAddActivity(true)
  }

  const handleSaveActivity = async () => {
    if (!selectedContact) return

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

      console.log('Saving activity:', activityData)

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...activityData,
          status: 'planned' as const,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add activity');
      }

      const newActivity = await response.json();
      console.log('Activity saved successfully:', newActivity);

      // Refresh the dashboard stats to show the new activity
      await fetchDashboardStats();

      // Also refresh the activities context so contact pages show the new activity
      await refreshActivities();

      // Reset form
      setTitle('');
      setDescription('');
      setDueDate(format(new Date(), "yyyy-MM-dd"));
      setDueTime("09:00");
      setSelectedContact(null);
      setShowAddActivity(false);

    } catch (error) {
      console.error('Error saving activity:', error);
      // You could add a toast notification here to show the error to the user
    }
  }

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isToday(date)) {
      return `Today at ${format(date, "h:mm a")}`
    }
    return format(date, "MMM d, yyyy 'at' h:mm a")
  }

  const isOverdue = (dateString: string) => {
    const date = new Date(dateString)
    return isPast(date) && !isToday(date)
  }

  const renderTags = (tags: string[] | undefined) => {
    if (!tags || tags.length === 0) return null

    // Create a consistent color mapping for tags
    const tagColors: Record<string, string> = {}
    const colorClasses = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-red-100 text-red-800 border-red-200',
    ]

    // Assign colors to tags consistently
    tags.forEach((tag, index) => {
      if (!tagColors[tag]) {
        tagColors[tag] = colorClasses[index % colorClasses.length]
      }
    })

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.map((tag, index) => (
          <Badge
            key={`${tag}-${index}`}
            variant="outline"
            className={`text-xs truncate border ${tagColors[tag] || colorClasses[0]}`}
            style={{
              maxWidth: '100px',
            }}
          >
            {tag}
          </Badge>
        ))}
      </div>
    )
  }

  // Get filtered contacts for search
  const getFilteredContacts = () => {
    if (!stats?.contacts) return []

    if (!searchQuery.trim()) {
      return stats.contacts
    }

    const query = searchQuery.toLowerCase()
    return stats.contacts.filter((contact) => {
      const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
      const email = contact.email1?.toLowerCase() || ''
      const phone = contact.phone1 || ''

      return (
        fullName.includes(query) ||
        email.includes(query) ||
        phone.includes(query)
      )
    })
  }

  // Handle adding a new task
  const handleAddTask = async () => {
    if (!title.trim() || !selectedContact) return

    try {
      // Combine date and time
      const dueDateObj = new Date(`${dueDate}T${dueTime}:00`)

      const activityData = {
        contactId: selectedContact.id,
        type: activityType,
        title: title.trim(),
        description: description.trim() || '',
        dueDate: dueDateObj.toISOString(),
      }

      await addActivity(activityData as Omit<Activity, 'id' | 'createdAt' | 'status' | 'contactId'> & { contactId: string })

      // Reset form
      setTitle('')
      setDescription('')
      setSelectedContact(null)
      setSearchQuery('')
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setDueTime("09:00")

      // Refresh dashboard stats
      await fetchDashboardStats()
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  // Handle task click for editing
  const handleTaskClick = (activity: Activity) => {
    const contact = activity.contact || getContactById(activity.contactId)
    if (!contact) return

    setSelectedContact(contact)
    setActivityType(activity.type)
    setTitle(activity.title)
    setDescription(activity.description || '')

    if (activity.dueDate) {
      const dueDate = new Date(activity.dueDate)
      setDueDate(format(dueDate, "yyyy-MM-dd"))
      setDueTime(format(dueDate, "HH:mm"))
    }

    setShowAddActivity(true)
  }

  // Handle completing a task
  const handleCompleteTask = async (activity: Activity) => {
    try {
      // Update activity status to completed
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

      // Refresh dashboard stats
      await fetchDashboardStats()

      // Also refresh the activities context
      await refreshActivities()

      // Show popup for next activity using the proper Add Activity dialog
      const contact = activity.contact || getContactById(activity.contactId)
      if (contact) {
        handleAddActivity(contact)
      }
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

      // Refresh dashboard stats
      await fetchDashboardStats()

      // Also refresh the activities context
      await refreshActivities()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Get the most common property type
  const mostCommonPropertyType = stats.contactsByPropertyType[0]?.type || 'N/A';

  return (
    <div className="space-y-4 p-4 h-full overflow-y-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">
          Complete overview of your CRM activities and performance metrics
        </p>
      </div>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">


          {/* Today's Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Messages</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayStats?.messages || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.weekStats?.messages || 0} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Calls</CardTitle>
                <PhoneCall className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayStats?.calls || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.weekStats?.calls || 0} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayStats?.activities || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.weekStats?.activities || 0} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayStats?.contacts || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.weekStats?.contacts || 0} this week
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Task Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">Task Management</h2>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={taskFilter === "overdue-today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTaskFilter("overdue-today")}
                >
                  Overdue & Today
                </Button>
                <Button
                  variant={taskFilter === "next-7-days" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTaskFilter("next-7-days")}
                >
                  Next 7 Days
                </Button>
                <Button
                  variant={taskFilter === "next-month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTaskFilter("next-month")}
                >
                  Next Month
                </Button>
                <Button
                  variant={taskFilter === "all-time" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTaskFilter("all-time")}
                >
                  All Time
                </Button>
              </div>
            </div>

            {/* Task List - Full Width */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {taskFilter === "overdue-today" && "Overdue & Today's Tasks"}
                  {taskFilter === "next-7-days" && "Next 7 Days"}
                  {taskFilter === "next-month" && "Next Month"}
                  {taskFilter === "all-time" && "All Tasks"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {getFilteredTasks().length > 0 ? (
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
                                          {contact.firstName[0]}{contact.lastName[0]}
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
                                    {/* Communication Buttons */}
                                    {contact.phone1 && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleInitiateCall(contact)
                                          }}
                                          title="Call"
                                        >
                                          <Phone className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openSms({ phoneNumber: contact.phone1!, contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } })
                                          }}
                                          title="Send SMS"
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {contact.email1 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openEmail({ email: contact.email1!, contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } })
                                        }}
                                        title="Send Email"
                                      >
                                        <Mail className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {/* Task Management Buttons */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openTask({
                                          taskId: activity.id,
                                          isEditMode: true,
                                          title: activity.title,
                                          description: activity.description || '',
                                          dueDate: activity.dueDate ? format(new Date(activity.dueDate), 'yyyy-MM-dd') : '',
                                          priority: activity.priority || 'medium',
                                          contactId: activity.contactId || undefined,
                                        })
                                      }}
                                      title="Edit task"
                                    >
                                      <Edit className="h-4 w-4 text-blue-600" />
                                    </Button>
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
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No tasks found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-6">
          {/* Contact Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Contact Statistics</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.recentContacts} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacts Contacted</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.totalContactsContacted}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalContacts > 0 ? `${Math.round((stats.totalContactsContacted / stats.totalContacts) * 100)}% of total` : '0% of total'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Left to Contact</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.totalContactsLeftForContact}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalContacts > 0 ? `${Math.round((stats.totalContactsLeftForContact / stats.totalContacts) * 100)}% remaining` : '0% remaining'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

          {/* Telnyx Communication Statistics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Telnyx Communication</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.telnyxMessages || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalMessagesSent || 0} sent, {stats.totalMessagesReceived || 0} received
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <PhoneCall className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.telnyxCalls || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalOutboundCalls || 0} outbound, {stats.totalInboundCalls || 0} inbound
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Phone Numbers</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.telnyxPhoneNumbers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Active phone numbers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${(stats.telnyxCost || 0).toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Communication costs
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Activity Statistics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Activity Statistics</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalActivities || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    All time activities
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedActivities || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalActivities > 0 ? `${Math.round(((stats.completedActivities || 0) / stats.totalActivities) * 100)}% completion rate` : '0% completion rate'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingActivities || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting completion
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.overdueActivities || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Need attention
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Time-based Performance */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Performance Trends</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Today</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Messages:</span>
                    <span className="font-medium">{stats.todayStats?.messages || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Calls:</span>
                    <span className="font-medium">{stats.todayStats?.calls || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Activities:</span>
                    <span className="font-medium">{stats.todayStats?.activities || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">New Contacts:</span>
                    <span className="font-medium">{stats.todayStats?.contacts || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">This Week</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Messages:</span>
                    <span className="font-medium">{stats.weekStats?.messages || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Calls:</span>
                    <span className="font-medium">{stats.weekStats?.calls || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Activities:</span>
                    <span className="font-medium">{stats.weekStats?.activities || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">New Contacts:</span>
                    <span className="font-medium">{stats.weekStats?.contacts || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">This Month</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Messages:</span>
                    <span className="font-medium">{stats.monthStats?.messages || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Calls:</span>
                    <span className="font-medium">{stats.monthStats?.calls || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Activities:</span>
                    <span className="font-medium">{stats.monthStats?.activities || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">New Contacts:</span>
                    <span className="font-medium">{stats.monthStats?.contacts || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Property Type Distribution */}
          {stats.contactsByPropertyType && stats.contactsByPropertyType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Property Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.contactsByPropertyType.map((type, index) => (
                    <div key={type.type} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{normalizePropertyType(type.type)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${stats.totalContacts > 0 ? (type.count / stats.totalContacts) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {type.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        onContactAdded={async (contact) => {
          try {
            const response = await fetch('/api/contacts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(contact),
            });

            if (!response.ok) {
              throw new Error('Failed to add contact');
            }

            // Refresh the dashboard stats to show the new contact
            await fetchDashboardStats();
            setShowAddContact(false);
          } catch (error) {
            console.error('Error adding contact:', error);
            // Handle error (e.g., show error message to user)
          }
        }}
      />

      {/* Add Activity Dialog */}
      <Dialog open={showAddActivity} onOpenChange={setShowAddActivity}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Add Activity for {selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName}` : ""}
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
            <Button variant="outline" onClick={() => setShowAddActivity(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveActivity} disabled={!title || !dueDate}>
              Add Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// Add default export to support both import styles
export default DashboardOverview
