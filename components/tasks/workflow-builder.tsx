"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface Workflow {
  id: string
  name: string
  trigger: string
  enabled: boolean
  createdAt: string
}

export default function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    trigger: "deal_stage_change",
    action: JSON.stringify({ type: "create_task", title: "" }),
  })

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tasks/workflows')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setWorkflows(data)
    } catch (error) {
      console.error('Error fetching workflows:', error)
      toast({ title: 'Error', description: 'Failed to load workflows' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Workflow name is required' })
      return
    }

    try {
      const method = editingId ? 'PUT' : 'POST'
      const body = {
        ...formData,
        action: JSON.parse(formData.action),
        ...(editingId && { workflowId: editingId }),
      }

      const response = await fetch('/api/tasks/workflows', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Failed to save')
      
      setFormData({
        name: "",
        trigger: "deal_stage_change",
        action: JSON.stringify({ type: "create_task", title: "" }),
      })
      setEditingId(null)
      setShowForm(false)
      fetchWorkflows()
      toast({ title: 'Success', description: editingId ? 'Workflow updated' : 'Workflow created' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save workflow' })
    }
  }

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Delete this workflow?')) return

    try {
      const response = await fetch('/api/tasks/workflows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId }),
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchWorkflows()
      toast({ title: 'Success', description: 'Workflow deleted' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete workflow' })
    }
  }

  const getTriggerLabel = (trigger: string) => {
    const labels: Record<string, string> = {
      deal_stage_change: "Deal Stage Change",
      contact_import: "Contact Import",
      task_completed: "Task Completed",
      task_overdue: "Task Overdue",
    }
    return labels[trigger] || trigger
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Task Workflows</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Workflow name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Select value={formData.trigger} onValueChange={(value) => setFormData({ ...formData, trigger: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deal_stage_change">Deal Stage Change</SelectItem>
                <SelectItem value="contact_import">Contact Import</SelectItem>
                <SelectItem value="task_completed">Task Completed</SelectItem>
                <SelectItem value="task_overdue">Task Overdue</SelectItem>
              </SelectContent>
            </Select>
            <div>
              <label className="text-sm font-medium">Action (JSON)</label>
              <textarea
                className="w-full p-2 border rounded text-sm font-mono"
                rows={4}
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                placeholder='{"type": "create_task", "title": "Follow up"}'
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingId ? 'Update' : 'Create'} Workflow
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setFormData({
                    name: "",
                    trigger: "deal_stage_change",
                    action: JSON.stringify({ type: "create_task", title: "" }),
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
      ) : workflows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No workflows yet</div>
      ) : (
        <div className="grid gap-2">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{workflow.name}</p>
                    <Badge variant={workflow.enabled ? "default" : "secondary"}>
                      {workflow.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    Trigger: {getTriggerLabel(workflow.trigger)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(workflow.id)}
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

