"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

interface Template {
  id: string
  name: string
  description?: string
  type: string
  priority?: string
  durationMinutes?: number
  reminderMinutes?: number
  tags: string[]
}

export default function TaskTemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "task",
    priority: "medium",
    durationMinutes: "",
    reminderMinutes: "",
    tags: "",
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/task-templates')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast({ title: 'Error', description: 'Failed to load templates' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Template name is required' })
      return
    }

    try {
      const method = editingId ? 'PUT' : 'POST'
      const body = {
        ...formData,
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : null,
        reminderMinutes: formData.reminderMinutes ? parseInt(formData.reminderMinutes) : null,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        ...(editingId && { templateId: editingId }),
      }

      const response = await fetch('/api/task-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Failed to save')
      
      setFormData({
        name: "",
        description: "",
        type: "task",
        priority: "medium",
        durationMinutes: "",
        reminderMinutes: "",
        tags: "",
      })
      setEditingId(null)
      setShowForm(false)
      fetchTemplates()
      toast({ title: 'Success', description: editingId ? 'Template updated' : 'Template created' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save template' })
    }
  }

  const handleEdit = (template: Template) => {
    setFormData({
      name: template.name,
      description: template.description || "",
      type: template.type,
      priority: template.priority || "medium",
      durationMinutes: template.durationMinutes?.toString() || "",
      reminderMinutes: template.reminderMinutes?.toString() || "",
      tags: template.tags.join(", "),
    })
    setEditingId(template.id)
    setShowForm(true)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template?')) return

    try {
      const response = await fetch('/api/task-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchTemplates()
      toast({ title: 'Success', description: 'Template deleted' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete template' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Task Templates</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Template name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-16"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Duration (minutes)"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Reminder (minutes)"
                value={formData.reminderMinutes}
                onChange={(e) => setFormData({ ...formData, reminderMinutes: e.target.value })}
              />
            </div>
            <Input
              placeholder="Tags (comma-separated)"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingId ? 'Update' : 'Create'} Template
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setFormData({
                    name: "",
                    description: "",
                    type: "task",
                    priority: "medium",
                    durationMinutes: "",
                    reminderMinutes: "",
                    tags: "",
                  })
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No templates yet</div>
      ) : (
        <div className="grid gap-2">
          {templates.map((template) => (
            <Card key={template.id} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{template.name}</p>
                  {template.description && (
                    <p className="text-sm text-gray-600">{template.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{template.type}</Badge>
                    <Badge variant="outline">{template.priority}</Badge>
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

