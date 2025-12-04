"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Minimize2, Calendar, User, Search } from "lucide-react"
import { useTaskUI, TaskSession } from "@/lib/context/task-ui-context"
import { toast } from "sonner"
import { format } from "date-fns"

interface Contact {
  id: string
  firstName?: string
  lastName?: string
  email1?: string
  phone1?: string
  propertyAddress?: string
}

// Default task types - will be overridden by saved types from settings
const DEFAULT_TASK_TYPES = ['Follow Up', 'Call', 'Email', 'Meeting', 'Site Visit', 'Document Review', 'General']

// Main component that renders all task panels
export default function InlineTaskPanel() {
  const { taskSessions, minimizeSession, maximizeSession, closeSession } = useTaskUI()
  const [savedTaskTypes, setSavedTaskTypes] = useState<string[]>(DEFAULT_TASK_TYPES)

  // Load task types from settings
  useEffect(() => {
    const loadTaskTypes = async () => {
      try {
        const res = await fetch('/api/settings/task-types')
        if (res.ok) {
          const data = await res.json()
          if (data.taskTypes?.length > 0) {
            setSavedTaskTypes(data.taskTypes)
          }
        }
      } catch (e) {
        console.error('Failed to load task types:', e)
      }
    }
    loadTaskTypes()
  }, [])

  if (taskSessions.length === 0) return null

  return (
    <>
      {taskSessions.map((session, index) => (
        <SingleTaskPanel
          key={session.sessionId}
          session={session}
          index={index}
          savedTaskTypes={savedTaskTypes}
          onMinimize={() => minimizeSession(session.sessionId)}
          onMaximize={() => maximizeSession(session.sessionId)}
          onClose={() => closeSession(session.sessionId)}
        />
      ))}
    </>
  )
}

// Individual task panel component
function SingleTaskPanel({
  session,
  index,
  savedTaskTypes,
  onMinimize,
  onMaximize,
  onClose
}: {
  session: TaskSession
  index: number
  savedTaskTypes: string[]
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(session.title || "")
  const [description, setDescription] = useState(session.description || "")
  const [dueDate, setDueDate] = useState(session.dueDate || "")
  const [priority, setPriority] = useState(session.priority || "medium")
  const [taskType, setTaskType] = useState(session.taskType || "Follow Up")
  const [selectedContactId, setSelectedContactId] = useState<string>(session.contactId || "")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState("")
  const [showContactSearch, setShowContactSearch] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load contacts on mount
  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      const response = await fetch('/api/contacts?limit=500')
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('[Task Panel] Failed to load contacts:', error)
    }
  }

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch) return true
    const search = contactSearch.toLowerCase()
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
    return name.includes(search) || c.propertyAddress?.toLowerCase().includes(search)
  })

  const selectedContact = contacts.find(c => c.id === selectedContactId)
  const contactDisplayName = selectedContact
    ? `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim()
    : session.contact
      ? `${session.contact.firstName || ''} ${session.contact.lastName || ''}`.trim()
      : ''

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title')
      return
    }

    setIsSaving(true)
    try {
      // Use noon as default time if only date is provided (avoids timezone issues)
      const dueDateTime = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null

      const payload = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'planned',
        dueDate: dueDateTime,
        type: 'task',
        taskType,
        contactId: selectedContactId || null,
      }

      const url = session.isEditMode && session.taskId
        ? `/api/activities/${session.taskId}`
        : '/api/activities'
      const method = session.isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success(session.isEditMode ? 'Task updated!' : 'Task created!')
        onClose()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save task')
      }
    } catch (error) {
      console.error('[Task Panel] Save error:', error)
      toast.error('Failed to save task')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate position offset for stacking multiple panels
  const offsetX = index * 30
  const offsetY = index * 30

  // Minimized state
  if (session.isMinimized) {
    return (
      <div
        className="fixed bottom-0 z-50"
        style={{ left: `${520 + (index * 140)}px` }}
      >
        <Button
          onClick={onMaximize}
          className="bg-orange-600 hover:bg-orange-700 rounded-b-none h-8 text-sm max-w-[130px] truncate"
        >
          <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
          <span className="truncate">{title || 'Task'}</span>
        </Button>
      </div>
    )
  }

  return (
    <div
      className="fixed z-50 w-[380px] shadow-2xl rounded-lg overflow-hidden border-2 border-orange-500"
      style={{
        bottom: `${16 + offsetY}px`,
        left: `${520 + offsetX}px`
      }}
    >
      {/* Header */}
      <div className="bg-orange-600 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            {session.isEditMode ? 'Edit Task' : 'New Task'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-orange-700" onClick={onMinimize}>
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-orange-700" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="bg-white p-3 space-y-2">
        {/* Title - Most important, at top */}
        <div className="space-y-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title... *"
            className="h-9 text-sm font-medium"
            autoFocus
          />
        </div>

        {/* Row: Contact + Due Date + Priority */}
        <div className="flex gap-2 items-end">
          {/* Contact Selector */}
          <div className="flex-1">
            {showContactSearch ? (
              <div className="space-y-1">
                <div className="flex gap-1">
                  <Input
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="h-8 text-xs flex-1"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowContactSearch(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="max-h-28 overflow-y-auto border rounded text-xs bg-white absolute z-10 w-[200px] shadow-lg">
                  {filteredContacts.slice(0, 8).map((contact) => (
                    <button
                      key={contact.id}
                      className="w-full px-2 py-1.5 text-left hover:bg-gray-100 border-b last:border-b-0"
                      onClick={() => {
                        setSelectedContactId(contact.id)
                        setShowContactSearch(false)
                        setContactSearch("")
                      }}
                    >
                      <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                      {contact.propertyAddress && (
                        <div className="text-[10px] text-gray-500 truncate">{contact.propertyAddress}</div>
                      )}
                    </button>
                  ))}
                  {filteredContacts.length === 0 && (
                    <div className="px-2 py-1.5 text-gray-400 text-xs">No contacts found</div>
                  )}
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs justify-start truncate"
                onClick={() => setShowContactSearch(true)}
              >
                <User className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">{contactDisplayName || 'Contact'}</span>
              </Button>
            )}
          </div>

          {/* Due Date */}
          <div className="w-[120px]">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
              title="Due date"
            />
          </div>

          {/* Priority */}
          <div className="w-[90px]">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="text-xs">🟢 Low</SelectItem>
                <SelectItem value="medium" className="text-xs">🟡 Medium</SelectItem>
                <SelectItem value="high" className="text-xs">🔴 High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row: Task Type + Notes */}
        <div className="flex gap-2 items-start">
          {/* Task Type */}
          <div className="w-[130px]">
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                {savedTaskTypes.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description - Optional, compact */}
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes (optional)..."
            className="flex-1 min-h-[32px] max-h-[50px] text-xs resize-none"
            rows={1}
          />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !title.trim()}
          className="w-full bg-orange-600 hover:bg-orange-700 h-8 text-sm"
        >
          {isSaving ? 'Saving...' : session.isEditMode ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </div>
  )
}

