"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PlusCircle, Calendar, CheckCircle, XCircle, Info, MapPin, Clock, Trash2, Phone, Mail, FileText } from "lucide-react"
import { useActivities } from "@/lib/context/activities-context"
import { format, parseISO } from "date-fns"
import type { Activity, Contact } from "@/lib/types"

interface ContactActivitiesProps {
  contactId: string
}

const getActivityIcon = (type: Activity["type"]) => {
  switch (type) {
    case "call":
      return <Info className="h-4 w-4 text-blue-500" />
    case "meeting":
      return <Calendar className="h-4 w-4 text-green-500" />
    case "email":
      return <Info className="h-4 w-4 text-purple-500" />
    case "note":
      return <Info className="h-4 w-4 text-yellow-500" />
    case "task":
      return <CheckCircle className="h-4 w-4 text-orange-500" />
    case "note":
      return <Info className="h-4 w-4 text-gray-500" />
    default:
      return <Info className="h-4 w-4 text-gray-500" />
  }
}

const getActivityStatusIcon = (status: Activity["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "cancelled":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "planned":
    default:
      return <Calendar className="h-4 w-4 text-blue-500" />
  }
}

const getPriorityColor = (priority?: Activity["priority"]) => {
  switch (priority) {
    case "urgent":
      return "text-red-600 bg-red-50"
    case "high":
      return "text-orange-600 bg-orange-50"
    case "medium":
      return "text-blue-600 bg-blue-50"
    case "low":
      return "text-gray-600 bg-gray-50"
    default:
      return "text-gray-600 bg-gray-50"
  }
}

export default function ContactActivities({ contactId }: ContactActivitiesProps) {
  const { activities, loading, refreshActivities } = useActivities()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [activityType, setActivityType] = useState<Activity['type']>('task')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueTime, setDueTime] = useState("09:00")

  const contactActivities = activities.filter((activity) => activity.contactId === contactId)

  const handleSaveActivity = async () => {
    if (!title.trim()) return

    try {
      // Combine date and time
      const dueDateObj = new Date(`${dueDate}T${dueTime}:00`)

      const activityData = {
        contactId: contactId,
        type: activityType,
        title: title.trim(),
        description: description.trim() || '',
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

      // Refresh the activities context
      await refreshActivities();

      // Reset form
      setTitle('');
      setDescription('');
      setDueDate(format(new Date(), "yyyy-MM-dd"));
      setDueTime("09:00");
      setShowAddDialog(false);

    } catch (error) {
      console.error('Error saving activity:', error);
    }
  }

  // Handle activity click for editing
  const handleActivityClick = (activity: Activity) => {
    setActivityType(activity.type)
    setTitle(activity.title)
    setDescription(activity.description || '')

    if (activity.dueDate) {
      const dueDate = new Date(activity.dueDate)
      setDueDate(format(dueDate, "yyyy-MM-dd"))
      setDueTime(format(dueDate, "HH:mm"))
    }

    setShowAddDialog(true)
  }

  // Handle completing an activity
  const handleCompleteActivity = async (activity: Activity) => {
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
        throw new Error('Failed to complete activity')
      }

      // Refresh the activities context
      await refreshActivities()

      // Show popup for next activity
      setActivityType('task')
      setTitle('')
      setDescription('')
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setDueTime("09:00")
      setShowAddDialog(true)
    } catch (error) {
      console.error('Error completing activity:', error)
    }
  }

  // Handle deleting an activity
  const handleDeleteActivity = async (activity: Activity) => {
    if (!confirm('Are you sure you want to delete this activity?')) {
      return
    }

    try {
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete activity')
      }

      // Refresh the activities context
      await refreshActivities()
    } catch (error) {
      console.error('Error deleting activity:', error)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Activities</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowAddDialog(true)}>
          <PlusCircle className="h-4 w-4 mr-2" /> Add Activity
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading activities...</div>
        ) : contactActivities.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No activities found for this contact.</div>
        ) : (
          <ScrollArea className="h-[calc(100vh-400px)]">
            {" "}
            {/* Adjust height as needed */}
            <div className="space-y-3">
              {contactActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Activity Details - Clickable Section */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => handleActivityClick(activity)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                          {activity.type === 'email' && <Mail className="h-4 w-4 text-green-500" />}
                          {activity.type === 'meeting' && <Calendar className="h-4 w-4 text-purple-500" />}
                          {activity.type === 'task' && <CheckCircle className="h-4 w-4 text-orange-500" />}
                          {activity.type === 'note' && <FileText className="h-4 w-4 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{activity.title}</h4>
                              {activity.priority && (
                                <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(activity.priority)}`}>
                                  {activity.priority}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-sm text-gray-500">
                              {getActivityStatusIcon(activity.status)}
                              <span className="capitalize">{activity.status}</span>
                            </div>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                          )}

                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>📅 {activity.dueDate ? format(parseISO(activity.dueDate), "MMM dd, yyyy h:mm a") : "N/A"}</span>
                            </div>
                            {activity.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>{activity.location}</span>
                              </div>
                            )}
                            {activity.durationMinutes && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{activity.durationMinutes} min</span>
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-gray-500 mt-1">
                            Created: {format(parseISO(activity.createdAt), "MMM dd, yyyy h:mm a")}
                          </p>
                          {activity.completedAt && (
                            <p className="text-xs text-gray-500">
                              Completed: {format(parseISO(activity.completedAt), "MMM dd, yyyy h:mm a")}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 ml-4">
                        {activity.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCompleteActivity(activity)
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
                            handleDeleteActivity(activity)
                          }}
                          title="Delete activity"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Add Activity Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveActivity} disabled={!title || !dueDate}>
              Add Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
