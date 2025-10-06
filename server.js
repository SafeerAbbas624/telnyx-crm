const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO
  const io = new Server(httpServer, {
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
    socket.on('join', (data) => {
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
    socket.on('leave', (data) => {
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

  // Subscribe to Redis for email sync updates
  const Redis = require('ioredis')
  const redisSubscriber = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  })

  redisSubscriber.subscribe('email:sync', (err) => {
    if (err) {
      console.error('Failed to subscribe to email:sync channel:', err)
    } else {
      console.log('✅ Subscribed to email:sync Redis channel')
    }
  })

  redisSubscriber.on('message', (channel, message) => {
    if (channel === 'email:sync') {
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

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})

