"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import type { Activity } from "@/lib/types"

interface SimpleAddActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName?: string
  onActivityAdded: (activity: Activity) => void
}

export default function SimpleAddActivityDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  onActivityAdded,
}: SimpleAddActivityDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activityType, setActivityType] = useState<Activity['type']>('task')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueTime, setDueTime] = useState("09:00")

  const handleSaveActivity = async () => {
    if (!title.trim() || !dueDate) return

    setIsLoading(true)
    try {
      // Combine date and time
      const dueDateObj = new Date(`${dueDate}T${dueTime}:00`)

      const activityData = {
        contactId,
        type: activityType,
        title: title.trim(),
        description: description.trim() || '',
        dueDate: dueDateObj.toISOString(),
        status: 'planned' as const,
      }

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData),
      })

      if (!response.ok) {
        throw new Error('Failed to add activity')
      }

      const newActivity = await response.json()
      onActivityAdded(newActivity)

      // Reset form
      setTitle('')
      setDescription('')
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setDueTime("09:00")
      setActivityType('task')
      onOpenChange(false)

    } catch (error) {
      console.error('Error saving activity:', error)
      alert('Failed to add activity. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form
    setTitle('')
    setDescription('')
    setDueDate(format(new Date(), "yyyy-MM-dd"))
    setDueTime("09:00")
    setActivityType('task')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Add Activity{contactName ? ` for ${contactName}` : ""}
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
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Activity title"
            />
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
              <Input 
                id="due-date" 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-time">Due Time</Label>
              <Input 
                id="due-time" 
                type="time" 
                value={dueTime} 
                onChange={(e) => setDueTime(e.target.value)} 
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSaveActivity} disabled={!title || !dueDate || isLoading}>
            {isLoading ? 'Adding...' : 'Add Activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
