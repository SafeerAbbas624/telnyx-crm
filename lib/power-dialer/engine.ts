"use client"

import type { Contact } from "@/lib/types"

export type PowerDialerConfig = {
  sessionId: string
  concurrentLines: number
  selectedNumbers: string[]
  onCallAnswered: (call: ActiveCall) => void
  onCallDroppedBusy: (call: ActiveCall) => void
  onCallNoAnswer: (call: ActiveCall) => void
  onCallFailed: (call: ActiveCall) => void
  onStatsUpdate: (stats: PowerDialerStats) => void
  onQueueUpdate: (queue: QueueItem[]) => void
  onActiveCallsUpdate?: (calls: ActiveCall[]) => void
}

export type QueueItem = {
  id: string
  contactId: string
  contact: Partial<Contact> & { id: string }
  status: 'PENDING' | 'CALLING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  attemptCount: number
  maxAttempts: number
  priority: number
}

export type ActiveCall = {
  id: string
  queueItemId: string
  contactId: string
  contact: Partial<Contact> & { id: string }
  fromNumber: string
  toNumber: string
  webrtcSessionId?: string
  status: 'INITIATED' | 'RINGING' | 'ANSWERED' | 'BUSY' | 'NO_ANSWER' | 'FAILED'
  startedAt: number
}

export type PowerDialerStats = {
  totalCalls: number
  totalContacted: number
  totalAnswered: number
  totalNoAnswer: number
  totalTalkTime: number
  uniqueRate: number
}

export class PowerDialerEngine {
  private config: PowerDialerConfig
  private queue: QueueItem[] = []
  private activeCalls: Map<string, ActiveCall> = new Map()
  private isRunning: boolean = false
  private isPaused: boolean = false
  private stats: PowerDialerStats = {
    totalCalls: 0,
    totalContacted: 0,
    totalAnswered: 0,
    totalNoAnswer: 0,
    totalTalkTime: 0,
    uniqueRate: 0,
  }
  private currentCallInProgress: boolean = false // Admin is on a call
  private dialingInterval: NodeJS.Timeout | null = null

  constructor(config: PowerDialerConfig) {
    this.config = config
  }

  async loadQueue(queueItems: QueueItem[]) {
    this.queue = queueItems.filter(item => item.status === 'PENDING' || item.status === 'CALLING')
    this.config.onQueueUpdate(this.queue)
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.isPaused = false
    this.startDialing()
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
    if (this.isRunning) {
      this.startDialing()
    }
  }

  stop() {
    this.isRunning = false
    this.isPaused = false
    if (this.dialingInterval) {
      clearInterval(this.dialingInterval)
      this.dialingInterval = null
    }
    // Hang up all active calls
    this.activeCalls.forEach(call => {
      this.hangupCall(call.webrtcSessionId)
    })
    this.activeCalls.clear()
    this.notifyActiveCallsUpdate()
  }

  setAdminBusy(busy: boolean) {
    this.currentCallInProgress = busy
  }

  private notifyActiveCallsUpdate() {
    if (this.config.onActiveCallsUpdate) {
      this.config.onActiveCallsUpdate(Array.from(this.activeCalls.values()))
    }
  }

  private startDialing() {
    // Check every 2 seconds if we need to make more calls
    if (this.dialingInterval) {
      clearInterval(this.dialingInterval)
    }

    this.dialingInterval = setInterval(() => {
      if (!this.isRunning || this.isPaused) return
      this.processQueue()
    }, 2000)

    // Start immediately
    this.processQueue()
  }

  private async processQueue() {
    if (this.isPaused || !this.isRunning) return

    // Get number of calls we can make
    const availableSlots = this.config.concurrentLines - this.activeCalls.size

    if (availableSlots <= 0) return

    // Get next contacts to call (prioritize retries)
    const pendingItems = this.queue
      .filter(item => 
        (item.status === 'PENDING' || item.status === 'CALLING') &&
        item.attemptCount < item.maxAttempts
      )
      .sort((a, b) => {
        // Prioritize items that need retry (higher attempt count)
        if (a.attemptCount > 0 && b.attemptCount === 0) return -1
        if (a.attemptCount === 0 && b.attemptCount > 0) return 1
        // Then by priority
        return b.priority - a.priority
      })
      .slice(0, availableSlots)

    for (const item of pendingItems) {
      await this.initiateCall(item)
    }
  }

