"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Funder {
  id: string
  name: string
  description?: string
  requiredDocuments: string[]
}

interface FunderManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function FunderManagementDialog({
  open,
  onOpenChange,
}: FunderManagementDialogProps) {
  const { toast } = useToast()
  const [funders, setFunders] = useState<Funder[]>([])
  const [editingFunderId, setEditingFunderId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    requiredDocuments: [] as string[],
  })
  const [newDocument, setNewDocument] = useState("")

  useEffect(() => {
    if (open) {
      loadFunders()
    }
  }, [open])

  const loadFunders = () => {
    try {
      const stored = localStorage.getItem('adler-capital-funders')
      if (stored) {
        setFunders(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load funders:', error)
    }
  }

  const saveFunders = (updatedFunders: Funder[]) => {
    localStorage.setItem('adler-capital-funders', JSON.stringify(updatedFunders))
    setFunders(updatedFunders)
  }

  const handleAddFunder = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Funder name is required",
        variant: "destructive",
      })
      return
    }

    const newFunder: Funder = {
      id: `funder-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      requiredDocuments: formData.requiredDocuments,
    }

    const updated = [...funders, newFunder]
    saveFunders(updated)
    resetForm()
    toast({
      title: "Success",
      description: "Funder added successfully",
    })
  }

  const handleUpdateFunder = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Funder name is required",
        variant: "destructive",
      })
      return
    }

    const updated = funders.map(f =>
      f.id === editingFunderId
        ? {
            ...f,
            name: formData.name,
            description: formData.description,
            requiredDocuments: formData.requiredDocuments,
          }
        : f
    )
    saveFunders(updated)
    resetForm()
    toast({
      title: "Success",
      description: "Funder updated successfully",
    })
  }

  const handleDeleteFunder = (funderId: string) => {
    const updated = funders.filter(f => f.id !== funderId)
    saveFunders(updated)
    toast({
      title: "Success",
      description: "Funder deleted successfully",
    })
  }

  const handleEditFunder = (funder: Funder) => {
    setEditingFunderId(funder.id)
    setFormData({
      name: funder.name,
      description: funder.description || "",
      requiredDocuments: [...funder.requiredDocuments],
    })
  }

  const handleAddDocument = () => {
    if (!newDocument.trim()) return
    setFormData(prev => ({
      ...prev,
      requiredDocuments: [...prev.requiredDocuments, newDocument.trim()],
    }))
    setNewDocument("")
  }

  const handleRemoveDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requiredDocuments: prev.requiredDocuments.filter((_, i) => i !== index),
    }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      requiredDocuments: [],
    })
    setEditingFunderId(null)
    setNewDocument("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Funders</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Add/Edit Funder Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingFunderId ? "Edit Funder" : "Add New Funder"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="funderName">Funder Name *</Label>
                  <Input
                    id="funderName"
                    placeholder="e.g., Kiavi, Visio, ROC Capital"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="funderDescription">Description</Label>
                  <Textarea
                    id="funderDescription"
                    placeholder="Brief description of the funder"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Required Documents</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add document type (e.g., Bank Statements)"
                      value={newDocument}
                      onChange={(e) => setNewDocument(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddDocument()
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddDocument}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {formData.requiredDocuments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.requiredDocuments.map((doc, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {doc}
                          <button
                            onClick={() => handleRemoveDocument(index)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={editingFunderId ? handleUpdateFunder : handleAddFunder}
                  >
                    {editingFunderId ? "Update Funder" : "Add Funder"}
                  </Button>
                  {editingFunderId && (
                    <Button
                      variant="outline"
                      onClick={resetForm}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Funders List */}
            <div className="space-y-2">
              <h3 className="font-semibold">Existing Funders</h3>
              {funders.length === 0 ? (
                <p className="text-sm text-gray-500">No funders added yet</p>
              ) : (
                <div className="space-y-2">
                  {funders.map((funder) => (
                    <Card key={funder.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">{funder.name}</h4>
                            {funder.description && (
                              <p className="text-sm text-gray-600 mt-1">{funder.description}</p>
                            )}
                            {funder.requiredDocuments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {funder.requiredDocuments.map((doc, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {doc}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditFunder(funder)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteFunder(funder.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

