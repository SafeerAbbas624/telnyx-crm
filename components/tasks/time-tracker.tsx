"use client"

import React, { useState, useEffect } from "react"
import { Play, Pause, Plus, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"

interface TimeEntry {
  id: string
  minutes: number
  description?: string
  createdAt: string
  user: {
    name: string
  }
}

interface TimeTrackerProps {
  taskId: string
}

export default function TimeTracker({ taskId }: TimeTrackerProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [manualMinutes, setManualMinutes] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTimeEntries()
  }, [taskId])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning])

  const fetchTimeEntries = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tasks/time-entries?taskId=${taskId}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setTimeEntries(data.timeEntries)
      setTotalMinutes(data.totalMinutes)
    } catch (error) {
      console.error('Error fetching time entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddManualTime = async () => {
    if (!manualMinutes || parseInt(manualMinutes) <= 0) {
      toast({ title: 'Error', description: 'Please enter valid minutes' })
      return
    }

    try {
      const response = await fetch('/api/tasks/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          minutes: parseInt(manualMinutes),
          description: description || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to add time')
      setManualMinutes("")
      setDescription("")
      fetchTimeEntries()
      toast({ title: 'Success', description: 'Time entry added' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add time entry' })
    }
  }

  const handleStopTimer = async () => {
    setIsRunning(false)
    const minutes = Math.floor(elapsedSeconds / 60)
    if (minutes > 0) {
      try {
        const response = await fetch('/api/tasks/time-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            minutes,
            description: description || null,
          }),
        })
        if (!response.ok) throw new Error('Failed to save time')
        setElapsedSeconds(0)
        setDescription("")
        fetchTimeEntries()
        toast({ title: 'Success', description: `${minutes} minutes logged` })
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to save time' })
      }
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const response = await fetch('/api/tasks/time-entries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchTimeEntries()
      toast({ title: 'Success', description: 'Time entry deleted' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete entry' })
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Tracking
        </h3>
        <div className="text-lg font-semibold">
          {totalMinutes} min ({(totalMinutes / 60).toFixed(1)} hrs)
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-3xl font-mono text-center">
          {formatTime(elapsedSeconds)}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsRunning(!isRunning)}
            className="flex-1"
            variant={isRunning ? "destructive" : "default"}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>
          {isRunning && (
            <Button onClick={handleStopTimer} variant="outline">
              Stop & Save
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        <label className="text-sm font-medium">Add Manual Time</label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Minutes"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            min="1"
          />
          <Button onClick={handleAddManualTime}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-16"
        />
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading...</div>
      ) : timeEntries.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No time entries yet</div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Entries</h4>
          {timeEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div>
                <p className="text-sm font-medium">{entry.minutes} minutes</p>
                {entry.description && (
                  <p className="text-xs text-gray-600">{entry.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {entry.user.name} - {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteEntry(entry.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

