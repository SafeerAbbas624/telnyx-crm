"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, Pin, PinOff } from "lucide-react"

interface Note {
  id: string
  content: string
  createdAt: Date
  isPinned: boolean
  createdBy: string
}

interface LoanNotesTabProps {
  loanId: string
  notes: Note[]
  onAddNote: (content: string) => void
  onDeleteNote: (noteId: string) => void
  onTogglePinNote: (noteId: string) => void
}

export default function LoanNotesTab({
  loanId,
  notes,
  onAddNote,
  onDeleteNote,
  onTogglePinNote,
}: LoanNotesTabProps) {
  const [newNote, setNewNote] = useState('')

  const handleAddNote = () => {
    if (newNote.trim()) {
      onAddNote(newNote)
      setNewNote('')
    }
  }

  const pinnedNotes = notes.filter(n => n.isPinned)
  const unpinnedNotes = notes.filter(n => !n.isPinned)

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Add Note */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <Button onClick={handleAddNote} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {/* Pinned Notes */}
          {pinnedNotes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Pinned</h3>
              <div className="space-y-2 mb-4">
                {pinnedNotes.map((note) => (
                  <Card key={note.id} className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {note.createdBy}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(note.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => onTogglePinNote(note.id)}
                          >
                            <PinOff className="h-4 w-4 text-yellow-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => onDeleteNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Unpinned Notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Recent</h3>
              )}
              <div className="space-y-2">
                {unpinnedNotes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {note.createdBy}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(note.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => onTogglePinNote(note.id)}
                          >
                            <Pin className="h-4 w-4 text-gray-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => onDeleteNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {notes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No notes yet. Add your first note above.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

