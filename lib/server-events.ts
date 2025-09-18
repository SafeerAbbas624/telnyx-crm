// SSE broadcaster with Redis pub/sub fanout for multi-instance support
// Falls back to in-memory fanout when Redis is unavailable

import { redisEnabled, redisPublisher, redisSubscriber, sseChannel, ensureSubscribed } from '@/lib/redis'

const encoder = new TextEncoder()

type Client = {
  id: string
  write: (chunk: Uint8Array) => Promise<void>
  close?: () => Promise<void> | void
}

const clients = new Map<string, Client>()

function sseFormat(event: string, data: any): Uint8Array {
  const payload = `event: ${event}\n` +
                  `data: ${JSON.stringify(data)}\n\n`
  return encoder.encode(payload)
}

function fanOutLocal(event: string, data: any) {
  const chunk = sseFormat(event, data)
  for (const [, client] of clients) {
    client.write(chunk).catch(() => {
      try { client.close?.() } catch {}
      clients.delete(client.id)
    })
  }
}

// Subscribe to Redis channel once per process and fan-out to local clients
ensureSubscribed((message) => {
  try {
    const parsed = JSON.parse(message)
    if (parsed && typeof parsed.event === 'string') {
      fanOutLocal(parsed.event, parsed.data)
    }
  } catch {
    // ignore
  }
})

export function addClient(client: Client) {
  clients.set(client.id, client)
  client.write(sseFormat('connected', { time: Date.now() })).catch(() => {})
}

export function removeClient(id: string) {
  const c = clients.get(id)
  if (c) {
    try { c.close?.() } catch {}
    clients.delete(id)
  }
}

export function broadcast(event: string, data: any) {
  if (redisEnabled && redisPublisher) {
    // Publish to Redis so all instances (including this one) receive via subscription
    try {
      redisPublisher.publish(sseChannel, JSON.stringify({ event, data })).catch(() => {})
      return
    } catch {
      // if publish fails, fall through to local fanout
    }
  }
  // Fallback/local fanout
  fanOutLocal(event, data)
}

export function clientCount() {
  return clients.size
}

