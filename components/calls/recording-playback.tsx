'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'

interface RecordingPlaybackProps {
  isOpen: boolean
  onClose: () => void
  recordingUrl: string
  transcript?: string
  contactName?: string
}

export function RecordingPlayback({
  isOpen,
  onClose,
  recordingUrl,
  transcript,
  contactName,
}: RecordingPlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false)
    }
  }

  const handleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume
        setIsMuted(false)
      } else {
        audioRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = recordingUrl
    link.download = `recording-${contactName || 'call'}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recording Playback</DialogTitle>
          <DialogDescription>
            {contactName ? `Call with ${contactName}` : 'Call recording'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Audio Player */}
          <audio ref={audioRef} src={recordingUrl} />

          {/* Player Controls */}
          <div className="space-y-4 bg-muted p-4 rounded-lg">
            {/* Play/Pause and Time */}
            <div className="flex items-center gap-4">
              <Button
                size="sm"
                onClick={handlePlayPause}
                className="w-12 h-12 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>

              <div className="flex-1">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleTimeChange}
                  className="w-full"
                />
              </div>

              <div className="text-sm text-muted-foreground min-w-fit">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground min-w-fit">
                {Math.round(isMuted ? 0 : volume * 100)}%
              </span>
            </div>

            {/* Download Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Recording
            </Button>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="space-y-2">
              <h3 className="font-semibold">Transcript</h3>
              <div className="bg-muted p-4 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{transcript}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

