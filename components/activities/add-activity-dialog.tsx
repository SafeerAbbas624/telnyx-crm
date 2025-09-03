"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { Activity, ActivityType } from "@/lib/types"

interface AddActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  onActivityAdded: (activity: Activity) => void
}

const activityTypes: { value: ActivityType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "task", label: "Task" },
]

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export default function AddActivityDialog({
  open,
  onOpenChange,
  contactId,
  onActivityAdded,
}: AddActivityDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: "" as ActivityType,
    title: "",
    description: "",
    dueDate: undefined as Date | undefined,
    dueTime: "",
    priority: "medium",
    location: "",
    durationMinutes: "",
    reminderMinutes: "0",
    isAllDay: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.type || !formData.title.trim()) return

    setIsLoading(true)
    try {
      // Combine date and time if both are provided
      let dueDateTime: string | undefined
      if (formData.dueDate) {
        if (formData.isAllDay) {
          // For all-day events, set to start of day
          dueDateTime = new Date(formData.dueDate.setHours(0, 0, 0, 0)).toISOString()
        } else if (formData.dueTime) {
          // Parse time and combine with date
          const [hours, minutes] = formData.dueTime.split(':').map(Number)
          const dateTime = new Date(formData.dueDate)
          dateTime.setHours(hours, minutes, 0, 0)
          dueDateTime = dateTime.toISOString()
        } else {
          // Default to start of day if no time specified
          dueDateTime = new Date(formData.dueDate.setHours(9, 0, 0, 0)).toISOString()
        }
      }

      const activityData = {
        contactId,
        type: formData.type,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        dueDate: dueDateTime,
        priority: formData.priority,
        location: formData.location.trim() || undefined,
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : undefined,
        reminderMinutes: formData.reminderMinutes && formData.reminderMinutes !== "0" ? parseInt(formData.reminderMinutes) : undefined,
        isAllDay: formData.isAllDay,
      }

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create activity')
      }

      const newActivity = await response.json()
      onActivityAdded(newActivity)
      
      // Reset form
      setFormData({
        type: "" as ActivityType,
        title: "",
        description: "",
        dueDate: undefined,
        dueTime: "",
        priority: "medium",
        location: "",
        durationMinutes: "",
        reminderMinutes: "0",
        isAllDay: false,
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating activity:', error)
      alert('Failed to create activity. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form
    setFormData({
      type: "" as ActivityType,
      title: "",
      description: "",
      dueDate: undefined,
      dueTime: "",
      priority: "medium",
      location: "",
      durationMinutes: "",
      reminderMinutes: "0",
      isAllDay: false,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Activity</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Activity Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: ActivityType) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter activity title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter activity description"
              rows={3}
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.dueDate ? format(formData.dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.dueDate}
                  onSelect={(date) => setFormData(prev => ({ ...prev, dueDate: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* All Day Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isAllDay"
              checked={formData.isAllDay}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isAllDay: checked as boolean }))
              }
            />
            <Label htmlFor="isAllDay">All day</Label>
          </div>

          {/* Due Time (only if not all day) */}
          {!formData.isAllDay && (
            <div className="space-y-2">
              <Label htmlFor="dueTime">Due Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dueTime"
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueTime: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location (for meetings) */}
          {formData.type === "meeting" && (
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Enter meeting location"
              />
            </div>
          )}

          {/* Duration (for calls and meetings) */}
          {(formData.type === "call" || formData.type === "meeting") && (
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.durationMinutes}
                onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: e.target.value }))}
                placeholder="Enter duration in minutes"
              />
            </div>
          )}

          {/* Reminder */}
          <div className="space-y-2">
            <Label htmlFor="reminder">Reminder (minutes before)</Label>
            <Select
              value={formData.reminderMinutes}
              onValueChange={(value) => setFormData(prev => ({ ...prev, reminderMinutes: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No reminder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No reminder</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="1440">1 day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !formData.type || !formData.title.trim()}
            >
              {isLoading ? "Creating..." : "Create Activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}