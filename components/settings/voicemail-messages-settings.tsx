"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Trash2, Play, Pause, Upload, Mic, Star, StarOff, Volume2 } from "lucide-react"
import { toast } from "sonner"

interface VoicemailMessage {
  id: string
  name: string
  description: string | null
  fileName: string
  fileSize: number
  duration: number | null
  isActive: boolean
  isDefault: boolean
  usageCount: number
  createdAt: string
}

export default function VoicemailMessagesSettings() {
  const [voicemails, setVoicemails] = useState<VoicemailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newIsDefault, setNewIsDefault] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchVoicemails()
  }, [])

  const fetchVoicemails = async () => {
    try {
      const res = await fetch('/api/voicemail-messages')
      if (res.ok) {
        const data = await res.json()
        setVoicemails(data.voicemails || [])
      }
    } catch (error) {
      console.error('Failed to fetch voicemails:', error)
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      toast.error('Failed to access microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleSave = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name')
      return
    }

    const audioFile = uploadFile || (recordedBlob ? new File([recordedBlob], 'recording.webm', { type: 'audio/webm' }) : null)
    if (!audioFile) {
      toast.error('Please record or upload an audio file')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('name', newName)
      formData.append('description', newDescription)
      formData.append('audio', audioFile)
      formData.append('isDefault', String(newIsDefault))

      const res = await fetch('/api/voicemail-messages', { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('Voicemail message created')
        setIsDialogOpen(false)
        resetForm()
        fetchVoicemails()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to create voicemail')
      }
    } catch (error) {
      toast.error('Failed to create voicemail')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setNewName("")
    setNewDescription("")
    setNewIsDefault(false)
    setUploadFile(null)
    setRecordedBlob(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this voicemail message?')) return
    try {
      const res = await fetch(`/api/voicemail-messages/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Voicemail deleted')
        fetchVoicemails()
      }
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  const toggleDefault = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/voicemail-messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: !current }),
      })
      if (res.ok) fetchVoicemails()
    } catch (error) {
      toast.error('Failed to update')
    }
  }

  const playAudio = (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause()
      setPlayingId(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(`/api/voicemail-messages/${id}/audio`)
      audio.onended = () => setPlayingId(null)
      audio.play()
      audioRef.current = audio
      setPlayingId(id)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voicemail Messages</h2>
          <p className="text-muted-foreground">Manage pre-recorded voicemail messages for voicemail drop</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Voicemail</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Voicemail Message</DialogTitle>
              <DialogDescription>Record or upload a voicemail message</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Introduction" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional description" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Audio</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={isRecording ? "destructive" : "outline"} onClick={isRecording ? stopRecording : startRecording} className="flex-1">
                    <Mic className="h-4 w-4 mr-2" />{isRecording ? "Stop Recording" : "Record"}
                  </Button>
                  <Label htmlFor="audio-upload" className="flex-1">
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <span><Upload className="h-4 w-4 mr-2" />Upload</span>
                    </Button>
                    <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setRecordedBlob(null) }} />
                  </Label>
                </div>
                {(recordedBlob || uploadFile) && (
                  <p className="text-sm text-green-600">✓ {uploadFile ? uploadFile.name : 'Recording ready'}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newIsDefault} onCheckedChange={setNewIsDefault} />
                <Label>Set as default voicemail</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : voicemails.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No voicemail messages yet. Click "Add Voicemail" to create one.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {voicemails.map((vm) => (
            <Card key={vm.id} className={vm.isDefault ? "border-primary" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => playAudio(vm.id)}>
                    {playingId === vm.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{vm.name}</span>
                      {vm.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{vm.description || vm.fileName} • {formatFileSize(vm.fileSize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => toggleDefault(vm.id, vm.isDefault)} title={vm.isDefault ? "Remove default" : "Set as default"}>
                    {vm.isDefault ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> : <StarOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(vm.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