  private async initiateCall(queueItem: QueueItem) {
    try {
      // Get phone number to call
      const toNumber = queueItem.contact.phone1 || queueItem.contact.phone2 || queueItem.contact.phone3
      if (!toNumber) {
        console.warn('No phone number for contact:', queueItem.contact.id)
        await this.updateQueueItem(queueItem.id, { status: 'FAILED' })
        return
      }

      // Select from number (round-robin)
      const fromNumber = this.config.selectedNumbers[
        this.stats.totalCalls % this.config.selectedNumbers.length
      ]

      // Update queue item
      await this.updateQueueItem(queueItem.id, {
        status: 'CALLING',
        attemptCount: queueItem.attemptCount + 1,
      })

      // Start WebRTC call
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.ensureRegistered()
      const { sessionId } = await rtcClient.startCall({ toNumber, fromNumber })

      const activeCall: ActiveCall = {
        id: `call-${Date.now()}-${Math.random()}`,
        queueItemId: queueItem.id,
        contactId: queueItem.contact.id,
        contact: queueItem.contact,
        fromNumber,
        toNumber,
        webrtcSessionId: sessionId,
        status: 'INITIATED',
        startedAt: Date.now(),
      }

      this.activeCalls.set(activeCall.id, activeCall)
      this.notifyActiveCallsUpdate()

      // Create call record in TelnyxCall table
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          contactId: queueItem.contact.id,
          fromNumber,
          toNumber,
        })
      }).catch(err => console.error('Failed to log call to TelnyxCall:', err))

      // Create call record in PowerDialerCall table
      await fetch('/api/power-dialer/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          queueItemId: queueItem.id,
          contactId: queueItem.contact.id,
          fromNumber,
          toNumber,
          webrtcSessionId: sessionId,
        })
      })

      // Update stats
      this.stats.totalCalls++
      this.config.onStatsUpdate(this.stats)

      // Listen for call events
      this.setupCallListeners(activeCall)

    } catch (error) {
      console.error('Error initiating call:', error)
      await this.updateQueueItem(queueItem.id, { status: 'FAILED' })
    }
  }

  private setupCallListeners(call: ActiveCall) {
    // Poll for call status (in production, use WebSocket or Telnyx webhooks)
    const checkInterval = setInterval(async () => {
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        const callState = rtcClient.getCallState()

        if (!callState || !this.activeCalls.has(call.id)) {
          clearInterval(checkInterval)
          return
        }

        // Check if call was answered
        if (callState.state === 'active' && call.status !== 'ANSWERED') {
          call.status = 'ANSWERED'
          
          // Check if admin is busy
          if (this.currentCallInProgress) {
            // Drop this call and queue for retry
            await this.hangupCall(call.webrtcSessionId)
            call.status = 'BUSY'
            this.activeCalls.delete(call.id)
            this.notifyActiveCallsUpdate()

            // Update queue item for retry
            const queueItem = this.queue.find(q => q.id === call.queueItemId)
            if (queueItem && queueItem.attemptCount < queueItem.maxAttempts) {
              await this.updateQueueItem(call.queueItemId, {
                status: 'PENDING',
                priority: queueItem.priority + 1000, // Boost priority for immediate retry
              })
            }

            this.config.onCallDroppedBusy(call)
            clearInterval(checkInterval)
            return
          }

          // Admin is free, connect the call
          this.currentCallInProgress = true
          this.stats.totalAnswered++
          this.stats.totalContacted++
          this.config.onStatsUpdate(this.stats)
          this.config.onCallAnswered(call)
          
          // Update queue item
          await this.updateQueueItem(call.queueItemId, {
            status: 'COMPLETED',
          })
        }

        // Check if call ended
        if (callState.state === 'hangup' || callState.state === 'destroy') {
          clearInterval(checkInterval)
          this.activeCalls.delete(call.id)
          this.notifyActiveCallsUpdate()

          if (call.status === 'ANSWERED') {
            // Call was answered and completed
            const duration = Math.floor((Date.now() - call.startedAt) / 1000)
            this.stats.totalTalkTime += duration
            this.config.onStatsUpdate(this.stats)
          } else {
            // Call was not answered
            call.status = 'NO_ANSWER'
            this.stats.totalNoAnswer++
            this.config.onStatsUpdate(this.stats)
            this.config.onCallNoAnswer(call)
            
            // Update queue item for potential retry
            const queueItem = this.queue.find(q => q.id === call.queueItemId)
            if (queueItem && queueItem.attemptCount < queueItem.maxAttempts) {
              await this.updateQueueItem(call.queueItemId, { status: 'PENDING' })
            } else {
              await this.updateQueueItem(call.queueItemId, { status: 'FAILED' })
            }
          }
        }
      } catch (error) {
        console.error('Error checking call status:', error)
        clearInterval(checkInterval)
      }
    }, 1000)
  }

  private async hangupCall(webrtcSessionId?: string) {
    if (!webrtcSessionId) return
    try {
      const { rtcClient } = await import('@/lib/webrtc/rtc-client')
      await rtcClient.hangup()
    } catch (error) {
      console.error('Error hanging up call:', error)
    }
  }

  private async updateQueueItem(queueItemId: string, updates: Partial<QueueItem>) {
    try {
      await fetch('/api/power-dialer/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueItemId,
          ...updates,
        })
      })

      // Update local queue
      const item = this.queue.find(q => q.id === queueItemId)
      if (item) {
        Object.assign(item, updates)
        this.config.onQueueUpdate(this.queue)
      }
    } catch (error) {
      console.error('Error updating queue item:', error)
    }
  }

  getStats(): PowerDialerStats {
    return { ...this.stats }
  }

  getQueue(): QueueItem[] {
    return [...this.queue]
  }

  getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values())
  }
}

