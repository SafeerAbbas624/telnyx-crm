"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, FileText, Eye, Save, Copy } from "lucide-react"

interface MessageTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  description?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

interface TemplateManagerProps {
  selectedTemplate: MessageTemplate | null
  onTemplateSelect: (template: MessageTemplate | null) => void
  onTemplateApply: (content: string) => void
}

export default function TemplateManager({
  selectedTemplate,
  onTemplateSelect,
  onTemplateApply,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    description: "",
  })
  const [activeTab, setActiveTab] = useState<"select" | "create">("select")

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      })
    }
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({
        title: "Error",
        description: "Name and content are required",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const newTemplate = await response.json()
        setTemplates([newTemplate, ...templates])
        setShowCreateDialog(false)
        setFormData({ name: "", content: "", description: "" })
        toast({
          title: "Success",
          description: "Template created successfully",
        })
      } else {
        throw new Error('Failed to create template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditTemplate = async () => {
    if (!editingTemplate || !formData.name.trim() || !formData.content.trim()) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const updatedTemplate = await response.json()
        setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t))
        setShowEditDialog(false)
        setEditingTemplate(null)
        setFormData({ name: "", content: "", description: "" })
        toast({
          title: "Success",
          description: "Template updated successfully",
        })
      } else {
        throw new Error('Failed to update template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update template",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async (template: MessageTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== template.id))
        if (selectedTemplate?.id === template.id) {
          onTemplateSelect(null)
        }
        toast({
          title: "Success",
          description: "Template deleted successfully",
        })
      } else {
        throw new Error('Failed to delete template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      })
    }
  }

  const handleDuplicateTemplate = async (template: MessageTemplate) => {
    const duplicatedTemplate = {
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined, // Let the API generate a new ID
    }

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatedTemplate),
      })

      if (response.ok) {
        const newTemplate = await response.json()
        setTemplates([newTemplate, ...templates])
        toast({
          title: "Success",
          description: "Template duplicated successfully",
        })
      } else {
        throw new Error('Failed to duplicate template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate template",
        variant: "destructive",
      })
    }
  }

  const handleApplyTemplate = async (template: MessageTemplate) => {
    try {
      // Track usage
      await fetch(`/api/templates/${template.id}/use`, { method: 'POST' })
      
      // Update local usage count
      setTemplates(templates.map(t => 
        t.id === template.id 
          ? { ...t, usageCount: t.usageCount + 1 }
          : t
      ))

      onTemplateApply(template.content)
      onTemplateSelect(template)
      
      toast({
        title: "Success",
        description: `Template "${template.name}" applied`,
      })
    } catch (error) {
      console.error('Error applying template:', error)
    }
  }

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      content: template.content,
      description: template.description || "",
    })
    setShowEditDialog(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Message Templates
          </CardTitle>
          <Button
            onClick={() => {
              setActiveTab("select")
              setShowCreateDialog(true)
            }}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template List */}
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No templates available
            </p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  onTemplateSelect(template)
                  onTemplateApply(template.content)
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.content}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(template)
                      }}
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicateTemplate(template)
                      }}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(template)
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Template Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                className={`px-4 py-2 text-sm border-b-2 ${
                  activeTab === "select"
                    ? "font-medium text-gray-900 border-gray-900"
                    : "text-gray-500 border-transparent"
                }`}
                onClick={() => setActiveTab("select")}
              >
                Select Template
              </button>
              <button
                className={`px-4 py-2 text-sm border-b-2 ${
                  activeTab === "create"
                    ? "font-medium text-gray-900 border-gray-900"
                    : "text-gray-500 border-transparent"
                }`}
                onClick={() => setActiveTab("create")}
              >
                Create/Edit Template
              </button>
            </div>

            {/* Select Template Tab */}
            {activeTab === "select" && (
              <div className="space-y-4 mt-4">
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No templates available. Create your first template using the "Create/Edit Template" tab.
                    </p>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <span className="text-xs text-gray-500">{template.usageCount} uses</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {template.content}
                        </p>
                        <Button
                          onClick={() => {
                            onTemplateSelect(template)
                            onTemplateApply(template.content)
                            setShowCreateDialog(false)
                          }}
                          className="w-full"
                          size="sm"
                        >
                          Select Template
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Create/Edit Template Tab */}
            {activeTab === "create" && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter template name"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Message Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter your message template. Use {firstName}, {propertyAddress}, etc. for variables."
                    rows={8}
                    className="min-h-[200px]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use curly braces to add variables: {`{firstName}`}, {`{propertyAddress}`}, {`{city}`}, {`{state}`}, etc.
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Available Variables</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-700">{`{firstName}`}</div>
                      <div className="text-gray-700">{`{lastName}`}</div>
                      <div className="text-gray-700">{`{fullName}`}</div>
                      <div className="text-gray-700">{`{llcName}`}</div>
                      <div className="text-gray-700">{`{phone1}`}</div>
                      <div className="text-gray-700">{`{phone2}`}</div>
                      <div className="text-gray-700">{`{phone3}`}</div>
                      <div className="text-gray-700">{`{phone}`}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-700">{`{email1}`}</div>
                      <div className="text-gray-700">{`{email2}`}</div>
                      <div className="text-gray-700">{`{email3}`}</div>
                      <div className="text-gray-700">{`{email}`}</div>
                      <div className="text-gray-700">{`{propertyAddress}`}</div>
                      <div className="text-gray-700">{`{contactAddress}`}</div>
                      <div className="text-gray-700">{`{city}`}</div>
                      <div className="text-gray-700">{`{state}`}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-700">{`{propertyType}`}</div>
                      <div className="text-gray-700">{`{propertyCounty}`}</div>
                      <div className="text-gray-700">{`{bedrooms}`}</div>
                      <div className="text-gray-700">{`{totalBathrooms}`}</div>
                      <div className="text-gray-700">{`{buildingSqft}`}</div>
                      <div className="text-gray-700">{`{effectiveYearBuilt}`}</div>
                      <div className="text-gray-700">{`{estValue}`}</div>
                      <div className="text-gray-700">{`{estEquity}`}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              {activeTab === "create" && (
                <Button onClick={handleCreateTemplate} disabled={isLoading} className="bg-gray-800 hover:bg-gray-900">
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Template"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Template Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex border-b">
              <button className="px-4 py-2 text-sm text-gray-500 border-b-2 border-transparent">
                Select Template
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-900 border-b-2 border-gray-900">
                Create/Edit Template
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Template Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter template name"
                />
              </div>

              <div>
                <Label htmlFor="edit-content">Message Content</Label>
                <Textarea
                  id="edit-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter your message template. Use {firstName}, {propertyAddress}, etc. for variables."
                  rows={8}
                  className="min-h-[200px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use curly braces to add variables: {`{firstName}`}, {`{propertyAddress}`}, {`{city}`}, {`{state}`}, etc.
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Available Variables</Label>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div className="space-y-1">
                    <div className="text-gray-700">{`{firstName}`}</div>
                    <div className="text-gray-700">{`{lastName}`}</div>
                    <div className="text-gray-700">{`{fullName}`}</div>
                    <div className="text-gray-700">{`{llcName}`}</div>
                    <div className="text-gray-700">{`{phone1}`}</div>
                    <div className="text-gray-700">{`{phone2}`}</div>
                    <div className="text-gray-700">{`{phone3}`}</div>
                    <div className="text-gray-700">{`{phone}`}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-700">{`{email1}`}</div>
                    <div className="text-gray-700">{`{email2}`}</div>
                    <div className="text-gray-700">{`{email3}`}</div>
                    <div className="text-gray-700">{`{email}`}</div>
                    <div className="text-gray-700">{`{propertyAddress}`}</div>
                    <div className="text-gray-700">{`{contactAddress}`}</div>
                    <div className="text-gray-700">{`{city}`}</div>
                    <div className="text-gray-700">{`{state}`}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-700">{`{propertyType}`}</div>
                    <div className="text-gray-700">{`{propertyCounty}`}</div>
                    <div className="text-gray-700">{`{bedrooms}`}</div>
                    <div className="text-gray-700">{`{totalBathrooms}`}</div>
                    <div className="text-gray-700">{`{buildingSqft}`}</div>
                    <div className="text-gray-700">{`{effectiveYearBuilt}`}</div>
                    <div className="text-gray-700">{`{estValue}`}</div>
                    <div className="text-gray-700">{`{estEquity}`}</div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditTemplate} disabled={isLoading} className="bg-gray-800 hover:bg-gray-900">
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
