"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Play,
  Pause,
  Trash2,
  MoreVertical,
  RefreshCw,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Loader2,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface TextBlast {
  id: string
  name: string | null
  message: string
  totalContacts: number
  sentCount: number
  deliveredCount: number
  failedCount: number
  status: 'draft' | 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  delaySeconds: number
  currentIndex: number
  isPaused: boolean
  startedAt: string | null
  completedAt: string | null
  pausedAt: string | null
  createdAt: string
  progress?: number
  createdByUser?: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

interface TextBlastListProps {
  onSelectBlast?: (blast: TextBlast) => void
  onStartBlast?: (blastId: string) => void
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-gray-500', icon: <FileText className="h-3 w-3" /> },
  pending: { label: 'Pending', color: 'bg-yellow-500', icon: <Clock className="h-3 w-3" /> },
  running: { label: 'Running', color: 'bg-blue-500', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  paused: { label: 'Paused', color: 'bg-orange-500', icon: <Pause className="h-3 w-3" /> },
  completed: { label: 'Completed', color: 'bg-green-500', icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-gray-400', icon: <XCircle className="h-3 w-3" /> },
}

export default function TextBlastList({ onSelectBlast, onStartBlast }: TextBlastListProps) {
  const [blasts, setBlasts] = useState<TextBlast[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [blastToDelete, setBlastToDelete] = useState<string | null>(null)
  const [warningDialogOpen, setWarningDialogOpen] = useState(false)
  const [blastToStart, setBlastToStart] = useState<string | null>(null)
  const [runningBlast, setRunningBlast] = useState<{ id: string; name: string } | null>(null)

  const loadBlasts = useCallback(async () => {
    try {
      const res = await fetch('/api/text-blast?limit=100')
      const data = await res.json()
      setBlasts(data.blasts || [])
    } catch (error) {
      console.error('Error loading text blasts:', error)
      toast.error('Failed to load text blasts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlasts()
    // Poll for updates every 5 seconds
    const interval = setInterval(loadBlasts, 5000)
    return () => clearInterval(interval)
  }, [loadBlasts])

  const handleStartBlast = async (blastId: string, forceStart = false) => {
    try {
      const res = await fetch(`/api/text-blast/${blastId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceStart }),
      })
      const data = await res.json()

      if (res.status === 409 && data.requiresConfirmation) {
        setRunningBlast(data.runningBlast)
        setBlastToStart(blastId)
        setWarningDialogOpen(true)
        return
      }

      if (!res.ok) {
        toast.error(data.error || 'Failed to start blast')
        return
      }

      toast.success('Text blast started!')
      loadBlasts()
      onStartBlast?.(blastId)
    } catch (error) {
      toast.error('Failed to start blast')
    }
  }

  const handlePauseBlast = async (blastId: string) => {
    try {
      const res = await fetch(`/api/text-blast/${blastId}/pause`, { method: 'POST' })
      if (res.ok) {
        toast.info('Blast paused')
        loadBlasts()
      } else {
        toast.error('Failed to pause blast')
      }
    } catch (error) {
      toast.error('Failed to pause blast')
    }
  }

  const handleResumeBlast = async (blastId: string) => {
    await handleStartBlast(blastId)
  }

  const handleDeleteBlast = async () => {
    if (!blastToDelete) return
    try {
      const res = await fetch(`/api/text-blast/${blastToDelete}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Blast deleted')
        loadBlasts()
      } else {
        toast.error('Failed to delete blast')
      }
    } catch (error) {
      toast.error('Failed to delete blast')
    } finally {
      setDeleteDialogOpen(false)
      setBlastToDelete(null)
    }
  }

  const confirmForceStart = async () => {
    if (blastToStart) {
      await handleStartBlast(blastToStart, true)
    }
    setWarningDialogOpen(false)
    setBlastToStart(null)
    setRunningBlast(null)
  }

  const hasRunningBlast = blasts.some(b => b.status === 'running')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" />
            Text Blast Campaigns
          </h3>
          <p className="text-sm text-muted-foreground">
            {blasts.length} campaign{blasts.length !== 1 ? 's' : ''} • {hasRunningBlast && <span className="text-blue-500">1 running</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadBlasts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && blasts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : blasts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Send className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No text blast campaigns yet</p>
            <p className="text-sm text-muted-foreground">Create a new blast to get started</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-3">
            {blasts.map((blast) => {
              const status = statusConfig[blast.status] || statusConfig.draft
              const progress = blast.totalContacts > 0
                ? Math.round((blast.sentCount + blast.failedCount) / blast.totalContacts * 100)
                : 0

              return (
                <Card key={blast.id} className={blast.status === 'running' ? 'border-blue-500 border-2' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {blast.name || 'Untitled Blast'}
                          </h4>
                          <Badge variant="secondary" className={`${status.color} text-white text-xs`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {blast.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {blast.totalContacts} contacts
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {blast.sentCount} sent
                          </span>
                          {blast.failedCount > 0 && (
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="h-3 w-3" />
                              {blast.failedCount} failed
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(blast.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {(blast.status === 'running' || blast.status === 'paused') && (
                          <div className="mt-2">
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {progress}% complete ({blast.sentCount + blast.failedCount}/{blast.totalContacts})
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(blast.status === 'draft' || blast.status === 'pending') && (
                          <Button size="sm" onClick={() => handleStartBlast(blast.id)}>
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {blast.status === 'running' && (
                          <Button size="sm" variant="outline" onClick={() => handlePauseBlast(blast.id)}>
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </Button>
                        )}
                        {blast.status === 'paused' && (
                          <Button size="sm" onClick={() => handleResumeBlast(blast.id)}>
                            <Play className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onSelectBlast?.(blast)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setBlastToDelete(blast.id)
                                setDeleteDialogOpen(true)
                              }}
                              disabled={blast.status === 'running'}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Text Blast?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The blast campaign and its history will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBlast} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Double Queue Warning Dialog */}
      <AlertDialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Another Blast is Running
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{runningBlast?.name || 'Untitled Blast'}"</strong> is currently running.
              <br /><br />
              Starting another blast simultaneously may cause issues with rate limiting and message delivery.
              Are you sure you want to start this blast anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmForceStart} className="bg-yellow-600 hover:bg-yellow-700">
              Start Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

