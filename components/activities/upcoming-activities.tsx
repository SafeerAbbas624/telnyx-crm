"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Check, X, Plus } from "lucide-react"
import { format, isPast, isToday, isTomorrow } from "date-fns"
import { useActivities } from "@/lib/context/activities-context"
import { useContacts } from "@/lib/context/contacts-context"
import type { Activity, Contact } from "@/lib/types"
import ContactName from "@/components/contacts/contact-name"


interface UpcomingActivitiesProps {
  onAddActivity?: (contact: Contact) => void
}

export default function UpcomingActivities({ onAddActivity }: UpcomingActivitiesProps) {
  const { getUpcomingActivities, updateActivity } = useActivities()
  const { contacts } = useContacts()
  const [daysAhead, setDaysAhead] = useState(7)

  const upcomingActivities = getUpcomingActivities(daysAhead)

  const getContact = (contactId: string) => {
    return contacts.find((c) => c.id === contactId)
  }

  const getContactName = (contactId: string) => {
    const contact = getContact(contactId)
    return contact ? `${contact.firstName} ${contact.lastName}` : "Unknown Contact"
  }

  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "call":
        return <span className="bg-blue-100 text-blue-800 p-1 rounded">📞</span>
      case "meeting":
        return <span className="bg-purple-100 text-purple-800 p-1 rounded">👥</span>
      case "email":
        return <span className="bg-green-100 text-green-800 p-1 rounded">✉️</span>
      case "note":
        return <span className="bg-indigo-100 text-indigo-800 p-1 rounded">💬</span>
      case "task":
        return <span className="bg-amber-100 text-amber-800 p-1 rounded">✓</span>
      case "note":
        return <span className="bg-gray-100 text-gray-800 p-1 rounded">📝</span>
    }
  }

  const getDateLabel = (dateString: string) => {
    const date = new Date(dateString)

    if (isToday(date)) {
      return "Today"
    }

    if (isTomorrow(date)) {
      return "Tomorrow"
    }

    return format(date, "MMM d, yyyy")
  }

  const handleCompleteActivity = (activity: Activity) => {
    updateActivity(activity.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    })
  }

  const handleCancelActivity = (activity: Activity) => {
    updateActivity(activity.id, {
      status: "cancelled",
    })
  }

  const handleAddActivityClick = (contactId: string) => {
    if (onAddActivity) {
      const contact = getContact(contactId)
      if (contact) {
        onAddActivity(contact)
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-medium">Upcoming Activities</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDaysAhead(3)}
            className={daysAhead === 3 ? "bg-muted" : ""}
          >
            3 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDaysAhead(7)}
            className={daysAhead === 7 ? "bg-muted" : ""}
          >
            7 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDaysAhead(14)}
            className={daysAhead === 14 ? "bg-muted" : ""}
          >
            14 Days
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {upcomingActivities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No upcoming activities</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/10">
                <div className="mt-1">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium">{activity.title}</h4>
                    <div>
                      {isPast(new Date(activity.dueDate)) && !isToday(new Date(activity.dueDate)) ? (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                          Overdue
                        </Badge>
                      ) : isToday(new Date(activity.dueDate)) ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                          Today
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                          Upcoming
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-muted-foreground">
                      <ContactName contactId={activity.contactId} className="font-medium hover:underline" clickMode="popup" />
                      {activity.description && ` - ${activity.description}`}
                    </p>

                    {onAddActivity && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleAddActivityClick(activity.contactId)}
                      >
                        <Plus size={12} className="mr-1" />
                        Add
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{getDateLabel(activity.dueDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{format(new Date(activity.dueDate), "h:mm a")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Complete"
                    onClick={() => handleCompleteActivity(activity)}
                  >
                    <Check size={16} className="text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Cancel"
                    onClick={() => handleCancelActivity(activity)}
                  >
                    <X size={16} className="text-gray-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
