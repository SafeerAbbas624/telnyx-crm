"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

interface NewPipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreatePipeline: (pipelineData: {
    name: string
    description?: string
    isLoanPipeline?: boolean
  }) => void
}

export default function NewPipelineDialog({
  open,
  onOpenChange,
  onCreatePipeline,
}: NewPipelineDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isLoanPipeline, setIsLoanPipeline] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Pipeline name is required",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      onCreatePipeline({
        name: name.trim(),
        description: description.trim() || undefined,
        isLoanPipeline,
      })

      toast({
        title: "Success",
        description: `Pipeline "${name}" created successfully!`,
      })

      // Reset form
      setName("")
      setDescription("")
      setIsLoanPipeline(false)
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create pipeline",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Pipeline Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Sales Pipeline, Loan Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description for this pipeline"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isLoanPipeline"
              checked={isLoanPipeline}
              onCheckedChange={(checked) => setIsLoanPipeline(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="isLoanPipeline" className="font-normal cursor-pointer">
              This is a Loan Pipeline (shows in Loan Co-Pilot)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
            {isLoading ? "Creating..." : "Create Pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

