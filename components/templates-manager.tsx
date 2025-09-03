"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Copy, Save, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { mockTemplates } from "@/lib/mock-templates"

interface Template {
  id: string
  name: string
  content: string
  variables: string[]
}

export default function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [newTemplate, setNewTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateContent, setTemplateContent] = useState("")
  const { toast } = useToast()

  const handleCreateTemplate = () => {
    setNewTemplate(true)
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateContent("")
  }

  const handleEditTemplate = (template: Template) => {
    setNewTemplate(false)
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateContent(template.content)
  }

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId))
    toast({
      title: "Template deleted",
      description: "The message template has been deleted",
    })
  }

  const handleDuplicateTemplate = (template: Template) => {
    const newId = `template-${Date.now()}`
    const duplicatedTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (Copy)`,
    }

    setTemplates([...templates, duplicatedTemplate])
    toast({
      title: "Template duplicated",
      description: "A copy of the template has been created",
    })
  }

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !templateContent.trim()) {
      toast({
        title: "Error",
        description: "Template name and content are required",
        variant: "destructive",
      })
      return
    }

    // Extract variables from content (format: {variableName})
    const variableRegex = /\{([^}]+)\}/g
    const matches = templateContent.matchAll(variableRegex)
    const variables: string[] = []

    for (const match of matches) {
      if (match[1] && !variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    if (newTemplate) {
      const newId = `template-${Date.now()}`
      setTemplates([
        ...templates,
        {
          id: newId,
          name: templateName,
          content: templateContent,
          variables,
        },
      ])

      toast({
        title: "Template created",
        description: "New message template has been created",
      })
    } else if (editingTemplate) {
      setTemplates(
        templates.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                name: templateName,
                content: templateContent,
                variables,
              }
            : t,
        ),
      )

      toast({
        title: "Template updated",
        description: "The message template has been updated",
      })
    }

    setNewTemplate(false)
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateContent("")
  }

  const handleCancelEdit = () => {
    setNewTemplate(false)
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateContent("")
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-2">Message Templates</h2>
          <p className="text-muted-foreground">Create and manage message templates for bulk messaging</p>
        </div>
        <Button onClick={handleCreateTemplate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium mb-3">Your Templates</h3>
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {templates.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No templates yet</p>
                    <Button variant="outline" className="mt-4" onClick={handleCreateTemplate}>
                      Create your first template
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{template.content}</p>
                      {template.variables.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Variables:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.variables.map((variable) => (
                              <span key={variable} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {variable}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicateTemplate(template)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditTemplate(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div>
          <h3 className="font-medium mb-3">
            {newTemplate ? "Create New Template" : editingTemplate ? "Edit Template" : "Template Editor"}
          </h3>

          {newTemplate || editingTemplate ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="Enter template name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-content">Message Content</Label>
                  <Textarea
                    id="template-content"
                    placeholder="Enter your message template. Use {firstName}, {propertyAddress}, etc. for variables."
                    rows={10}
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use curly braces to add variables: {"{firstName}"}, {"{propertyAddress}"}, {"{cityState}"}, etc.
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTemplate}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Select a template to edit or create a new one</p>
                <Button variant="outline" className="mt-4" onClick={handleCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Template
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="mt-6">
            <h3 className="font-medium mb-3">Available Variables</h3>
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{"{firstName}"}</span>
                    <p className="text-xs text-muted-foreground">Contact&apos;s first name</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{"{lastName}"}</span>
                    <p className="text-xs text-muted-foreground">Contact&apos;s last name</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{"{propertyAddress}"}</span>
                    <p className="text-xs text-muted-foreground">Property address</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{"{cityState}"}</span>
                    <p className="text-xs text-muted-foreground">City and state</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{"{propertyType}"}</span>
                    <p className="text-xs text-muted-foreground">Type of property</p>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{"{llcName}"}</span>
                    <p className="text-xs text-muted-foreground">LLC name if available</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
