"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  User,
  Phone,
  Mail,
  MessageSquare,
  Edit,
  Trash2
} from "lucide-react"
import ContactName from "@/components/contacts/contact-name"
import { useTaskUI } from "@/lib/context/task-ui-context"

import { format, isPast, isToday, isBefore, addDays, addMonths } from "date-fns"

interface Activity {
  id: string
  type: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  completedAt?: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email1?: string
    phone1?: string
  }
  createdAt: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email1?: string
  phone1?: string
}

type TaskFilter = "overdue-today" | "next-7-days" | "next-month" | "all-time"

export default function TeamActivities() {
  const { toast } = useToast()
  const { openTask } = useTaskUI()
  const [activities, setActivities] = useState<Activity[]>([])
  const [assignedContacts, setAssignedContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("overdue-today")
  const [formData, setFormData] = useState({
    type: "call",
    title: "",
    description: "",
    contactId: "",
    priority: "medium",
    dueDate: ""
  })

  useEffect(() => {
    loadActivities()
    loadAssignedContacts()
  }, [])

  const loadActivities = async () => {
    try {
      const response = await fetch('/api/team/activities?limit=500')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAssignedContacts = async () => {
    try {
      const response = await fetch('/api/team/assigned-contacts')
      if (response.ok) {
        const data = await response.json()
        setAssignedContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Error loading assigned contacts:', error)
    }
  }


  const handleActivityClick = (activity: Activity) => {
    setEditingActivity(activity)
    setFormData({
      type: activity.type,
      title: activity.title,
      description: activity.description || "",
      contactId: activity.contact.id,
      priority: activity.priority || "medium",
      dueDate: activity.dueDate ? new Date(activity.dueDate).toISOString().slice(0, 16) : ""
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateActivity = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingActivity) return

    try {
      const response = await fetch(`/api/team/activities/${editingActivity.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setEditingActivity(null)
        setFormData({
          type: "call",
          title: "",
          description: "",
          contactId: "",
          priority: "medium",
          dueDate: ""
        })
        loadActivities()
        toast({
          title: "Success",
          description: "Activity updated successfully",
        })
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to update activity",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating activity",
        variant: "destructive",
      })
    }
  }

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const response = await fetch(`/api/team/activities/${activityId}/complete`, {
        method: 'POST',
      })

      if (response.ok) {
        loadActivities()
        toast({
          title: "Success",
          description: "Activity marked as complete",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete activity",
        variant: "destructive",
      })
    }
  }

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) {
      return
    }

    try {
      const response = await fetch(`/api/team/activities/${activityId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadActivities()
        toast({
          title: "Success",
          description: "Activity deleted successfully",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete activity",
        variant: "destructive",
      })
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return Phone
      case 'meeting': return Calendar
      case 'email': return Mail
      case 'task': return CheckCircle
      case 'note': return Edit
      default: return Calendar
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call': return 'text-blue-600'
      case 'email': return 'text-green-600'
      case 'meeting': return 'text-purple-600'
      case 'follow_up': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  // Filter activities based on selected time period
  const getFilteredActivities = () => {
    const now = new Date()
    const nextWeek = addDays(now, 7)
    const nextMonth = addMonths(now, 1)

    return activities.filter((activity) => {
      // Handle null/undefined dueDate
      if (!activity.dueDate) {
        // If no due date, only show in "all-time" filter
        return taskFilter === "all-time"
      }

      const dueDate = new Date(activity.dueDate)

      // Check if date is valid
      if (isNaN(dueDate.getTime())) {
        console.warn('Invalid due date for activity:', activity.id, activity.dueDate)
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

  const filteredActivities = getFilteredActivities()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">My Activities</h2>
            <p className="text-sm text-muted-foreground">
              Manage your tasks and activities with assigned contacts
            </p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => openTask()}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>

          {/* Edit Activity Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Activity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateActivity} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Activity Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="note">Notes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Activity title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Activity description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-contact">Contact</Label>
                  <Select
                    value={formData.contactId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, contactId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.firstName} {contact.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-dueDate">Due Date</Label>
                    <Input
                      id="edit-dueDate"
                      type="datetime-local"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Update Activity</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Filter:</span>
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

      {/* Activities List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Filter Title */}
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold">
              {taskFilter === "overdue-today" && "Overdue & Today's Tasks"}
              {taskFilter === "next-7-days" && "Next 7 Days Tasks"}
              {taskFilter === "next-month" && "Next Month Tasks"}
              {taskFilter === "all-time" && "All Tasks"}
            </h3>
            <Badge variant="outline">{filteredActivities.length}</Badge>
          </div>
          {filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Activities</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first activity to start managing your tasks
                  </p>
                  <Button onClick={() => openTask()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredActivities.map((activity) => {
              const ActivityIcon = getActivityIcon(activity.type)
              return (
                <div key={activity.id} className="border rounded-lg hover:bg-gray-50 transition-colors">
                  {/* Contact Information - Top Section */}
                  {activity.contact && (
                    <div className="p-3 bg-gray-50 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {activity.contact.firstName?.[0] || ''}{activity.contact.lastName?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              <ContactName contact={{...activity.contact} as any} clickMode="popup" stopPropagation />
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {activity.contact.phone1 && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {activity.contact.phone1}
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
                              onClick={(e) => { e.stopPropagation(); handleCompleteActivity(activity.id) }}
                              title="Mark as completed"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteActivity(activity.id) }}
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task Details - Bottom Section */}
                  <div className="p-4 cursor-pointer" onClick={() => handleActivityClick(activity)}>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        <ActivityIcon className={`h-4 w-4 ${getActivityColor(activity.type)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={activity.status === 'completed' ? 'default' : 'secondary'}
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
    </div>
  )
}
