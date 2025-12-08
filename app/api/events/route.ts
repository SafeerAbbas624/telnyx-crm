import { NextRequest } from 'next/server'
import { addClient, removeClient } from '@/lib/server-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Create a TransformStream to write SSE chunks
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const clientId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const encoder = new TextEncoder()

  // Helper to write to the stream
  const write = async (chunk: Uint8Array) => {
    try {
      await writer.write(chunk)
    } catch (error) {
      // Stream closed, ignore
    }
  }

  addClient({ id: clientId, write })

  // Remove on connection close/abort
  const abort = () => {
    try {
      clearInterval(keepAliveInterval)
      removeClient(clientId)
    } catch {}
  }
  request.signal.addEventListener('abort', abort)

  // Initial comment to open the stream
  await writer.write(encoder.encode(': connected\n\n'))

  // Send keepalive ping every 30 seconds to prevent timeout
  const keepAliveInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(': ping\n\n'))
    } catch {
      clearInterval(keepAliveInterval)
    }
  }, 30000)

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  })
}

