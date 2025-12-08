'use client'

/**
 * Multi-Line Power Dialer Hook
 * 
 * Manages dialer run state with SSE real-time updates and polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DialerRunState, ActiveLeg, CompletedLeg, DialerRunStats } from '@/lib/dialer/types'

interface UseDialerOptions {
  listId?: string
  onCallAnswered?: (leg: ActiveLeg) => void
  onRunCompleted?: (stats: DialerRunStats) => void
}

interface UseDialerReturn {
  // State
  runState: DialerRunState | null
  isLoading: boolean
  error: string | null
  
  // Derived state
  isRunning: boolean
  isPaused: boolean
  isCompleted: boolean
  activeLegs: ActiveLeg[]
  completedLegs: CompletedLeg[]
  queueLength: number
  stats: DialerRunStats | null
  
  // Actions
  startRun: (options?: { maxLines?: number; selectedNumbers?: string[]; scriptId?: string }) => Promise<void>
  pauseRun: () => Promise<void>
  resumeRun: () => Promise<void>
  stopRun: () => Promise<void>
  refreshState: () => Promise<void>
}

const DEFAULT_STATS: DialerRunStats = {
  totalAttempted: 0,
  totalAnswered: 0,
  totalNoAnswer: 0,
  totalVoicemail: 0,
  totalBusy: 0,
  totalFailed: 0,
  totalCanceled: 0,
  totalTalkTimeSeconds: 0,
  averageRingTimeMs: 0
}

export function useDialer(options: UseDialerOptions = {}): UseDialerReturn {
  const { listId, onCallAnswered, onRunCompleted } = options
  
  const [runState, setRunState] = useState<DialerRunState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastAnsweredLegRef = useRef<string | null>(null)

  // Derived state
  const isRunning = runState?.status === 'running'
  const isPaused = runState?.status === 'paused'
  const isCompleted = runState?.status === 'completed'
  const activeLegs = runState?.activeLegs || []
  const completedLegs = runState?.completedLegs || []
  const queueLength = runState?.queue?.length || 0
  const stats = runState?.stats || null

  // Update state from SSE or polling data
  const updateFromEvent = useCallback((data: any) => {
    if (!data.state) return
    
    setRunState(prev => {
      const newState = { ...prev, ...data.state } as DialerRunState
      
      // Check for newly answered call
      const answeredLeg = newState.activeLegs?.find(l => l.status === 'answered')
      if (answeredLeg && answeredLeg.legId !== lastAnsweredLegRef.current) {
        lastAnsweredLegRef.current = answeredLeg.legId
        onCallAnswered?.(answeredLeg)
      }
      
      // Check for completion
      if (newState.status === 'completed' && prev?.status !== 'completed') {
        onRunCompleted?.(newState.stats)
      }
      
      return newState
    })
  }, [onCallAnswered, onRunCompleted])

  // Fetch current state
  const refreshState = useCallback(async () => {
    if (!listId) return
    
    try {
      const response = await fetch(`/api/dialer/runs?listId=${listId}`)
      const data = await response.json()
      
      if (data.run) {
        setRunState(data.run)
      }
    } catch (err) {
      console.error('[useDialer] Error refreshing state:', err)
    }
  }, [listId])

  // Start a new run
  const startRun = useCallback(async (opts?: { maxLines?: number; selectedNumbers?: string[]; scriptId?: string }) => {
    if (!listId) {
      setError('No list selected')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/dialer/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId,
          maxLines: opts?.maxLines,
          selectedNumbers: opts?.selectedNumbers,
          scriptId: opts?.scriptId
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start dialer run')
      }
      
      setRunState(data.state)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start run'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [listId])

  // Pause the run
  const pauseRun = useCallback(async () => {
    if (!runState?.runId) return

    try {
      const response = await fetch(`/api/dialer/runs/${runState.runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })

      const data = await response.json()
      if (data.state) setRunState(data.state)
    } catch (err) {
      console.error('[useDialer] Error pausing run:', err)
    }
  }, [runState?.runId])

  // Resume the run
  const resumeRun = useCallback(async () => {
    if (!runState?.runId) return

    try {
      const response = await fetch(`/api/dialer/runs/${runState.runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })

      const data = await response.json()
      if (data.state) setRunState(data.state)
    } catch (err) {
      console.error('[useDialer] Error resuming run:', err)
    }
  }, [runState?.runId])

  // Stop the run
  const stopRun = useCallback(async () => {
    if (!runState?.runId) return

    try {
      const response = await fetch(`/api/dialer/runs/${runState.runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })

      const data = await response.json()
      if (data.state) setRunState(data.state)
    } catch (err) {
      console.error('[useDialer] Error stopping run:', err)
    }
  }, [runState?.runId])

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (!runState?.runId || runState.status === 'completed') return

    console.log('[useDialer] Connecting to SSE for run:', runState.runId)
    const es = new EventSource('/api/events')
    eventSourceRef.current = es

    es.onopen = () => {
      console.log('[useDialer] SSE connected')
    }

    const onDialerUpdate = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data || '{}')
        if (data.runId === runState.runId) {
          console.log('[useDialer] SSE update:', data.type)
          updateFromEvent(data)
        }
      } catch (error) {
        console.error('[useDialer] Error parsing SSE event:', error)
      }
    }

    es.addEventListener('dialer:update', onDialerUpdate as EventListener)

    es.onerror = () => {
      console.log('[useDialer] SSE error, will auto-reconnect')
    }

    // Start polling as fallback
    pollIntervalRef.current = setInterval(() => {
      if (runState.runId) {
        fetch(`/api/dialer/runs/${runState.runId}`)
          .then(res => res.json())
          .then(data => {
            if (data.state) updateFromEvent({ state: data.state })
          })
          .catch(() => {})
      }
    }, 3000)

    return () => {
      console.log('[useDialer] Cleaning up SSE')
      es.removeEventListener('dialer:update', onDialerUpdate as EventListener)
      es.close()
      eventSourceRef.current = null
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [runState?.runId, runState?.status, updateFromEvent])

  // Check for existing run on mount
  useEffect(() => {
    if (listId) {
      refreshState()
    }
  }, [listId, refreshState])

  return {
    runState,
    isLoading,
    error,
    isRunning,
    isPaused,
    isCompleted,
    activeLegs,
    completedLegs,
    queueLength,
    stats,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    refreshState
  }
}

