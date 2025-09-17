import { NextRequest } from 'next/server'
import { addClient, removeClient } from '@/lib/server-events'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Create a TransformStream to write SSE chunks
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const clientId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Helper to write to the stream
  const write = async (chunk: Uint8Array) => {
    await writer.write(chunk)
  }

  addClient({ id: clientId, write })

  // Remove on connection close/abort
  const abort = () => {
    try { removeClient(clientId) } catch {}
    // Do not close writer here; the Response will be closed by the runtime
  }
  request.signal.addEventListener('abort', abort)

  // Initial comment to open the stream (optional)
  const encoder = new TextEncoder()
  await writer.write(encoder.encode(': connected\n\n'))

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Allow CORS for dev/local if needed
      'Access-Control-Allow-Origin': '*',
    },
  })
}

