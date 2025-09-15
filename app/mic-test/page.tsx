"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function MicTestPage() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [level, setLevel] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // audio graph refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafIdRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const selectedLabel = useMemo(() => {
    return devices.find(d => d.deviceId === selectedId)?.label || "(default)"
  }, [devices, selectedId])

  // enumerate devices (with permission so labels are visible)
  const enumerate = async () => {
    setError(null)
    try {
      // ensure permission so labels populate
      try { await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {}
      const all = await navigator.mediaDevices.enumerateDevices()
      const mics = all.filter(d => d.kind === "audioinput")
      setDevices(mics)
      if (!selectedId && mics.length) setSelectedId(mics[0].deviceId)
    } catch (e: any) {
      setError(e?.message || "Unable to enumerate microphones")
    }
  }

  useEffect(() => {
    enumerate()
    const onChange = () => enumerate()
    try { navigator.mediaDevices.addEventListener("devicechange", onChange) } catch {}
    return () => {
      try { navigator.mediaDevices.removeEventListener("devicechange", onChange) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stop = () => {
    try { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current) } catch {}
    try { analyserRef.current && analyserRef.current.disconnect() } catch {}
    try { sourceRef.current && sourceRef.current.disconnect() } catch {}
    try { audioContextRef.current && audioContextRef.current.close() } catch {}
    try { streamRef.current && streamRef.current.getTracks().forEach(t => t.stop()) } catch {}
    analyserRef.current = null
    sourceRef.current = null
    audioContextRef.current = null
    streamRef.current = null
    setRunning(false)
  }

  const start = async () => {
    setError(null)
    try {
      stop() // reset
      const constraints: MediaStreamConstraints = selectedId
        ? { audio: { deviceId: { exact: selectedId } as any } }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      const ac: AudioContext = new Ctx()
      audioContextRef.current = ac
      try { await ac.resume() } catch {}
      const source = ac.createMediaStreamSource(stream)
      sourceRef.current = source
      const analyser = ac.createAnalyser()
      analyser.fftSize = 512
      analyserRef.current = analyser
      source.connect(analyser)

      setRunning(true)

      const data = new Uint8Array(analyser.fftSize)
      const loop = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = data[i] - 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length) / 128
        const lvl = Math.min(1, Math.max(0, rms * 4))
        setLevel(lvl)
        rafIdRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (e: any) {
      setError(e?.message || "Unable to start mic test")
      stop()
    }
  }

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Microphone Test</h1>
        <p className="text-sm text-muted-foreground">Pick a mic and start the live level meter. Speak to see the bar move.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mic">Microphone</Label>
        <div className="flex gap-2 items-center">
          <select
            id="mic"
            className="flex-1 border rounded px-2 py-2 bg-background"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
            ))}
          </select>
          <Button variant="outline" onClick={enumerate}>Refresh</Button>
        </div>
        <div className="text-xs text-muted-foreground">Selected: {selectedLabel}</div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          {!running ? (
            <Button onClick={start}>Start test</Button>
          ) : (
            <Button variant="destructive" onClick={stop}>Stop test</Button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Mic level</span>
            <span className="text-xs tabular-nums">{Math.round(level * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded">
            <div
              className="h-2 bg-green-500 rounded transition-[width] duration-100"
              style={{ width: `${Math.min(100, Math.max(0, Math.round(level * 100)))}%` }}
            />
          </div>
          {!running && (
            <div className="text-[11px] text-muted-foreground">Click Start test to begin measuring input.</div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      <div className="text-xs text-muted-foreground">
        Tip: If labels show as generic names or the meter stays flat, allow microphone permissions for this site, and ensure the CAMO app has microphone enabled.
      </div>
    </div>
  )
}

