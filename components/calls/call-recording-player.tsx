"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Play, Pause, Volume2, VolumeX, ExternalLink, Copy, Link2,
  SkipBack, SkipForward, X, Download, RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CallRecordingPlayerProps {
  recordingUrl: string
  callId?: string  // Optional call ID to fetch fresh URLs
  contactName?: string
  callDate?: string
  duration?: number
  onClose?: () => void
  isModal?: boolean
}

export default function CallRecordingPlayer({
  recordingUrl: initialUrl,
  callId,
  contactName,
  callDate,
  duration,
  onClose,
  isModal = false
}: CallRecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [recordingUrl, setRecordingUrl] = useState(initialUrl)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration || 0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch fresh recording URL from API
  const refreshRecordingUrl = useCallback(async () => {
    if (!callId) return null

    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/telnyx/recordings/${callId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          setRecordingUrl(data.url)
          setError(null)
          return data.url
        }
      }
    } catch (err) {
      console.error('Error refreshing recording URL:', err)
    } finally {
      setIsRefreshing(false)
    }
    return null
  }, [callId])

  // Try to refresh URL on mount if we have a callId
  useEffect(() => {
    if (callId) {
      refreshRecordingUrl()
    }
  }, [callId, refreshRecordingUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setAudioDuration(audio.duration || duration || 0)
    const handleEnded = () => setIsPlaying(false)
    const handleCanPlay = () => {
      setIsLoading(false)
      setError(null)
    }
    const handleError = async () => {
      // If URL expired, try to refresh it
      if (callId) {
        const freshUrl = await refreshRecordingUrl()
        if (freshUrl && audioRef.current) {
          audioRef.current.load()
          return
        }
      }
      setError("Recording not available. URL may have expired.")
      setIsLoading(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('error', handleError)
    }
  }, [duration, callId, refreshRecordingUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return
    const newVolume = value[0]
    audioRef.current.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    audioRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const skip = (seconds: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(audioDuration, currentTime + seconds))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const copyLink = (withTimestamp = false) => {
    const url = withTimestamp ? `${recordingUrl}#t=${Math.floor(currentTime)}` : recordingUrl
    navigator.clipboard.writeText(url)
    setCopied(withTimestamp ? 'timestamp' : 'link')
    setTimeout(() => setCopied(null), 2000)
  }

  const openInNewWindow = () => {
    const params = `width=500,height=250,toolbar=no,menubar=no,scrollbars=no`
    const callIdParam = callId ? `&callId=${callId}` : ''
    window.open(`/calls/player?url=${encodeURIComponent(recordingUrl)}&name=${encodeURIComponent(contactName || 'Call')}&time=${Math.floor(currentTime)}${callIdParam}`, 'recording', params)
  }

  return (
    <div className={cn(
      "bg-white border rounded-lg shadow-lg",
      isModal ? "p-4" : "p-3"
    )}>
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          {contactName && <div className="font-medium text-sm truncate">{contactName}</div>}
          {callDate && <div className="text-xs text-gray-500">{callDate}</div>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyLink(false)} title="Copy link">
            {copied === 'link' ? <span className="text-xs text-green-600">✓</span> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyLink(true)} title="Copy link at current time">
            {copied === 'timestamp' ? <span className="text-xs text-green-600">✓</span> : <Link2 className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={openInNewWindow} title="Open in new window">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <a href={recordingUrl} download className="inline-flex">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </a>
          {onClose && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="text-center py-3">
          <div className="text-sm text-red-500 mb-2">{error}</div>
          {callId && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const freshUrl = await refreshRecordingUrl()
                if (freshUrl && audioRef.current) {
                  audioRef.current.load()
                }
              }}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Try Again
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="mb-3">
            <Slider
              value={[currentTime]}
              max={audioDuration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => skip(-10)} title="Back 10s">
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              variant="default"
              className="h-10 w-10 p-0 rounded-full"
              onClick={togglePlay}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => skip(10)} title="Forward 10s">
              <SkipForward className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 ml-4">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={toggleMute}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

