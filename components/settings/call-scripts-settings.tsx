"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, FileText, Search, Variable, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { TemplateVariableSelector } from "@/components/ui/template-variable-selector"

interface CallScript {
  id: string
  name: string
  description: string | null
  content: string
  variables: string[]
  isActive: boolean
  usageCount: number
  createdAt: string
  _count?: { campaigns: number }
}

export default function CallScriptsSettings() {
  const [scripts, setScripts] = useState<CallScript[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingScript, setEditingScript] = useState<CallScript | null>(null)
  const [scriptToDelete, setScriptToDelete] = useState<CallScript | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", content: "" })
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchScripts()
  }, [])

  const fetchScripts = async () => {
    try {
      const res = await fetch('/api/call-scripts')
      const data = await res.json()
      if (data.scripts) setScripts(data.scripts)
    } catch (error) {
      toast.error('Failed to load call scripts')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingScript(null)
    setFormData({ name: "", description: "", content: "" })
    setDialogOpen(true)
  }

  const handleEdit = (script: CallScript) => {
    setEditingScript(script)
    setFormData({ name: script.name, description: script.description || "", content: script.content })
    setDialogOpen(true)
  }

  const handleDelete = (script: CallScript) => {
    setScriptToDelete(script)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!scriptToDelete) return
    try {
      const res = await fetch(`/api/call-scripts/${scriptToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Script deleted')
      fetchScripts()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setDeleteDialogOpen(false)
      setScriptToDelete(null)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Name and content are required')
      return
    }
    setSaving(true)
    try {
      const url = editingScript ? `/api/call-scripts/${editingScript.id}` : '/api/call-scripts'
      const method = editingScript ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(editingScript ? 'Script updated' : 'Script created')
      setDialogOpen(false)
      fetchScripts()
    } catch (error) {
      toast.error('Failed to save script')
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = contentRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = formData.content.substring(0, start) + `{${variable}}` + formData.content.substring(end)
    setFormData({ ...formData, content: newContent })
    setTimeout(() => {
      textarea.focus()
      const newPos = start + variable.length + 2
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const copyScript = (script: CallScript) => {
    navigator.clipboard.writeText(script.content)
    setCopiedId(script.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Script copied to clipboard')
  }

  const filteredScripts = scripts.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Call Scripts
              </CardTitle>
              <CardDescription>Create and manage scripts for your call campaigns</CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Script
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Script list */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading scripts...</div>
          ) : filteredScripts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No scripts match your search' : 'No scripts yet. Create your first script!'}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {filteredScripts.map((script) => (
                  <div key={script.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{script.name}</h3>
                          {!script.isActive && <Badge variant="secondary">Inactive</Badge>}
                          {script._count?.campaigns && script._count.campaigns > 0 && (
                            <Badge variant="outline">{script._count.campaigns} campaign(s)</Badge>
                          )}
                        </div>
                        {script.description && (
                          <p className="text-sm text-muted-foreground mt-1">{script.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{script.content}</p>
                        {script.variables && script.variables.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <Variable className="h-3 w-3 text-muted-foreground" />
                            {(script.variables as string[]).map((v) => (
                              <Badge key={v} variant="secondary" className="text-xs">{`{${v}}`}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button variant="ghost" size="icon" onClick={() => copyScript(script)}>
                          {copiedId === script.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(script)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(script)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingScript ? 'Edit Script' : 'Create Script'}</DialogTitle>
            <DialogDescription>
              Create a call script with variables that will be replaced with contact data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Cold Call Introduction"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of when to use this script"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Script Content</Label>
                <TemplateVariableSelector onSelect={insertVariable} />
              </div>
              <Textarea
                ref={contentRef}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Hi {firstName}, this is [Your Name] calling about your property at {propertyAddress}..."
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{variableName}'} to insert contact data. Click the variable picker above to insert variables.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingScript ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{scriptToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

