"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TemplateVariableSelector } from "@/components/ui/template-variable-selector"
import { toast } from "sonner"
import {
  ArrowLeft,
  Plus,
  Save,
  Play,
  Pause,
  Trash2,
  GripVertical,
  Mail,
  MessageSquare,
  CheckSquare,
  Phone,
  Mic,
  Clock,
  Users,
  Loader2,
  Settings,
  ChevronDown,
  ChevronUp,
  Edit,
  Zap,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface SequenceStep {
  id: string
  sequenceId: string
  orderIndex: number
  type: "EMAIL" | "SMS" | "TASK" | "VOICEMAIL_DROP" | "AI_CALL"
  name: string | null
  delayMinutes: number
  config: any
  createdAt: string
  updatedAt: string
}

interface Sequence {
  id: string
  name: string
  description: string | null
  isActive: boolean
  pipelineId: string | null
  createdAt: string
  updatedAt: string
  steps: SequenceStep[]
  _count: {
    steps: number
    enrollments: number
  }
}

interface SequenceEditorProps {
  sequenceId: string
}

const STEP_TYPES = [
  { value: "EMAIL", label: "Email", icon: Mail, color: "bg-blue-100 text-blue-700" },
  { value: "SMS", label: "SMS", icon: MessageSquare, color: "bg-green-100 text-green-700" },
  { value: "TASK", label: "Task", icon: CheckSquare, color: "bg-purple-100 text-purple-700" },
  { value: "WAIT", label: "Wait for Condition", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  { value: "VOICEMAIL_DROP", label: "Voicemail Drop", icon: Phone, color: "bg-orange-100 text-orange-700", disabled: true },
  { value: "AI_CALL", label: "AI Call", icon: Mic, color: "bg-pink-100 text-pink-700", disabled: true },
]

const WAIT_CONDITIONS = [
  { value: "REPLY", label: "Contact replies (SMS or Email)" },
  { value: "NO_REPLY", label: "No reply within time window" },
  { value: "EMAIL_OPEN", label: "Contact opens email" },
  { value: "LINK_CLICK", label: "Contact clicks link in email" },
]

const DELAY_PRESETS = [
  { value: 0, label: "Immediately" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 4320, label: "3 days" },
  { value: 10080, label: "1 week" },
]

// Sortable Step Item Component
function SortableStepItem({
  step,
  index,
  onEdit,
  onDelete,
  isExpanded,
  onToggleExpand,
}: {
  step: SequenceStep
  index: number
  onEdit: (step: SequenceStep) => void
  onDelete: (stepId: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const stepType = STEP_TYPES.find((t) => t.value === step.type)
  const StepIcon = stepType?.icon || Zap

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return "Immediately"
    if (minutes < 60) return `${minutes} min`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hr${minutes >= 120 ? "s" : ""}`
    return `${Math.floor(minutes / 1440)} day${minutes >= 2880 ? "s" : ""}`
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Connection line */}
      {index > 0 && (
        <div className="absolute left-6 -top-4 w-0.5 h-4 bg-gray-300" />
      )}
      
      <Card className={`${isDragging ? "shadow-lg" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
            >
              <GripVertical className="h-5 w-5 text-gray-400" />
            </div>

            {/* Step number */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium">
              {index + 1}
            </div>

            {/* Step type icon */}
            <div className={`p-2 rounded-lg ${stepType?.color || "bg-gray-100"}`}>
              <StepIcon className="h-4 w-4" />
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {step.name || stepType?.label || step.type}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {formatDelay(step.delayMinutes)} after previous
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(step)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(step.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleExpand}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expanded config preview */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
              <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                {JSON.stringify(step.config, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Main SequenceEditor Component
export default function SequenceEditor({ sequenceId }: SequenceEditorProps) {
  const router = useRouter()
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  // Refs for variable insertion
  const smsMessageRef = useRef<HTMLTextAreaElement>(null)
  const emailSubjectRef = useRef<HTMLInputElement>(null)
  const emailBodyRef = useRef<HTMLTextAreaElement>(null)

  // Step dialog state
  const [showStepDialog, setShowStepDialog] = useState(false)
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)
  const [stepForm, setStepForm] = useState({
    type: "EMAIL" as SequenceStep["type"],
    name: "",
    delayMinutes: 0,
    config: {} as any,
  })

  // Settings dialog state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
  })

  // Bulk enroll dialog state
  const [showBulkEnrollDialog, setShowBulkEnrollDialog] = useState(false)
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([])
  const [selectedTagId, setSelectedTagId] = useState<string>("")
  const [enrolling, setEnrolling] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadSequence()
  }, [sequenceId])

  const loadSequence = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/sequences/${sequenceId}`)
      if (!response.ok) throw new Error("Failed to load sequence")
      const data = await response.json()
      setSequence(data.sequence)
      setSettingsForm({
        name: data.sequence.name,
        description: data.sequence.description || "",
      })
    } catch (error) {
      console.error("Error loading sequence:", error)
      toast.error("Failed to load sequence")
      router.push("/sequences")
    } finally {
      setLoading(false)
    }
  }

  const loadTags = async () => {
    try {
      const response = await fetch("/api/tags")
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags || [])
      }
    } catch (error) {
      console.error("Error loading tags:", error)
    }
  }

  const handleBulkEnroll = async () => {
    if (!selectedTagId) {
      toast.error("Please select a tag")
      return
    }

    try {
      setEnrolling(true)
      const response = await fetch(`/api/sequences/${sequenceId}/enrollments/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: selectedTagId }),
      })

      if (!response.ok) throw new Error("Failed to enroll contacts")
      const data = await response.json()

      toast.success(`Enrolled ${data.enrolled} contacts${data.skipped > 0 ? ` (${data.skipped} already enrolled)` : ""}`)
      setShowBulkEnrollDialog(false)
      setSelectedTagId("")
      loadSequence()
    } catch (error) {
      console.error("Error bulk enrolling:", error)
      toast.error("Failed to enroll contacts")
    } finally {
      setEnrolling(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!sequence) return

    try {
      setSaving(true)
      const response = await fetch(`/api/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      })

      if (!response.ok) throw new Error("Failed to save settings")
      const data = await response.json()
      setSequence({ ...sequence, ...data.sequence })
      setShowSettingsDialog(false)
      toast.success("Settings saved")
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!sequence) return

    try {
      const response = await fetch(`/api/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sequence.isActive }),
      })

      if (!response.ok) throw new Error("Failed to update sequence")
      const data = await response.json()
      setSequence({ ...sequence, isActive: data.sequence.isActive })
      toast.success(data.sequence.isActive ? "Sequence activated" : "Sequence paused")
    } catch (error) {
      console.error("Error toggling sequence:", error)
      toast.error("Failed to update sequence")
    }
  }

  // Helper to insert variable at cursor position
  const insertVariableAtCursor = (
    variable: string,
    ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
    currentValue: string,
    setValue: (value: string) => void
  ) => {
    const element = ref.current
    if (element) {
      const start = element.selectionStart || 0
      const end = element.selectionEnd || 0
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end)
      setValue(newValue)
      setTimeout(() => {
        element.focus()
        element.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    } else {
      setValue(currentValue + variable)
    }
  }

  const handleAddStep = () => {
    setEditingStep(null)
    setStepForm({
      type: "EMAIL",
      name: "",
      delayMinutes: sequence?.steps.length === 0 ? 0 : 1440, // Default 1 day for subsequent steps
      config: {},
    })
    setShowStepDialog(true)
  }

  const handleEditStep = (step: SequenceStep) => {
    setEditingStep(step)
    setStepForm({
      type: step.type,
      name: step.name || "",
      delayMinutes: step.delayMinutes,
      config: step.config || {},
    })
    setShowStepDialog(true)
  }

  const handleSaveStep = async () => {
    if (!sequence) return

    try {
      setSaving(true)

      if (editingStep) {
        // Update existing step
        const response = await fetch(
          `/api/sequences/${sequenceId}/steps/${editingStep.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stepForm),
          }
        )
        if (!response.ok) throw new Error("Failed to update step")
        toast.success("Step updated")
      } else {
        // Create new step
        const response = await fetch(`/api/sequences/${sequenceId}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepForm),
        })
        if (!response.ok) throw new Error("Failed to create step")
        toast.success("Step added")
      }

      setShowStepDialog(false)
      loadSequence()
    } catch (error) {
      console.error("Error saving step:", error)
      toast.error("Failed to save step")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm("Are you sure you want to delete this step?")) return

    try {
      const response = await fetch(
        `/api/sequences/${sequenceId}/steps/${stepId}`,
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error("Failed to delete step")
      toast.success("Step deleted")
      loadSequence()
    } catch (error) {
      console.error("Error deleting step:", error)
      toast.error("Failed to delete step")
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !sequence) return

    const oldIndex = sequence.steps.findIndex((s) => s.id === active.id)
    const newIndex = sequence.steps.findIndex((s) => s.id === over.id)

    const newSteps = arrayMove(sequence.steps, oldIndex, newIndex)
    setSequence({ ...sequence, steps: newSteps })

    // Save new order
    try {
      const response = await fetch(`/api/sequences/${sequenceId}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: newSteps.map((s, i) => ({ id: s.id, orderIndex: i })),
        }),
      })
      if (!response.ok) throw new Error("Failed to reorder steps")
    } catch (error) {
      console.error("Error reordering steps:", error)
      toast.error("Failed to reorder steps")
      loadSequence() // Reload to get correct order
    }
  }

  const toggleStepExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!sequence) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Sequence not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/sequences")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{sequence.name}</h1>
            {sequence.description && (
              <p className="text-muted-foreground">{sequence.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              loadTags()
              setShowBulkEnrollDialog(true)
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            Bulk Enroll
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant={sequence.isActive ? "outline" : "default"}
            onClick={handleToggleActive}
          >
            {sequence.isActive ? (
              <><Pause className="h-4 w-4 mr-2" />Pause</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Activate</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm">
        <Badge variant={sequence.isActive ? "default" : "secondary"}>
          {sequence.isActive ? "Active" : "Paused"}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Zap className="h-4 w-4" />
          {sequence._count.steps} steps
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-4 w-4" />
          {sequence._count.enrollments} enrollments
        </div>
      </div>

      {/* Tabs for Steps and Activity */}
      <Tabs defaultValue="steps" className="w-full">
        <TabsList>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sequence Steps</CardTitle>
                  <CardDescription>
                    Drag to reorder steps. Each step runs after the specified delay.
                  </CardDescription>
                </div>
                <Button onClick={handleAddStep}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sequence.steps.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-medium">No steps yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first step to start building the sequence
                  </p>
                  <Button onClick={handleAddStep}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sequence.steps.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {sequence.steps.map((step, index) => (
                        <SortableStepItem
                          key={step.id}
                          step={step}
                          index={index}
                          onEdit={handleEditStep}
                          onDelete={handleDeleteStep}
                          isExpanded={expandedSteps.has(step.id)}
                          onToggleExpand={() => toggleStepExpand(step.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <SequenceEnrollmentsTab sequenceId={sequenceId} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <SequenceActivityTab sequenceId={sequenceId} />
        </TabsContent>
      </Tabs>

      {/* Step Dialog */}
      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Edit Step" : "Add Step"}</DialogTitle>
            <DialogDescription>
              Configure the step type, timing, and content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Step Type</Label>
              <Select
                value={stepForm.type}
                onValueChange={(v) => setStepForm({ ...stepForm, type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      disabled={type.disabled}
                    >
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                        {type.disabled && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Step Name (optional)</Label>
              <Input
                placeholder="e.g., Initial outreach email"
                value={stepForm.name}
                onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Delay After Previous Step</Label>
              <Select
                value={String(stepForm.delayMinutes)}
                onValueChange={(v) => setStepForm({ ...stepForm, delayMinutes: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={String(preset.value)}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For the first step, this is the delay after enrollment.
              </p>
            </div>

            {/* Type-specific config will be added here */}
            {stepForm.type === "SMS" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Message Template</Label>
                  <TemplateVariableSelector
                    onSelect={(variable) =>
                      insertVariableAtCursor(
                        variable,
                        smsMessageRef,
                        stepForm.config.message || "",
                        (value) =>
                          setStepForm({
                            ...stepForm,
                            config: { ...stepForm.config, message: value },
                          })
                      )
                    }
                  />
                </div>
                <Textarea
                  ref={smsMessageRef}
                  placeholder="Hi {firstName}, this is a message about your property at {propertyAddress}..."
                  value={stepForm.config.message || ""}
                  onChange={(e) =>
                    setStepForm({
                      ...stepForm,
                      config: { ...stepForm.config, message: e.target.value },
                    })
                  }
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Click "Insert Variable" to add dynamic content at cursor position
                </p>
              </div>
            )}

            {stepForm.type === "EMAIL" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Subject</Label>
                    <TemplateVariableSelector
                      onSelect={(variable) =>
                        insertVariableAtCursor(
                          variable,
                          emailSubjectRef,
                          stepForm.config.subject || "",
                          (value) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, subject: value },
                            })
                        )
                      }
                      buttonSize="sm"
                    />
                  </div>
                  <Input
                    ref={emailSubjectRef}
                    placeholder="e.g., Follow up on {propertyAddress}"
                    value={stepForm.config.subject || ""}
                    onChange={(e) =>
                      setStepForm({
                        ...stepForm,
                        config: { ...stepForm.config, subject: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Body</Label>
                    <TemplateVariableSelector
                      onSelect={(variable) =>
                        insertVariableAtCursor(
                          variable,
                          emailBodyRef,
                          stepForm.config.body || "",
                          (value) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, body: value },
                            })
                        )
                      }
                    />
                  </div>
                  <Textarea
                    ref={emailBodyRef}
                    placeholder="Hi {firstName}, I wanted to reach out about..."
                    value={stepForm.config.body || ""}
                    onChange={(e) =>
                      setStepForm({
                        ...stepForm,
                        config: { ...stepForm.config, body: e.target.value },
                      })
                    }
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Click "Insert Variable" to add dynamic content at cursor position
                  </p>
                </div>
              </div>
            )}

            {stepForm.type === "TASK" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Task Title</Label>
                  <Input
                    placeholder="Task title..."
                    value={stepForm.config.title || ""}
                    onChange={(e) =>
                      setStepForm({
                        ...stepForm,
                        config: { ...stepForm.config, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Task Description</Label>
                  <Textarea
                    placeholder="Task description..."
                    value={stepForm.config.description || ""}
                    onChange={(e) =>
                      setStepForm({
                        ...stepForm,
                        config: { ...stepForm.config, description: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </div>
              </div>
            )}

            {stepForm.type === "WAIT" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Wait Condition</Label>
                  <Select
                    value={stepForm.config.condition || "REPLY"}
                    onValueChange={(v) =>
                      setStepForm({
                        ...stepForm,
                        config: { ...stepForm.config, condition: v },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WAIT_CONDITIONS.map((cond) => (
                        <SelectItem key={cond.value} value={cond.value}>
                          {cond.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (optional)</Label>
                  <Select
                    value={String(stepForm.config.timeoutMinutes || 0)}
                    onValueChange={(v) =>
                      setStepForm({
                        ...stepForm,
                        config: { ...stepForm.config, timeoutMinutes: parseInt(v) },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No timeout (wait indefinitely)</SelectItem>
                      <SelectItem value="1440">1 day</SelectItem>
                      <SelectItem value="2880">2 days</SelectItem>
                      <SelectItem value="4320">3 days</SelectItem>
                      <SelectItem value="10080">1 week</SelectItem>
                      <SelectItem value="20160">2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If condition is not met within timeout, skip to next step
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStep} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingStep ? "Save Changes" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sequence Settings</DialogTitle>
            <DialogDescription>
              Update the sequence name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={settingsForm.name}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={settingsForm.description}
                onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Enroll Dialog */}
      <Dialog open={showBulkEnrollDialog} onOpenChange={setShowBulkEnrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Enroll Contacts</DialogTitle>
            <DialogDescription>
              Enroll all contacts with a specific tag into this sequence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Tag</Label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tag..." />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All contacts with this tag will be enrolled in the sequence
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEnrollDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEnroll} disabled={enrolling || !selectedTagId}>
              {enrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enroll Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Enrollments Tab Component
function SequenceEnrollmentsTab({ sequenceId }: { sequenceId: string }) {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEnrollments()
  }, [sequenceId])

  const loadEnrollments = async () => {
    try {
      const response = await fetch(`/api/sequences/${sequenceId}/enrollments`)
      if (response.ok) {
        const data = await response.json()
        setEnrollments(data.enrollments || [])
      }
    } catch (error) {
      console.error("Error loading enrollments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (enrollmentId: string, action: string) => {
    try {
      const response = await fetch(`/api/sequences/${sequenceId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (response.ok) {
        toast.success(`Enrollment ${action}d`)
        loadEnrollments()
      }
    } catch (error) {
      toast.error(`Failed to ${action} enrollment`)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrollments</CardTitle>
        <CardDescription>Contacts currently enrolled in this sequence</CardDescription>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No contacts enrolled yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {enrollment.contact?.firstName?.[0] || "?"}
                  </div>
                  <div>
                    <p className="font-medium">
                      {enrollment.contact?.firstName} {enrollment.contact?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Step {enrollment.currentStepIndex + 1} • Enrolled {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      enrollment.status === "ACTIVE" ? "default" :
                      enrollment.status === "PAUSED" ? "secondary" :
                      enrollment.status === "COMPLETED" ? "outline" : "destructive"
                    }
                  >
                    {enrollment.status}
                  </Badge>
                  {enrollment.status === "ACTIVE" && (
                    <Button size="sm" variant="ghost" onClick={() => handleAction(enrollment.id, "pause")}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {enrollment.status === "PAUSED" && (
                    <Button size="sm" variant="ghost" onClick={() => handleAction(enrollment.id, "resume")}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Activity Tab Component
function SequenceActivityTab({ sequenceId }: { sequenceId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLogs()
  }, [sequenceId])

  const loadLogs = async () => {
    try {
      const response = await fetch(`/api/sequences/${sequenceId}/logs`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error("Error loading logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getResultBadge = (result: string) => {
    if (result === "SUCCESS" || result === "SENT" || result === "TASK_CREATED") {
      return <Badge variant="outline" className="text-green-600 border-green-600">Success</Badge>
    }
    if (result.startsWith("SKIPPED")) {
      return <Badge variant="secondary">Skipped</Badge>
    }
    if (result === "FAILED") {
      return <Badge variant="destructive">Failed</Badge>
    }
    if (result === "AUTO_PAUSED_REPLY") {
      return <Badge variant="outline" className="text-blue-600 border-blue-600">Auto-Paused</Badge>
    }
    return <Badge variant="outline">{result}</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>Recent step executions and events</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const stepType = STEP_TYPES.find((t) => t.value === log.step?.type)
              const StepIcon = stepType?.icon || Zap
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className={`p-2 rounded ${stepType?.color || "bg-gray-100"}`}>
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {log.enrollment?.contact?.firstName} {log.enrollment?.contact?.lastName}
                      </span>
                      {getResultBadge(log.result)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {log.step?.name || log.step?.type} • {new Date(log.executedAt).toLocaleString()}
                    </p>
                    {log.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
