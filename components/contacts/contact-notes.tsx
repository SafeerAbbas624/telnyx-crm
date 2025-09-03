"use client"

import React, { useState, useEffect } from "react"
import type { Contact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Save, X } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"
import { useToast } from "@/hooks/use-toast"
import { useActivities } from "@/lib/context/activities-context"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import { format } from "date-fns"

interface ContactNotesProps {
  contact: Contact
}

export function ContactNotes({ contact }: ContactNotesProps) {
  const { updateContact } = useContacts()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(contact.notes || "")
  const { addActivity } = useActivities()

  const noteActivities = useActivities()
    .activities.filter((activity) => activity.contactId === contact.id && activity.type === "note")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3) // Show last 3 note updates

  // Update notes state when contact changes
  useEffect(() => {
    setNotes(contact.notes || "")
  }, [contact.notes])

  const handleSaveNotes = () => {
    const previousNotes = contact.notes
    updateContact(contact.id, { notes })

    // Create an activity for the note update
    addActivity({
      id: `note-${Date.now()}`,
      contactId: contact.id,
      type: "note",
      title: previousNotes ? "Updated Notes" : "Added Notes",
      description: notes.length > 100 ? notes.substring(0, 100) + "..." : notes,
      dueDate: new Date().toISOString(),
      status: "completed",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    })

    setIsEditing(false)

    toast({
      title: "Notes saved",
      description: "Contact notes have been updated successfully",
    })
  }

  const handleCancelEdit = () => {
    setNotes(contact.notes || "")
    setIsEditing(false)
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Notes</h3>
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveNotes}>
              <Save size={16} className="mr-2" />
              Save Notes
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit size={16} className="mr-2" />
            Edit Notes
          </Button>
        )}
      </div>

      {isEditing ? (
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[200px]"
          placeholder="Add notes about this contact..."
        />
      ) : (
        <div className="bg-gray-50 p-4 rounded-md min-h-[200px]">
          <p className="whitespace-pre-line">{notes || "No notes yet."}</p>
        </div>
      )}
      {noteActivities.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Note Updates</span>
            <Badge variant="secondary" className="text-xs">
              {noteActivities.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {noteActivities.map((activity) => (
              <div key={activity.id} className="text-xs text-muted-foreground border-l-2 border-muted pl-3">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{activity.title}</span>
                  <span>{format(new Date(activity.createdAt), "MMM d, h:mm a")}</span>
                </div>
                {activity.description && (
                  <p className="mt-1 text-muted-foreground/80 line-clamp-2">{activity.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Also export as default for backward compatibility
export default ContactNotes
