"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Zap,
  Plus,
  Play,
  Pause,
  XCircle,
  Clock,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface Enrollment {
  id: string
  sequenceId: string
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED"
  currentStepIndex: number
  enrolledAt: string
  nextStepAt: string | null
  completedAt: string | null
  sequence: {
    id: string
    name: string
    _count: {
      steps: number
    }
  }
}

interface Sequence {
  id: string
  name: string
  description: string | null
  isActive: boolean
  _count: {
    steps: number
  }
}

interface ContactSequencesProps {
  contactId: string
}

export default function ContactSequences({ contactId }: ContactSequencesProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [showEnrollDialog, setShowEnrollDialog] = useState(false)
  const [selectedSequence, setSelectedSequence] = useState<string>("")
  const [enrolling, setEnrolling] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    loadEnrollments()
    loadSequences()
  }, [contactId])

  const loadEnrollments = async () => {
    try {
      const response = await fetch(`/api/contacts/${contactId}/sequences`)
      if (!response.ok) throw new Error("Failed to load enrollments")
      const data = await response.json()
      setEnrollments(data.enrollments || [])
    } catch (error) {
      console.error("Error loading enrollments:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadSequences = async () => {
    try {
      const response = await fetch("/api/sequences?isActive=true")
      if (!response.ok) throw new Error("Failed to load sequences")
      const data = await response.json()
      setSequences(data.sequences || [])
    } catch (error) {
      console.error("Error loading sequences:", error)
    }
  }

  const handleEnroll = async () => {
    if (!selectedSequence) {
      toast.error("Please select a sequence")
      return
    }

    try {
      setEnrolling(true)
      const response = await fetch(`/api/sequences/${selectedSequence}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contactId] }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to enroll contact")
      }

      toast.success("Contact enrolled in sequence")
      setShowEnrollDialog(false)
      setSelectedSequence("")
      loadEnrollments()
    } catch (error: any) {
      console.error("Error enrolling contact:", error)
      toast.error(error.message || "Failed to enroll contact")
    } finally {
      setEnrolling(false)
    }
  }

  const handleAction = async (enrollmentId: string, sequenceId: string, action: string) => {
    try {
      const response = await fetch(
        `/api/sequences/${sequenceId}/enrollments/${enrollmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      )

      if (!response.ok) throw new Error("Failed to update enrollment")

      toast.success(
        action === "pause" ? "Enrollment paused" :
        action === "resume" ? "Enrollment resumed" :
        "Enrollment canceled"
      )
      loadEnrollments()
    } catch (error) {
      console.error("Error updating enrollment:", error)
      toast.error("Failed to update enrollment")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>
      case "PAUSED":
        return <Badge className="bg-yellow-100 text-yellow-700">Paused</Badge>
      case "COMPLETED":
        return <Badge className="bg-blue-100 text-blue-700">Completed</Badge>
      case "CANCELED":
        return <Badge className="bg-gray-100 text-gray-700">Canceled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Filter out sequences the contact is already enrolled in
  const availableSequences = sequences.filter(
    (seq) => !enrollments.some((e) => e.sequenceId === seq.id && e.status === "ACTIVE")
  )

  return (
    <>
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle
            className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" />
              Sequences ({enrollments.length})
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowEnrollDialog(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardTitle>
        </CardHeader>
        {expanded && (
          <CardContent className="px-3 pb-3">
            {loading ? (
              <div className="text-center py-3 text-gray-500 text-xs">Loading...</div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-4">
                <Zap className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">Not enrolled in any sequences</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={() => setShowEnrollDialog(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Enroll in Sequence
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {enrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="p-2 border rounded-lg bg-gray-50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {enrollment.sequence.name}
                      </span>
                      {getStatusBadge(enrollment.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Step {enrollment.currentStepIndex + 1} of{" "}
                        {enrollment.sequence._count.steps}
                      </span>
                      {enrollment.nextStepAt && enrollment.status === "ACTIVE" && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next: {new Date(enrollment.nextStepAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {(enrollment.status === "ACTIVE" || enrollment.status === "PAUSED") && (
                      <div className="flex items-center gap-1 pt-1">
                        {enrollment.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleAction(enrollment.id, enrollment.sequenceId, "pause")}
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => handleAction(enrollment.id, enrollment.sequenceId, "resume")}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Resume
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-red-600 hover:text-red-700"
                          onClick={() => handleAction(enrollment.id, enrollment.sequenceId, "cancel")}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll in Sequence</DialogTitle>
            <DialogDescription>
              Select a sequence to enroll this contact in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedSequence} onValueChange={setSelectedSequence}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sequence..." />
              </SelectTrigger>
              <SelectContent>
                {availableSequences.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500 text-center">
                    No available sequences
                  </div>
                ) : (
                  availableSequences.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        <span>{seq.name}</span>
                        <span className="text-xs text-gray-500">
                          ({seq._count.steps} steps)
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} disabled={enrolling || !selectedSequence}>
              {enrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
