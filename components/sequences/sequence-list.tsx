"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  Users,
  Mail,
  MessageSquare,
  CheckSquare,
  Zap,
  RefreshCw,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react"

interface Sequence {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    steps: number
    enrollments: number
  }
  steps: Array<{
    id: string
    type: string
    name: string | null
    orderIndex: number
    delayMinutes: number
  }>
  enrollments: Array<{
    status: string
  }>
}

// Helper to get enrollment stats
function getEnrollmentStats(enrollments: Array<{ status: string }>) {
  const stats = {
    active: 0,
    paused: 0,
    completed: 0,
    canceled: 0,
    total: enrollments.length,
  }
  enrollments.forEach((e) => {
    if (e.status === "ACTIVE") stats.active++
    else if (e.status === "PAUSED") stats.paused++
    else if (e.status === "COMPLETED") stats.completed++
    else if (e.status === "CANCELED") stats.canceled++
  })
  return stats
}

export default function SequenceList() {
  const router = useRouter()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [sequenceToDelete, setSequenceToDelete] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newSequence, setNewSequence] = useState({ name: "", description: "" })

  useEffect(() => {
    loadSequences()
  }, [])

  const loadSequences = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/sequences")
      if (!response.ok) throw new Error("Failed to load sequences")
      const data = await response.json()
      setSequences(data.sequences || [])
    } catch (error) {
      console.error("Error loading sequences:", error)
      toast.error("Failed to load sequences")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSequence = async () => {
    if (!newSequence.name.trim()) {
      toast.error("Please enter a sequence name")
      return
    }

    try {
      setCreating(true)
      const response = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSequence),
      })

      if (!response.ok) throw new Error("Failed to create sequence")
      const data = await response.json()
      
      toast.success("Sequence created successfully")
      setShowCreateDialog(false)
      setNewSequence({ name: "", description: "" })
      
      // Navigate to edit page
      router.push(`/sequences/${data.sequence.id}/edit`)
    } catch (error) {
      console.error("Error creating sequence:", error)
      toast.error("Failed to create sequence")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSequence = async () => {
    if (!sequenceToDelete) return

    try {
      const response = await fetch(`/api/sequences/${sequenceToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete sequence")
      
      toast.success("Sequence deleted successfully")
      setShowDeleteDialog(false)
      setSequenceToDelete(null)
      loadSequences()
    } catch (error) {
      console.error("Error deleting sequence:", error)
      toast.error("Failed to delete sequence")
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/sequences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (!response.ok) throw new Error("Failed to update sequence")
      
      toast.success(currentActive ? "Sequence paused" : "Sequence activated")
      loadSequences()
    } catch (error) {
      console.error("Error toggling sequence:", error)
      toast.error("Failed to update sequence")
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const response = await fetch(`/api/sequences/${id}/duplicate`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Failed to duplicate sequence")

      toast.success("Sequence duplicated successfully")
      loadSequences()
    } catch (error) {
      console.error("Error duplicating sequence:", error)
      toast.error("Failed to duplicate sequence")
    }
  }

  const getStepIcon = (type: string) => {
    switch (type) {
      case "EMAIL": return <Mail className="h-3 w-3" />
      case "SMS": return <MessageSquare className="h-3 w-3" />
      case "TASK": return <CheckSquare className="h-3 w-3" />
      default: return <Zap className="h-3 w-3" />
    }
  }

  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
    return `${Math.floor(minutes / 1440)}d`
  }

  const filteredSequences = sequences.filter(seq =>
    seq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seq.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Sequences
          </h1>
          <p className="text-muted-foreground">
            Automated multi-step outreach campaigns
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={loadSequences} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Sequences Grid */}
      {loading && sequences.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">
              {searchQuery ? "No sequences match your search" : "No sequences yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Create your first sequence to automate outreach"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Sequence
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSequences.map((sequence) => (
            <Card
              key={sequence.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/sequences/${sequence.id}/edit`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{sequence.name}</CardTitle>
                    {sequence.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {sequence.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant={sequence.isActive ? "default" : "secondary"}>
                      {sequence.isActive ? "Active" : "Paused"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/sequences/${sequence.id}/edit`)
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(sequence.id, sequence.isActive)
                        }}>
                          {sequence.isActive ? (
                            <><Pause className="h-4 w-4 mr-2" />Pause</>
                          ) : (
                            <><Play className="h-4 w-4 mr-2" />Activate</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicate(sequence.id)
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSequenceToDelete(sequence.id)
                            setShowDeleteDialog(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Steps Preview */}
                <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                  {sequence.steps.slice(0, 5).map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <div
                        className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs shrink-0"
                        title={step.name || step.type}
                      >
                        {getStepIcon(step.type)}
                        <span className="text-muted-foreground">{formatDelay(step.delayMinutes)}</span>
                      </div>
                      {idx < Math.min(sequence.steps.length - 1, 4) && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                  {sequence.steps.length > 5 && (
                    <span className="text-xs text-muted-foreground">+{sequence.steps.length - 5}</span>
                  )}
                  {sequence.steps.length === 0 && (
                    <span className="text-xs text-muted-foreground">No steps yet</span>
                  )}
                </div>

                {/* Stats */}
                {(() => {
                  const stats = getEnrollmentStats(sequence.enrollments)
                  return (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {sequence._count.steps} steps
                      </div>
                      {stats.active > 0 && (
                        <Badge variant="default" className="text-xs">
                          {stats.active} active
                        </Badge>
                      )}
                      {stats.paused > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {stats.paused} paused
                        </Badge>
                      )}
                      {stats.completed > 0 && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                          {stats.completed} completed
                        </Badge>
                      )}
                      {stats.total === 0 && (
                        <span className="text-xs text-muted-foreground">No enrollments</span>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sequence</DialogTitle>
            <DialogDescription>
              Create a new automated outreach sequence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name</Label>
              <Input
                id="name"
                placeholder="e.g., New Lead Follow-up"
                value={newSequence.name}
                onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this sequence does..."
                value={newSequence.description}
                onChange={(e) => setNewSequence({ ...newSequence, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSequence} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sequence</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this sequence? This will also remove all enrollments and logs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSequence}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

