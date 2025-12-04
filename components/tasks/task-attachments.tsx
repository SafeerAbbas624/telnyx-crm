"use client"

import React, { useState, useEffect } from "react"
import { Upload, Trash2, Download, File } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"

interface Attachment {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
  createdAt: string
  uploadedBy: {
    name: string
  }
}

interface TaskAttachmentsProps {
  taskId: string
}

export default function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchAttachments()
  }, [taskId])

  const fetchAttachments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tasks/attachments?taskId=${taskId}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setAttachments(data)
    } catch (error) {
      console.error('Error fetching attachments:', error)
      toast({ title: 'Error', description: 'Failed to load attachments' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      const file = files[0]

      const formData = new FormData()
      formData.append('taskId', taskId)
      formData.append('file', file)

      const response = await fetch('/api/tasks/attachments', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to upload')

      const newAttachment = await response.json()
      setAttachments([newAttachment, ...attachments])
      toast({ title: 'Success', description: 'File uploaded successfully' })
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({ title: 'Error', description: 'Failed to upload file' })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return

    try {
      const response = await fetch('/api/tasks/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentId }),
      })

      if (!response.ok) throw new Error('Failed to delete')

      setAttachments(attachments.filter(a => a.id !== attachmentId))
      toast({ title: 'Success', description: 'Attachment deleted' })
    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast({ title: 'Error', description: 'Failed to delete attachment' })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊'
    return '📎'
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Attachments</h3>
        <label>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <Button asChild disabled={uploading} size="sm">
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </span>
          </Button>
        </label>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading...</div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No attachments yet</div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <Card key={attachment.id} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">
                    {getFileIcon(attachment.fileType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{attachment.fileName}</p>
                    <div className="flex gap-2 text-xs text-gray-600">
                      <span>{formatFileSize(attachment.fileSize)}</span>
                      <span>•</span>
                      <span>{attachment.uploadedBy.name}</span>
                      <span>•</span>
                      <span>{new Date(attachment.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(attachment.fileUrl, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

