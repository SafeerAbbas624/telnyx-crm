"use client"

import { useActivities } from "@/lib/context/activities-context"
import { format } from "date-fns"
import { FileText, Edit3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface NotesHistoryProps {
  contactId: string
}

export function NotesHistory({ contactId }: NotesHistoryProps) {
  const { activities } = useActivities()

  // Get all note activities for this contact
  const noteActivities = activities
    .filter((activity) => activity.contactId === contactId && activity.type === "note")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-medium">Notes History</h3>
        <Badge variant="secondary">{noteActivities.length}</Badge>
      </div>

      {noteActivities.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">No notes history found for this contact.</div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {noteActivities.map((activity) => (
              <Card key={activity.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{activity.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>

                {activity.description && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
