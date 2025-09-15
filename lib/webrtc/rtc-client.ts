"use client"

import type { TelnyxRTC as TelnyxRTCType } from "@telnyx/webrtc"

// Lazy import to avoid SSR issues
let TelnyxRTCImport: Promise<any> | null = null
function getSDK() {
  if (!TelnyxRTCImport) {
    TelnyxRTCImport = import("@telnyx/webrtc")
  }
  return TelnyxRTCImport
}

type StartCallOpts = { toNumber: string; fromNumber?: string }

type Listener = (event: any) => void

class TelnyxWebRTCClient {
  private client: any | null = null
  private registered = false
  private currentCall: any | null = null
  private listeners: Record<string, Listener[]> = {}
  private audioEl: HTMLAudioElement | null = null
  private localStream: MediaStream | null = null

  on(event: string, handler: Listener) {
    this.listeners[event] = this.listeners[event] || []
    this.listeners[event].push(handler)
  }
  private emit(event: string, payload?: any) {
    ;(this.listeners[event] || []).forEach((fn) => fn(payload))
  }

  async ensureRegistered() {
    if (this.registered && this.client) return

    const res = await fetch("/api/telnyx/rtc/creds")
    if (!res.ok) throw new Error("RTC credentials missing or unauthorized")
    const { login, password } = await res.json()

    const sdk = await getSDK()
    const TelnyxRTC: typeof TelnyxRTCType = (sdk.default || sdk.TelnyxRTC || sdk)

    this.client = new TelnyxRTC({
      login,
      password,
      // Provide ringback tone if you want local ringing; left undefined for now
      ringtoneFile: undefined,
      ringbackFile: undefined,
      debug: true,
    })

    // Ensure an audio element exists to play remote media
    if (!this.audioEl && typeof document !== 'undefined') {
      const el = document.createElement('audio')
      el.id = 'telnyx-remote-audio'
      el.autoplay = true
      el.playsInline = true
      el.hidden = true
      document.body.appendChild(el)
      this.audioEl = el
    }

    // Promise that resolves on ready
    const readyPromise = new Promise<void>((resolve) => {
      this.client.on("telnyx.ready", () => {
        this.registered = true
        this.emit("ready")
        resolve()
      })
    })

    this.client.on("telnyx.error", (e: any) => this.emit("error", e))
    this.client.on("telnyx.notification", (n: any) => {
      const type = n?.type
      if (type === "callUpdate") {
        const state = n?.call?.state
        this.emit("callUpdate", { state, raw: n })
        console.log("[RTC] callUpdate:", state)
        const remote = n?.call?.remoteStream
        if (remote && this.audioEl) {
          try {
            // Attach remote audio and play
            // @ts-ignore - srcObject exists in browsers
            this.audioEl.srcObject = remote
            this.audioEl.play().catch(() => {})
          } catch {}
        }
        if ((state === 'hangup' || state === 'destroy') && this.audioEl) {
          try {
            // @ts-ignore
            this.audioEl.srcObject = null
          } catch {}
        }
      }
    })

    // Connect (constructor creds handle registration; no explicit login() in SDK v2.22.x)
    await this.client.connect()
    await readyPromise
  }

  async startCall(opts: StartCallOpts) {
    await this.ensureRegistered()
    if (!this.client) throw new Error("RTC client not ready")

    // Trigger mic permission explicitly (localhost is allowed without HTTPS)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (err) {
      throw new Error("Microphone access denied or unavailable")
    }
    // Ensure tracks are enabled
    stream.getAudioTracks().forEach(t => (t.enabled = true))
    this.localStream = stream
    this.emit('localStreamChanged', { source: 'startCall' })

    // Light E.164 normalization for US numbers
    const digits = (opts.toNumber || '').replace(/\D/g, '')
    let destination = opts.toNumber
    if (opts.toNumber && !opts.toNumber.startsWith('+')) {
      if (digits.length === 10) destination = `+1${digits}`
      else if (digits.length === 11 && digits.startsWith('1')) destination = `+${digits}`
    }

    const call = await this.client.newCall({
      destinationNumber: destination,
      callerNumber: opts.fromNumber,
      audio: true,
      video: false,
      // Hint the SDK to reuse our granted stream (ignored if unsupported)
      localStream: stream as any,
    })
    // Some SDK builds expose setLocalStream; attach proactively if present
    if ((call as any)?.setLocalStream) {
      try { (call as any).setLocalStream(stream) } catch {}
    }
    this.currentCall = call

    return { sessionId: call?.callId || call?.id || Math.random().toString(36).slice(2) }
  }
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  async switchMicrophone(deviceId: string): Promise<boolean> {
    try {
      // Acquire a new stream from the requested device
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })
      // Ensure tracks enabled
      newStream.getAudioTracks().forEach((t) => (t.enabled = true))

      // Replace track on the peer connection if possible
      const call: any = this.currentCall
      const pc: RTCPeerConnection | undefined = call?.peerConnection || call?.pc || call?.peer
      const newTrack = newStream.getAudioTracks()[0]
      let replaced = false
      if (pc && typeof pc.getSenders === 'function') {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio')
        if (sender && typeof sender.replaceTrack === 'function' && newTrack) {
          await sender.replaceTrack(newTrack)
          replaced = true
        }
      }
      if (!replaced && call && typeof call.setLocalStream === 'function') {
        try {
          call.setLocalStream(newStream)
          replaced = true
        } catch {}
      }

      // Stop old stream tracks and adopt the new one
      if (this.localStream) {
        try { this.localStream.getTracks().forEach((t) => t.stop()) } catch {}
      }
      this.localStream = newStream
      this.emit('localStreamChanged', { source: 'switchMicrophone' })
      return true
    } catch (e) {
      console.warn('[RTC] switchMicrophone failed', e)
      return false
    }
  }

  async listMicrophones(): Promise<Array<{ deviceId: string; label: string }>> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
    } catch (e) {
      console.warn('[RTC] enumerateDevices failed', e)
      return []
    }
  }



  async hangup() {
    try {
      if (this.currentCall) {
        try {
          await this.currentCall.hangup()
        } catch (err: any) {
          // Suppress SDK error when call already ended
          if (!String(err?.message || "").includes("CALL DOES NOT EXIST")) {
            console.warn("[RTC] hangup error", err)
          }
        }
      }
    } finally {
      this.currentCall = null
      if (this.localStream) {
        try { this.localStream.getTracks().forEach(t => t.stop()) } catch {}
        this.localStream = null
      }
    }
  }
}

export const rtcClient = new TelnyxWebRTCClient()

