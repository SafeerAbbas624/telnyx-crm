"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Trash2, GripVertical, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Stage {
  id: string
  name: string
  order: number
}

interface EditStagesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stages: Stage[]
  onSaveStages: (stages: Stage[]) => void
}

export default function EditStagesDialog({
  open,
  onOpenChange,
  stages: initialStages,
  onSaveStages,
}: EditStagesDialogProps) {
  const { toast } = useToast()
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [isLoading, setIsLoading] = useState(false)

  const handleAddStage = () => {
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: "New Stage",
      order: Math.max(...stages.map(s => s.order), 0) + 1,
    }
    setStages([...stages, newStage])
  }

  const handleUpdateStageName = (id: string, name: string) => {
    setStages(stages.map(s => (s.id === id ? { ...s, name } : s)))
  }

  const handleDeleteStage = (id: string) => {
    if (stages.length <= 1) {
      toast({
        title: "Error",
        description: "Pipeline must have at least one stage",
        variant: "destructive",
      })
      return
    }
    setStages(stages.filter(s => s.id !== id))
  }

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    const newStages = [...stages]
    if (direction === "up" && index > 0) {
      [newStages[index], newStages[index - 1]] = [newStages[index - 1], newStages[index]]
    } else if (direction === "down" && index < newStages.length - 1) {
      [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]]
    }
    setStages(newStages)
  }

  const handleSave = () => {
    if (stages.length === 0) {
      toast({
        title: "Error",
        description: "Pipeline must have at least one stage",
        variant: "destructive",
      })
      return
    }

    // Check for duplicate names
    const names = stages.map(s => s.name.trim())
    if (new Set(names).size !== names.length) {
      toast({
        title: "Error",
        description: "Stage names must be unique",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Update order based on current position
      const updatedStages = stages.map((stage, index) => ({
        ...stage,
        order: index,
      }))

      onSaveStages(updatedStages)

      toast({
        title: "Success",
        description: "Stages updated successfully!",
      })

      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update stages",
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
          <DialogTitle>Edit Pipeline Stages</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <ScrollArea className="h-[300px] border rounded-md p-4">
            <div className="space-y-3">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-2 p-3 bg-muted rounded-md"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                  <Input
                    value={stage.name}
                    onChange={(e) => handleUpdateStageName(stage.id, e.target.value)}
                    placeholder="Stage name"
                    disabled={isLoading}
                    className="flex-1"
                  />

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveStage(index, "up")}
                      disabled={isLoading || index === 0}
                      className="h-8 w-8 p-0"
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveStage(index, "down")}
                      disabled={isLoading || index === stages.length - 1}
                      className="h-8 w-8 p-0"
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteStage(stage.id)}
                      disabled={isLoading || stages.length === 1}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button
            onClick={handleAddStage}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stage
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Stages"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

