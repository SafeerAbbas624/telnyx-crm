"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useCallUI } from "@/lib/context/call-ui-context"
import { useToast } from "@/hooks/use-toast"

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, "0")}`
}

export default function CallInProgressPopup() {
  const { call, setNotes, minimize, maximize, close } = useCallUI()
  const { toast } = useToast()
  const [elapsed, setElapsed] = useState(0)
  const [ending, setEnding] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [micDevices, setMicDevices] = useState<{ deviceId: string; label: string }[]>([])
  const [selectedMic, setSelectedMic] = useState<string>("")
  const [micVersion, setMicVersion] = useState(0)

  useEffect(() => {
    if (!call) return
    setElapsed(Math.floor((Date.now() - call.startedAt) / 1000))
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - call.startedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [call?.startedAt])

  // Load available microphones for selection (WebRTC only)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!call || call.mode !== 'webrtc') return
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        const list = await rtcClient.listMicrophones()
        if (mounted) {
          setMicDevices(list)
          if (!selectedMic && list.length > 0) setSelectedMic(list[0].deviceId)
        }
      } catch (e) {
        console.warn('Unable to enumerate microphones', e)
      }
    })()
    return () => { mounted = false }
  }, [call?.mode, call?.startedAt])

  // Rebuild mic meter when local stream changes in RTC client
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!call || call.mode !== 'webrtc') return
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        const handler = () => { if (active) setMicVersion((v) => v + 1) }
        rtcClient.on('localStreamChanged', handler as any)
      } catch {}
    })()
    return () => { active = false }
  }, [call?.mode, micVersion, selectedMic])

  // Auto-close when backend reports call ended
  useEffect(() => {
    if (!call) return
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/telnyx/calls')
        if (!res.ok) return
        const data = await res.json()
        const calls = Array.isArray(data) ? data : (data.calls || [])
        const thisCall = calls.find((c: any) => c.telnyxCallId === call.telnyxCallId)
        if (!thisCall) return
        const status = String(thisCall.status || '').toLowerCase()
        if (["hangup","failed","completed","ended"].includes(status)) {
          close()
        }
      } catch {}
    }, 3000)
    return () => clearInterval(iv)
  }, [call?.telnyxCallId])
  // Mic level meter (WebRTC only)
  useEffect(() => {
    let ac: AudioContext | null = null
    let src: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    let raf = 0

    const setup = async () => {
      try {
        if (!call || call.mode !== 'webrtc') return
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        let stream = rtcClient.getLocalStream()
        if (!stream) {
          try {
            const constraints: any = selectedMic ? { audio: { deviceId: { exact: selectedMic } } } : { audio: true }
            stream = await navigator.mediaDevices.getUserMedia(constraints)
          } catch {
            try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {}
          }
        }
        if (!stream) return
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
        ac = new Ctx()
        try { await ac.resume() } catch {}
        src = ac.createMediaStreamSource(stream)
        analyser = ac.createAnalyser()
        analyser.fftSize = 512
        src.connect(analyser)
        const data = new Uint8Array(analyser.fftSize)
        const loop = () => {
          if (!analyser) return
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = data[i] - 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length) / 128
          const level = Math.min(1, Math.max(0, rms * 4)) // boost a bit for visibility
          setMicLevel(level)
          raf = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        console.warn('Mic meter error:', e)
      }
    }
    setup()

    return () => {
      try { if (raf) cancelAnimationFrame(raf) } catch {}
      try { if (src) src.disconnect() } catch {}
      try { if (analyser) analyser.disconnect() } catch {}
      try { if (ac) ac.close() } catch {}
    }
  }, [call?.mode, call?.startedAt, micVersion, selectedMic])


  const initials = useMemo(() => {
    const f = call?.contact?.firstName?.[0] || "?"
    const l = call?.contact?.lastName?.[0] || ""
    return `${f}${l}`
  }, [call?.contact?.firstName, call?.contact?.lastName])

  if (!call) return null

  const endCall = async () => {
    if (!call) return
    try {
      setEnding(true)

      if (call.mode === 'webrtc') {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.hangup()
      } else {
        // Hang up the Telnyx Call Control call
        if (call.telnyxCallId) {
          await fetch("/api/telnyx/calls/hangup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ telnyxCallId: call.telnyxCallId }),
          })
        }
      }

      // Log activity if we have notes or at least the event
      if (call.contact?.id) {
        await fetch("/api/activities", {
          method: "POST",

          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: call.contact.id,
            type: "call",
            title: `Call with ${call.contact.firstName ?? "Contact"} ${call.contact.lastName ?? ""}`.trim(),
            description: call.notes || undefined,
            durationMinutes: Math.max(1, Math.round(elapsed / 60)),
          }),
        })
      }
      toast({ title: "Call ended", description: "Call ended and notes saved." })
      close()
    } catch (e: any) {
      console.error(e)
      toast({ title: "Failed to end call", description: e?.message || "Unknown error", variant: "destructive" })
    } finally {
      setEnding(false)
    }
  }

  return (
    <>
      {/* Minimized pill */}
      {call.isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 shadow-lg border bg-white dark:bg-neutral-900 rounded-full px-4 py-2 flex items-center gap-3">
          <span className="text-sm">Call in progress · {formatDuration(elapsed)}</span>
          <Button size="sm" variant="secondary" onClick={maximize}>Open</Button>
          <Button size="sm" variant="destructive" onClick={endCall} disabled={ending}>End</Button>
        </div>
      )}

      {/* Main dialog */}
      <Dialog open={!call.isMinimized} onOpenChange={(o) => (o ? maximize() : minimize())}>
        <DialogContent className="sm:max-w-[480px]" aria-describedby="call-dialog-desc">
          <DialogHeader>
            <DialogTitle>Call with {call.contact?.firstName} {call.contact?.lastName}</DialogTitle>
            <DialogDescription id="call-dialog-desc" className="sr-only">
              Active call dialog. Use End Call to finish and save notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>

                <div className="font-medium">{call.toNumber}</div>
                <div className="text-xs text-green-600">Call in progress</div>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">{formatDuration(elapsed)}</div>
            </div>

            {/* Mic level meter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Mic level</span>
                <span className="text-xs tabular-nums">{Math.round(micLevel * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded">
                <div
                  className="h-2 bg-green-500 rounded transition-[width] duration-100"
                  style={{ width: `${Math.min(100, Math.max(0, Math.round(micLevel * 100)))}%` }}
                />
              </div>
              {call.mode !== 'webrtc' && (
                <div className="text-[10px] text-muted-foreground">Meter shown for reference</div>
              )}
            </div>

            {/* Microphone selector */}
            {call.mode === 'webrtc' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Microphone</label>
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 border rounded px-2 py-1 bg-background"
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                  >
                    {micDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
                        const ok = await rtcClient.switchMicrophone(selectedMic)
                        if (ok) {
                          setMicVersion((v)=>v+1)
                          toast({ title: 'Microphone switched' })
                        } else {
                          toast({ title: 'Failed to switch mic', variant: 'destructive' })
                        }
                      } catch (e: any) {
                        console.error(e)
                        toast({ title: 'Error switching mic', description: e?.message || 'Unknown error', variant: 'destructive' })
                      }
                    }}
                  >
                    Use
                  </Button>
                </div>
              </div>
            )}



            <div>
              <label className="text-sm font-medium">Call Notes</label>
              <Textarea
                className="mt-1"
                placeholder="Enter notes about this call..."
                value={call.notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={minimize}>Minimize</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={close}>Close</Button>
                <Button variant="destructive" onClick={endCall} disabled={ending}>End Call</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

