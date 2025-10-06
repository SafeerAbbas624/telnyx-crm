"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Layers, Plus, Check } from "lucide-react"

interface TagTemplate {
  id: string
  name: string
  description: string
  tags: Array<{
    name: string
    color: string
    description: string
  }>
}

interface TagTemplatesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedContactIds?: string[]
  onTemplateApplied?: () => void
}

export default function TagTemplates({
  open,
  onOpenChange,
  selectedContactIds = [],
  onTemplateApplied
}: TagTemplatesProps) {
  const [templates, setTemplates] = useState<TagTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open])

  const fetchTemplates = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/tags/templates')
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      const data = await response.json()
      setTemplates(data.templates)
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast({
        title: "Error",
        description: "Failed to load tag templates",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const applyTemplate = async (templateId: string) => {
    setIsApplying(true)
    try {
      const response = await fetch('/api/tags/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          contactIds: selectedContactIds
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to apply template')
      }

      const result = await response.json()
      
      toast({
        title: "Template Applied",
        description: `Created ${result.createdTags.length} tags${selectedContactIds.length > 0 ? ` and applied to ${selectedContactIds.length} contacts` : ''}`,
      })

      onTemplateApplied?.()
      onOpenChange(false)

    } catch (error) {
      console.error('Error applying template:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to apply template',
        variant: "destructive"
      })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Tag Templates
          </DialogTitle>
          {selectedContactIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Templates will be applied to {selectedContactIds.length} selected contacts
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading templates...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
              {templates.map((template) => (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === template.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {template.name}
                      {selectedTemplate === template.id && (
                        <Check className="h-5 w-5 text-blue-500" />
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Tags ({template.tags.length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 6).map((tag, index) => (
                          <Badge
                            key={index}
                            style={{
                              backgroundColor: tag.color,
                              color: 'white'
                            }}
                            className="text-xs"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {template.tags.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.tags.length - 6} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Selected Template Details */}
        {selectedTemplate && (
          <div className="border-t pt-4">
            {(() => {
              const template = templates.find(t => t.id === selectedTemplate)
              if (!template) return null
              
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Preview: {template.name}</h4>
                    <Button
                      onClick={() => applyTemplate(template.id)}
                      disabled={isApplying}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {isApplying ? 'Applying...' : 'Apply Template'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {template.tags.map((tag, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <Badge
                          style={{
                            backgroundColor: tag.color,
                            color: 'white'
                          }}
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex-1">
                          {tag.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
