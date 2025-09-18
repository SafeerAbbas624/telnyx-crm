import Redis from 'ioredis'

// Centralized Redis client factory for server-side utilities (Node runtime)
// Supports either REDIS_URL or discrete REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DB

function makeClient(role: 'publisher' | 'subscriber') {
  const url = process.env.REDIS_URL
  if (url) {
    const client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableAutoPipelining: true,
    })
    client.on('error', (e) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[redis:${role}]`, e?.message || e)
      }
    })
    return client
  }

  const host = process.env.REDIS_HOST || '127.0.0.1'
  const port = parseInt(process.env.REDIS_PORT || '6379', 10)
  const password = process.env.REDIS_PASSWORD || undefined
  const db = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined

  const client = new Redis({ host, port, password, db, lazyConnect: false, maxRetriesPerRequest: null, enableAutoPipelining: true })
  client.on('error', (e) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[redis:${role}]`, e?.message || e)
    }
  })
  return client
}

// Singleton pattern across hot-reloads (dev) and per-process instances (prod)
const g: any = globalThis as any

if (!g.__SSE_REDIS__) {
  const enabled = !!(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT)
  g.__SSE_REDIS__ = {
    enabled,
    channel: process.env.REDIS_SSE_CHANNEL || 'sse:events',
    publisher: enabled ? makeClient('publisher') : null,
    subscriber: enabled ? makeClient('subscriber') : null,
  }
}

export const redisEnabled: boolean = g.__SSE_REDIS__.enabled
export const sseChannel: string = g.__SSE_REDIS__.channel
export const redisPublisher: Redis | null = g.__SSE_REDIS__.publisher
export const redisSubscriber: Redis | null = g.__SSE_REDIS__.subscriber

export function ensureSubscribed(onMessage: (payload: string) => void) {
  if (!redisEnabled || !redisSubscriber) return
  // Subscribe once
  if (!g.__SSE_REDIS__.subscribed) {
    g.__SSE_REDIS__.subscribed = true
    redisSubscriber.subscribe(sseChannel).catch(() => {})
    redisSubscriber.on('message', (channel: string, message: string) => {
      if (channel === sseChannel) {
        onMessage(message)
      }
    })
  }
}

