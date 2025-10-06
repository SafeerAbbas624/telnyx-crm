import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [transport, setTransport] = useState('N/A')

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize socket if not already done
    if (!socket) {
      socket = io({
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', socket?.id)
        setIsConnected(true)
        setTransport(socket?.io.engine.transport.name || 'N/A')

        socket?.io.engine.on('upgrade', (transport) => {
          setTransport(transport.name)
        })
      })

      socket.on('disconnect', () => {
        console.log('🔌 Socket.IO disconnected')
        setIsConnected(false)
      })

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error)
      })
    }

    return () => {
      // Don't disconnect on unmount, keep connection alive
    }
  }, [])

  const joinRoom = useCallback((data: { userId?: string; accountId?: string }) => {
    if (socket && isConnected) {
      socket.emit('join', data)
      console.log('📍 Joined room:', data)
    }
  }, [isConnected])

  const leaveRoom = useCallback((data: { userId?: string; accountId?: string }) => {
    if (socket && isConnected) {
      socket.emit('leave', data)
      console.log('📍 Left room:', data)
    }
  }, [isConnected])

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback)
    }
  }, [])

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback)
      } else {
        socket.off(event)
      }
    }
  }, [])

  const emit = useCallback((event: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(event, data)
    }
  }, [isConnected])

  return {
    socket,
    isConnected,
    transport,
    joinRoom,
    leaveRoom,
    on,
    off,
    emit,
  }
}

// Specific hook for email updates
export function useEmailUpdates(accountId?: string) {
  const { isConnected, joinRoom, leaveRoom, on, off } = useSocket()
  const [newEmailCount, setNewEmailCount] = useState(0)

  useEffect(() => {
    if (!isConnected || !accountId) return

    // Join account room
    joinRoom({ accountId })

    // Listen for email sync events
    const handleEmailSynced = (data: any) => {
      console.log('📬 Email synced:', data)
      if (data.accountId === accountId) {
        setNewEmailCount(prev => prev + (data.count || 0))
      }
    }

    const handleNewEmail = (data: any) => {
      console.log('📧 New email:', data)
      if (data.accountId === accountId) {
        setNewEmailCount(prev => prev + 1)
      }
    }

    on('email:synced', handleEmailSynced)
    on('email:new', handleNewEmail)

    return () => {
      off('email:synced', handleEmailSynced)
      off('email:new', handleNewEmail)
      leaveRoom({ accountId })
    }
  }, [isConnected, accountId, joinRoom, leaveRoom, on, off])

  const resetCount = useCallback(() => {
    setNewEmailCount(0)
  }, [])

  return {
    newEmailCount,
    resetCount,
  }
}

