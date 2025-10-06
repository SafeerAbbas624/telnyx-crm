import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { redisSubscriber } from './redis'

let io: SocketIOServer | null = null

export function initSocketServer(httpServer: HTTPServer) {
  if (io) {
    console.log('Socket.IO server already initialized')
    return io
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
  })

  console.log('✅ Socket.IO server initialized')

  // Handle client connections
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`)

    // Join user-specific room
    socket.on('join', (data: { userId?: string; accountId?: string }) => {
      if (data.userId) {
        socket.join(`user:${data.userId}`)
        console.log(`👤 User ${data.userId} joined their room`)
      }
      if (data.accountId) {
        socket.join(`account:${data.accountId}`)
        console.log(`📧 Account ${data.accountId} joined their room`)
      }
    })

    // Leave rooms
    socket.on('leave', (data: { userId?: string; accountId?: string }) => {
      if (data.userId) {
        socket.leave(`user:${data.userId}`)
      }
      if (data.accountId) {
        socket.leave(`account:${data.accountId}`)
      }
    })

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`)
    })
  })

  // Subscribe to Redis events for email sync updates
  if (redisSubscriber) {
    redisSubscriber.subscribe('email:sync', (err) => {
      if (err) {
        console.error('Failed to subscribe to email:sync channel:', err)
      } else {
        console.log('✅ Subscribed to email:sync Redis channel')
      }
    })

    redisSubscriber.on('message', (channel, message) => {
      if (channel === 'email:sync' && io) {
        try {
          const data = JSON.parse(message)
          console.log('📬 Broadcasting email sync update:', data)
          
          // Broadcast to specific account room
          if (data.accountId) {
            io.to(`account:${data.accountId}`).emit('email:synced', data)
          }
          
          // Broadcast to all connected clients
          io.emit('email:new', data)
        } catch (error) {
          console.error('Error parsing Redis message:', error)
        }
      }
    })
  }

  return io
}

export function getSocketServer(): SocketIOServer | null {
  return io
}

// Helper function to emit events
export function emitToAccount(accountId: string, event: string, data: any) {
  if (io) {
    io.to(`account:${accountId}`).emit(event, data)
  }
}

export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data)
  }
}

export function emitToAll(event: string, data: any) {
  if (io) {
    io.emit(event, data)
  }
}

