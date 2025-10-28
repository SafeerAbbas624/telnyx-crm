"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, FileText, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DocumentPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: {
    id: string
    fileName: string
    category: string
    status: string
    uploadedAt: string
    path?: string
  } | null
}

export default function DocumentPreviewModal({
  open,
  onOpenChange,
  document,
}: DocumentPreviewModalProps) {
  const { toast } = useToast()
  const [isDownloading, setIsDownloading] = useState(false)

  if (!document) return null

  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || ''
  }

  const getFileIcon = (fileName: string) => {
    const ext = getFileExtension(fileName)
    switch (ext) {
      case 'pdf':
        return '📄'
      case 'doc':
      case 'docx':
        return '📝'
      case 'xls':
      case 'xlsx':
        return '📊'
      case 'jpg':
      case 'jpeg':
      case 'png':
        return '🖼️'
      default:
        return '📎'
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      // Construct the file path
      const filePath = document.path || `/uploads/loans/${document.id}/${document.fileName}`
      
      // Create a link and trigger download
      const link = document.createElement('a')
      link.href = filePath
      link.download = document.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Success",
        description: `${document.fileName} downloaded successfully`,
      })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePreview = () => {
    const ext = getFileExtension(document.fileName)
    
    // For PDFs and images, open in new tab
    if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      const filePath = document.path || `/uploads/loans/${document.id}/${document.fileName}`
      window.open(filePath, '_blank')
    } else {
      toast({
        title: "Info",
        description: `Preview not available for ${ext.toUpperCase()} files. Please download to view.`,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{getFileIcon(document.fileName)}</span>
            {document.fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">Category</div>
              <div className="font-semibold text-sm">{document.category}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-semibold text-sm">{document.status}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Uploaded</div>
              <div className="font-semibold text-sm">{document.uploadedAt}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">File Type</div>
              <div className="font-semibold text-sm">{getFileExtension(document.fileName).toUpperCase()}</div>
            </div>
          </div>

          {/* Preview Area */}
          <div className="border rounded-lg p-8 bg-slate-50 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              {['pdf', 'jpg', 'jpeg', 'png'].includes(getFileExtension(document.fileName))
                ? 'Click "Preview" to view this document'
                : 'Download the file to view its contents'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {['pdf', 'jpg', 'jpeg', 'png'].includes(getFileExtension(document.fileName)) && (
              <Button
                onClick={handlePreview}
                variant="outline"
                className="flex-1"
              >
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
            )}
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isDownloading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

