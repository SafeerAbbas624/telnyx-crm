"use client"

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Hook to send periodic heartbeat to server to track user activity
 * This updates the user's lastLoginAt field every 2 minutes while they're active
 */
export function useActivityHeartbeat() {
  const { data: session, status } = useSession()

  useEffect(() => {
    // Only run if user is authenticated
    if (status !== 'authenticated' || !session?.user) {
      return
    }

    // Send initial heartbeat
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/user/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        // Silently fail - this is not critical
        console.debug('Heartbeat failed:', error)
      }
    }

    // Send heartbeat immediately
    sendHeartbeat()

    // Set up interval to send heartbeat every 2 minutes
    const interval = setInterval(() => {
      sendHeartbeat()
    }, 2 * 60 * 1000) // 2 minutes

    // Cleanup on unmount
    return () => {
      clearInterval(interval)
    }
  }, [session, status])
}

