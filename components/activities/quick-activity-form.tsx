"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { useActivities } from "@/lib/context/activities-context"
import { useContacts } from "@/lib/context/contacts-context"
import { Switch } from "@/components/ui/switch"
import type { ActivityType } from "@/lib/types"

export default function QuickActivityForm() {
  const { contacts } = useContacts()
  const { addActivity } = useActivities()

  const [contactId, setContactId] = useState("")
  const [activityType, setActivityType] = useState<ActivityType>("task")
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueTime, setDueTime] = useState("09:00")
  const [includeTime, setIncludeTime] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!contactId || !title || !dueDate) return

    // Combine date and time if time is included, otherwise just use the date
    let dueDateObj: Date
    if (includeTime && dueTime) {
      dueDateObj = new Date(`${dueDate}T${dueTime}:00`)
    } else {
      dueDateObj = new Date(`${dueDate}T12:00:00`) // Default to noon if no time specified
    }

    const newActivity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contactId,
      type: activityType,
      title,
      description: "",
      dueDate: dueDateObj.toISOString(),
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    }

    addActivity(newActivity)

    // Reset form
    setTitle("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-md font-medium">Quick Add Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact">Contact</Label>
            <Select value={contactId} onValueChange={setContactId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-type">Activity Type</Label>
            <Select value={activityType} onValueChange={(value) => setActivityType(value as ActivityType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="text">Text Message</SelectItem>
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
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="include-time" className="cursor-pointer">
                Include specific time
              </Label>
              <Switch id="include-time" checked={includeTime} onCheckedChange={setIncludeTime} />
            </div>

            {includeTime && (
              <div className="space-y-2">
                <Label htmlFor="due-time">Due Time</Label>
                <Input id="due-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!contactId || !title || !dueDate}>
            Add Activity
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
