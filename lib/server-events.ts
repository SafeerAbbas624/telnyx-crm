// Simple in-memory Server-Sent Events broadcaster
// Note: This is per-server-process memory. In dev, hot reloads may reset state.

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

export function addClient(client: Client) {
  clients.set(client.id, client)
  // Send a hello event
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
  const chunk = sseFormat(event, data)
  for (const [, client] of clients) {
    client.write(chunk).catch(() => {
      // Drop client on write failure
      try { client.close?.() } catch {}
      clients.delete(client.id)
    })
  }
}

export function clientCount() {
  return clients.size
}

