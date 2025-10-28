"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, Download, Eye } from "lucide-react"
import DocumentPreviewModal from "./document-preview-modal"

interface LoanDocument {
  id: string
  fileName: string
  category: string
  status: 'Pending' | 'Uploaded' | 'Reviewed' | 'Approved' | 'Rejected'
  uploadedAt: string
}

interface LoanDocumentsTabProps {
  loanId: string
  documents: LoanDocument[]
  onUpload: (file: File) => void
  onDelete: (docId: string) => void
  funderRequiredDocuments?: string[]
}

const DEFAULT_REQUIRED_DOCUMENTS = [
  { category: 'Tax Returns', required: true, description: '2 years of tax returns' },
  { category: 'Bank Statements', required: true, description: '3 months of statements' },
  { category: 'Property Appraisal', required: true, description: 'Recent appraisal' },
  { category: 'Insurance Quote', required: true, description: 'Property insurance quote' },
  { category: 'Title Report', required: true, description: 'Title search report' },
  { category: 'Lease Agreements', required: false, description: 'Current lease agreements' },
]

export default function LoanDocumentsTab({
  loanId,
  documents,
  onUpload,
  onDelete,
  funderRequiredDocuments
}: LoanDocumentsTabProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<LoanDocument | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Use funder-specific documents if provided, otherwise use defaults
  const requiredDocuments = funderRequiredDocuments
    ? funderRequiredDocuments.map(doc => ({
        category: doc,
        required: true,
        description: `${doc} required by funder`
      }))
    : DEFAULT_REQUIRED_DOCUMENTS

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('loanId', loanId)

      // Upload file to API
      const response = await fetch('/api/loans/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('File uploaded successfully:', data)
        onUpload(file)
      } else {
        console.error('Upload failed:', response.statusText)
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const getDocumentsByCategory = (category: string) => {
    return documents.filter(d => d.category === category)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800'
      case 'Reviewed':
        return 'bg-blue-100 text-blue-800'
      case 'Uploaded':
        return 'bg-yellow-100 text-yellow-800'
      case 'Rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const uploadedCount = documents.length
  const requiredCount = requiredDocuments.filter(d => d.required).length

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="pt-8 pb-8 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Drag and drop documents here</h3>
          <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
          <Button onClick={triggerFileInput} disabled={isUploading}>
            <Upload className="mr-2 h-4 w-4" /> {isUploading ? 'Uploading...' : 'Select Files'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Document Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploaded Documents</span>
              <span className="font-semibold">{uploadedCount} of {requiredCount} required</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(uploadedCount / requiredCount) * 100}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Documents Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Required Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {requiredDocuments.map((doc) => {
                const uploadedDocs = getDocumentsByCategory(doc.category)
                const isComplete = uploadedDocs.length > 0 && uploadedDocs.some(d => d.status === 'Approved')

                return (
                  <div key={doc.category} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50">
                    <div className="mt-1">
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{doc.category}</div>
                      <div className="text-xs text-muted-foreground">{doc.description}</div>
                      {uploadedDocs.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {uploadedDocs.map(d => (
                            <div key={d.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3 w-3" />
                                <span>{d.fileName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(d.status)} variant="outline">
                                  {d.status}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onDelete(d.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* All Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">All Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-slate-50">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{doc.fileName}</div>
                      <div className="text-xs text-muted-foreground">{doc.category} • {doc.uploadedAt}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(doc.status)} variant="outline">
                      {doc.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedDocument(doc)
                        setShowPreviewModal(true)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={() => onDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No documents yet. Upload your first document.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        document={selectedDocument}
      />
    </div>
  )
}

