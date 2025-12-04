"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import CallRecordingPlayer from "@/components/calls/call-recording-player"

function PlayerContent() {
  const searchParams = useSearchParams()
  const url = searchParams.get('url')
  const callId = searchParams.get('callId')
  const name = searchParams.get('name') || 'Call Recording'
  const startTime = parseInt(searchParams.get('time') || '0')

  if (!url && !callId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-500">
          <p>No recording URL or call ID provided</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <CallRecordingPlayer
          recordingUrl={url || ''}
          callId={callId || undefined}
          contactName={name}
          isModal={true}
        />
      </div>
    </div>
  )
}

export default function CallPlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  )
}

