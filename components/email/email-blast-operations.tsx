"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Play,
  Pause,
  Square,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Power,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface EmailBlast {
  id: string
  name: string
  subject: string
  content: string
  totalContacts: number
  sentCount: number
  failedCount: number
  status: 'draft' | 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  delayBetweenEmails: number
  currentIndex: number
  isPaused: boolean
  startedAt?: string
  completedAt?: string
  pausedAt?: string
  createdAt: string
}

interface EmailBlastOperationsProps {
  onSwitchTab?: (tab: string) => void
}

export default function EmailBlastOperations({ onSwitchTab }: EmailBlastOperationsProps) {
  const [blasts, setBlasts] = useState<EmailBlast[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [killingAll, setKillingAll] = useState(false)
  const [activeCount, setActiveCount] = useState({ running: 0, pending: 0, paused: 0, total: 0 })

  const fetchBlasts = useCallback(async () => {
    try {
      const res = await fetch('/api/email-blast?limit=50')
      if (res.ok) {
        const data = await res.json()
        setBlasts(data.blasts || [])
      }
    } catch (error) {
      console.error('Error fetching email blasts:', error)
    }
  }, [])

  const fetchActiveCount = useCallback(async () => {
    try {
      const res = await fetch('/api/email-blast/kill-all')
      if (res.ok) {
        const data = await res.json()
        setActiveCount(data)
      }
    } catch (error) {
      console.error('Error fetching active count:', error)
    }
  }, [])

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    await Promise.all([fetchBlasts(), fetchActiveCount()])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadData()
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchBlasts()
      fetchActiveCount()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchBlasts, fetchActiveCount])

  const killAllBlasts = async () => {
    setKillingAll(true)
    try {
      const res = await fetch('/api/email-blast/kill-all', { method: 'POST' })
      const data = res.ok ? await res.json() : { count: 0 }
      toast.success(`Stopped ${data.count || 0} email blasts`)
      loadData()
    } catch (error) {
      toast.error('Error stopping blasts')
    } finally {
      setKillingAll(false)
    }
  }

  const pauseBlast = async (id: string) => {
    try {
      const res = await fetch(`/api/email-blast/${id}/pause`, { method: 'POST' })
      if (res.ok) {
        toast.success('Email blast paused')
        loadData()
      } else {
        toast.error('Failed to pause blast')
      }
    } catch (error) {
      toast.error('Error pausing blast')
    }
  }

  const resumeBlast = async (id: string) => {
    try {
      const res = await fetch(`/api/email-blast/${id}/resume`, { method: 'POST' })
      if (res.ok) {
        toast.success('Email blast resumed')
        loadData()
      } else {
        toast.error('Failed to resume blast')
      }
    } catch (error) {
      toast.error('Error resuming blast')
    }
  }

  const cancelBlast = async (id: string) => {
    try {
      const res = await fetch(`/api/email-blast/${id}/stop`, { method: 'POST' })
      if (res.ok) {
        toast.success('Email blast cancelled')
        loadData()
      } else {
        toast.error('Failed to cancel blast')
      }
    } catch (error) {
      toast.error('Error cancelling blast')
    }
  }

  const deleteBlast = async (id: string) => {
    try {
      const res = await fetch(`/api/email-blast/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Email blast deleted')
        loadData()
      } else {
        toast.error('Failed to delete blast')
      }
    } catch (error) {
      toast.error('Error deleting blast')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
      case 'paused':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Pause className="h-3 w-3 mr-1" />Paused</Badge>
      case 'pending':
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'completed':
        return <Badge className="bg-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'cancelled':
        return <Badge variant="secondary"><Square className="h-3 w-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      {/* Header with Kill Switch */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Blast Operations
          </h2>
          <p className="text-muted-foreground">Monitor and control all email blast campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Kill Switch */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                disabled={activeCount.total === 0 || killingAll}
                className="gap-2"
              >
                {killingAll ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Power className="h-5 w-5" />
                )}
                KILL SWITCH
                {activeCount.total > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-white/20">
                    {activeCount.total} active
                  </Badge>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Emergency Stop All Email Blasts
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <div>This will immediately stop ALL running email blast operations:</div>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• {activeCount.running} currently running</li>
                      <li>• {activeCount.pending} pending to start</li>
                      <li>• {activeCount.paused} currently paused</li>
                    </ul>
                    <div className="mt-3 font-medium">All blasts will be marked as cancelled and cannot be resumed.</div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={killAllBlasts} className="bg-red-600 hover:bg-red-700">
                  Stop All Email Blasts
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={activeCount.running > 0 ? 'border-green-500' : ''}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{activeCount.running}</div>
            <div className="text-sm text-muted-foreground">Running</div>
          </CardContent>
        </Card>
        <Card className={activeCount.paused > 0 ? 'border-yellow-500' : ''}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{activeCount.paused}</div>
            <div className="text-sm text-muted-foreground">Paused</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{activeCount.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{blasts.filter(b => b.status === 'completed').length}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Blasts List */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Recent Email Blasts</CardTitle>
          <CardDescription>Last 50 email blast campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {blasts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No email blasts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blasts.map((blast) => (
                  <div key={blast.id} className="border rounded-lg p-4 hover:bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{blast.name || 'Unnamed Blast'}</span>
                          {getStatusBadge(blast.status)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          <strong>Subject:</strong> {blast.subject}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{blast.totalContacts} contacts</span>
                          <span>{blast.sentCount} sent</span>
                          {blast.failedCount > 0 && (
                            <span className="text-red-500">{blast.failedCount} failed</span>
                          )}
                          <span>{formatDistanceToNow(new Date(blast.createdAt), { addSuffix: true })}</span>
                        </div>

                        {/* Progress Bar */}
                        {['running', 'paused'].includes(blast.status) && (
                          <div className="mt-2">
                            <Progress value={(blast.currentIndex / blast.totalContacts) * 100} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {blast.currentIndex} / {blast.totalContacts} ({Math.round((blast.currentIndex / blast.totalContacts) * 100)}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-4">
                        {/* View Queue Button */}
                        {['running', 'paused', 'pending'].includes(blast.status) && onSwitchTab && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onSwitchTab('blast')}
                            title="View Live Queue"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}

                        {blast.status === 'running' && (
                          <Button variant="outline" size="icon" onClick={() => pauseBlast(blast.id)} title="Pause">
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {blast.status === 'paused' && (
                          <>
                            <Button variant="outline" size="icon" onClick={() => resumeBlast(blast.id)} title="Resume">
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => cancelBlast(blast.id)} title="Cancel">
                              <Square className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {blast.status === 'pending' && (
                          <Button variant="outline" size="icon" onClick={() => cancelBlast(blast.id)} title="Cancel">
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        {['completed', 'failed', 'cancelled'].includes(blast.status) && (
                          <Button variant="ghost" size="icon" onClick={() => deleteBlast(blast.id)} title="Delete">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
