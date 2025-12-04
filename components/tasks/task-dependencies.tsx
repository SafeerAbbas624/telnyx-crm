"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2, Link2 } from "lucide-react"
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

interface Dependency {
  id: string
  dependencyType: string
  dependsOn: {
    id: string
    title: string
    status: string
  }
  dependent: {
    id: string
    title: string
    status: string
  }
}

interface TaskDependenciesProps {
  taskId: string
}

export default function TaskDependencies({ taskId }: TaskDependenciesProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    dependentId: "",
    dependencyType: "blocks",
  })

  useEffect(() => {
    fetchDependencies()
  }, [taskId])

  const fetchDependencies = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tasks/dependencies?taskId=${taskId}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setDependencies(data)
    } catch (error) {
      console.error('Error fetching dependencies:', error)
      toast({ title: 'Error', description: 'Failed to load dependencies' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.dependentId.trim()) {
      toast({ title: 'Error', description: 'Please enter a task ID' })
      return
    }

    try {
      const response = await fetch('/api/tasks/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependsOnId: taskId,
          dependentId: formData.dependentId,
          dependencyType: formData.dependencyType,
        }),
      })

      if (!response.ok) throw new Error('Failed to create')
      
      setFormData({ dependentId: "", dependencyType: "blocks" })
      setShowForm(false)
      fetchDependencies()
      toast({ title: 'Success', description: 'Dependency created' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create dependency' })
    }
  }

  const handleDelete = async (dependencyId: string) => {
    try {
      const response = await fetch('/api/tasks/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId }),
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchDependencies()
      toast({ title: 'Success', description: 'Dependency deleted' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete dependency' })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'planned':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Task Dependencies
        </h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Dependency
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Dependent Task ID</label>
              <Input
                placeholder="Enter task ID"
                value={formData.dependentId}
                onChange={(e) => setFormData({ ...formData, dependentId: e.target.value })}
              />
            </div>
            <Select value={formData.dependencyType} onValueChange={(value) => setFormData({ ...formData, dependencyType: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blocks">Blocks</SelectItem>
                <SelectItem value="blocked_by">Blocked By</SelectItem>
                <SelectItem value="related">Related</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Create Dependency
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setFormData({ dependentId: "", dependencyType: "blocks" })
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
      ) : dependencies.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No dependencies</div>
      ) : (
        <div className="space-y-2">
          {dependencies.map((dep) => (
            <Card key={dep.id} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{dep.dependsOn.title}</span>
                    <Badge variant="outline">{dep.dependencyType}</Badge>
                    <span className="text-sm font-medium">{dep.dependent.title}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getStatusColor(dep.dependsOn.status)}>
                      {dep.dependsOn.status}
                    </Badge>
                    <Badge className={getStatusColor(dep.dependent.status)}>
                      {dep.dependent.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(dep.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

