"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Phone, PhoneOff, Loader2 } from "lucide-react"

/**
 * Auto-registers the WebRTC client on app load so inbound calls can be received.
 * Shows a small status indicator in the top-right corner.
 */
export default function WebRTCAutoRegister() {
  const { data: session, status } = useSession()
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'registering' | 'registered' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only register if user is authenticated
    if (status !== "authenticated" || !session?.user) {
      return
    }

    // Don't re-register if already registered
    if (registrationStatus === 'registered') {
      return
    }

    let mounted = true
    let retryTimeout: NodeJS.Timeout | null = null

    const register = async () => {
      try {
        if (mounted) setRegistrationStatus('registering')
        console.log("[WebRTC] Starting auto-registration for inbound calls...")
        const { rtcClient } = await import("@/lib/webrtc/rtc-client")

        // Check if already registered
        if (rtcClient.isReady()) {
          console.log("[WebRTC] Already registered")
          if (mounted) {
            setRegistrationStatus('registered')
            setError(null)
          }
          return
        }

        await rtcClient.ensureRegistered()

        if (mounted) {
          setRegistrationStatus('registered')
          setError(null)
          console.log("[WebRTC] ✅ Auto-registered successfully - ready for inbound calls!")
        }
      } catch (err: any) {
        console.error("[WebRTC] Auto-registration failed:", err)
        if (mounted) {
          setRegistrationStatus('error')
          setError(err.message || "Failed to register WebRTC")
          // Retry in 30 seconds
          retryTimeout = setTimeout(register, 30000)
        }
      }
    }

    // Small delay to let the app settle
    const initTimeout = setTimeout(register, 2000)

    return () => {
      mounted = false
      if (initTimeout) clearTimeout(initTimeout)
      if (retryTimeout) clearTimeout(retryTimeout)
    }
  }, [session, status, registrationStatus])

  // Show status indicator
  if (status !== "authenticated") return null

  return (
    <div className="fixed top-20 right-4 z-40">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium shadow-sm cursor-help ${
          registrationStatus === 'registered'
            ? 'bg-green-100 text-green-700 border border-green-200'
            : registrationStatus === 'registering'
            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            : registrationStatus === 'error'
            ? 'bg-red-100 text-red-700 border border-red-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
        }`}
        title={
          registrationStatus === 'registered'
            ? 'WebRTC connected - Ready to receive inbound calls'
            : registrationStatus === 'registering'
            ? 'Connecting to Telnyx...'
            : registrationStatus === 'error'
            ? `Error: ${error}`
            : 'Initializing...'
        }
      >
        {registrationStatus === 'registered' && (
          <>
            <Phone className="h-3 w-3" />
            <span>Ready</span>
          </>
        )}
        {registrationStatus === 'registering' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Connecting...</span>
          </>
        )}
        {registrationStatus === 'error' && (
          <>
            <PhoneOff className="h-3 w-3" />
            <span>Offline</span>
          </>
        )}
        {registrationStatus === 'idle' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Init...</span>
          </>
        )}
      </div>
    </div>
  )
}

