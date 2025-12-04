"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Plus, X, Loader2 } from "lucide-react"

export default function TaskTypesSettings() {
  const [taskTypes, setTaskTypes] = useState<string[]>([])
  const [newTaskType, setNewTaskType] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadTaskTypes()
  }, [])

  const loadTaskTypes = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings/task-types')
      if (response.ok) {
        const data = await response.json()
        setTaskTypes(data.taskTypes || [])
      }
    } catch (error) {
      console.error('Error loading task types:', error)
      toast.error('Failed to load task types')
    } finally {
      setIsLoading(false)
    }
  }

  const addTaskType = async () => {
    if (!newTaskType.trim()) {
      toast.error('Please enter a task type name')
      return
    }

    if (taskTypes.includes(newTaskType.trim())) {
      toast.error('This task type already exists')
      return
    }

    try {
      setIsSaving(true)
      const updatedTypes = [...taskTypes, newTaskType.trim()]

      console.log('Saving task types:', updatedTypes)

      const response = await fetch('/api/settings/task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTypes: updatedTypes }),
      })

      const data = await response.json()
      console.log('Response:', data)

      if (response.ok) {
        setTaskTypes(updatedTypes)
        setNewTaskType('')
        toast.success('Task type added successfully')
      } else {
        toast.error(data.error || 'Failed to add task type')
      }
    } catch (error) {
      console.error('Error adding task type:', error)
      toast.error('Failed to add task type: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const removeTaskType = async (typeToRemove: string) => {
    try {
      setIsSaving(true)
      const updatedTypes = taskTypes.filter(t => t !== typeToRemove)
      
      const response = await fetch('/api/settings/task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTypes: updatedTypes }),
      })

      if (response.ok) {
        setTaskTypes(updatedTypes)
        toast.success('Task type removed successfully')
      } else {
        toast.error('Failed to remove task type')
      }
    } catch (error) {
      console.error('Error removing task type:', error)
      toast.error('Failed to remove task type')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Types</CardTitle>
        <CardDescription>
          Manage custom task types for your organization. These will appear as options when creating tasks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Task Type */}
        <div className="space-y-2">
          <Label htmlFor="newTaskType">Add New Task Type</Label>
          <div className="flex gap-2">
            <Input
              id="newTaskType"
              placeholder="e.g., Dan Task, Joe Task, Follow-up Call"
              value={newTaskType}
              onChange={(e) => setNewTaskType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addTaskType()
                }
              }}
            />
            <Button onClick={addTaskType} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Existing Task Types */}
        <div className="space-y-2">
          <Label>Existing Task Types ({taskTypes.length})</Label>
          {taskTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom task types yet. Add one above to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {taskTypes.map((type) => (
                <Badge key={type} variant="secondary" className="text-sm py-1 px-3">
                  {type}
                  <button
                    onClick={() => removeTaskType(type)}
                    className="ml-2 hover:text-destructive"
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

