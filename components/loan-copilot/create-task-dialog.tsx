"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanTitle: string
  onCreateTask: (taskData: {
    title: string
    description: string
    dueDate: string
  }) => void
}

export default function CreateTaskDialog({
  open,
  onOpenChange,
  loanTitle,
  onCreateTask,
}: CreateTaskDialogProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
  })

  const handleCreate = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      })
      return
    }

    if (!formData.dueDate) {
      toast({
        title: "Error",
        description: "Due date is required",
        variant: "destructive",
      })
      return
    }

    onCreateTask({
      title: formData.title.trim(),
      description: formData.description.trim(),
      dueDate: formData.dueDate,
    })

    // Reset form
    setFormData({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
    })

    toast({
      title: "Success",
      description: "Task created successfully",
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task for {loanTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Task Title *</Label>
            <Input
              placeholder="e.g., Send appraisal request"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm">Description</Label>
            <Textarea
              placeholder="Add task details (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 h-24"
            />
          </div>

          <div>
            <Label className="text-sm">Due Date *</Label>
            <Input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

