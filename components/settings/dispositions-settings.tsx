'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus, Trash2, Edit, GripVertical, ThumbsUp, ThumbsDown, Calendar, Voicemail, Ban, PhoneMissed, PhoneOff, Check, Loader2
} from 'lucide-react'

interface DispositionAction {
  id?: string
  actionType: string
  config: Record<string, unknown>
}

interface Disposition {
  id: string
  name: string
  description?: string
  color: string
  icon?: string
  sortOrder: number
  isDefault: boolean
  actions: DispositionAction[]
}

const ACTION_TYPES = [
  { value: 'ADD_TAG', label: 'Add Tag' },
  { value: 'REMOVE_TAG', label: 'Remove Tag' },
  { value: 'ADD_TO_DNC', label: 'Add to DNC' },
  { value: 'REMOVE_FROM_DNC', label: 'Remove from DNC' },
  { value: 'TRIGGER_SEQUENCE', label: 'Trigger Sequence' },
  { value: 'SEND_SMS', label: 'Send SMS' },
  { value: 'SEND_EMAIL', label: 'Send Email' },
  { value: 'CREATE_TASK', label: 'Create Task' }
]

const ICON_OPTIONS = [
  { value: 'ThumbsUp', label: 'Thumbs Up', icon: ThumbsUp },
  { value: 'ThumbsDown', label: 'Thumbs Down', icon: ThumbsDown },
  { value: 'Calendar', label: 'Calendar', icon: Calendar },
  { value: 'Voicemail', label: 'Voicemail', icon: Voicemail },
  { value: 'Ban', label: 'Ban', icon: Ban },
  { value: 'PhoneMissed', label: 'Phone Missed', icon: PhoneMissed },
  { value: 'PhoneOff', label: 'Phone Off', icon: PhoneOff },
  { value: 'Check', label: 'Check', icon: Check }
]

const COLOR_OPTIONS = [
  '#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#6b7280', '#000000', '#eab308'
]

export default function DispositionsSettings() {
  const [dispositions, setDispositions] = useState<Disposition[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDisposition, setEditingDisposition] = useState<Disposition | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formColor, setFormColor] = useState('#3b82f6')
  const [formIcon, setFormIcon] = useState('ThumbsUp')
  const [formActions, setFormActions] = useState<DispositionAction[]>([])

  useEffect(() => {
    loadDispositions()
  }, [])

  const loadDispositions = async () => {
    try {
      const res = await fetch('/api/dispositions')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDispositions(data)
      }
    } catch (error) {
      toast.error('Failed to load dispositions')
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingDisposition(null)
    setFormName('')
    setFormDescription('')
    setFormColor('#3b82f6')
    setFormIcon('ThumbsUp')
    setFormActions([])
    setIsDialogOpen(true)
  }

  const openEditDialog = (dispo: Disposition) => {
    setEditingDisposition(dispo)
    setFormName(dispo.name)
    setFormDescription(dispo.description || '')
    setFormColor(dispo.color)
    setFormIcon(dispo.icon || 'ThumbsUp')
    setFormActions(dispo.actions.map(a => ({ ...a })))
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formName,
        description: formDescription,
        color: formColor,
        icon: formIcon,
        actions: formActions
      }
      const url = editingDisposition ? `/api/dispositions/${editingDisposition.id}` : '/api/dispositions'
      const method = editingDisposition ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(editingDisposition ? 'Disposition updated' : 'Disposition created')
      setIsDialogOpen(false)
      loadDispositions()
    } catch {
      toast.error('Failed to save disposition')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this disposition?')) return
    try {
      await fetch(`/api/dispositions/${id}`, { method: 'DELETE' })
      toast.success('Disposition deleted')
      loadDispositions()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const addAction = () => {
    setFormActions([...formActions, { actionType: 'ADD_TAG', config: {} }])
  }

  const removeAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, field: string, value: unknown) => {
    const updated = [...formActions]
    if (field === 'actionType') {
      updated[index] = { actionType: value as string, config: {} }
    } else {
      updated[index] = { ...updated[index], config: { ...updated[index].config, [field]: value } }
    }
    setFormActions(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Call Dispositions</CardTitle>
            <CardDescription>Configure call outcomes and automation rules</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Disposition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingDisposition ? 'Edit Disposition' : 'Create Disposition'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Interested" />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map(c => (
                        <button key={c} className={`w-8 h-8 rounded-full border-2 ${formColor === c ? 'border-black' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setFormColor(c)} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional description" />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select value={formIcon} onValueChange={setFormIcon}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Automation Actions</Label>
                    <Button variant="outline" size="sm" onClick={addAction}>
                      <Plus className="h-4 w-4 mr-1" /> Add Action
                    </Button>
                  </div>
                  {formActions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No actions configured. Add actions to automate tasks when this disposition is selected.</p>
                  )}
                  {formActions.map((action, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                        <div className="flex-1 space-y-2">
                          <Select value={action.actionType} onValueChange={(v) => updateAction(idx, 'actionType', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(action.actionType === 'ADD_TAG' || action.actionType === 'REMOVE_TAG') && (
                            <Input placeholder="Tag name" value={(action.config.tagName as string) || ''} onChange={(e) => updateAction(idx, 'tagName', e.target.value)} />
                          )}
                          {action.actionType === 'ADD_TO_DNC' && (
                            <Input placeholder="Reason (optional)" value={(action.config.reason as string) || ''} onChange={(e) => updateAction(idx, 'reason', e.target.value)} />
                          )}
                          {action.actionType === 'CREATE_TASK' && (
                            <>
                              <Input placeholder="Task title" value={(action.config.taskTitle as string) || ''} onChange={(e) => updateAction(idx, 'taskTitle', e.target.value)} />
                              <Input type="number" placeholder="Due in days" value={(action.config.taskDueInDays as number) || ''} onChange={(e) => updateAction(idx, 'taskDueInDays', parseInt(e.target.value))} />
                            </>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeAction(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingDisposition ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dispositions.map(dispo => {
              const IconComp = ICON_OPTIONS.find(i => i.value === dispo.icon)?.icon || ThumbsUp
              return (
                <div key={dispo.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: dispo.color }}>
                      <IconComp className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {dispo.name}
                        {dispo.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dispo.actions.length} action{dispo.actions.length !== 1 ? 's' : ''}
                        {dispo.description && ` • ${dispo.description}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(dispo)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!dispo.isDefault && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(dispo.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            {dispositions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No dispositions configured. Click &quot;Add Disposition&quot; to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

