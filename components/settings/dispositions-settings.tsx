'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Plus, Trash2, Edit, GripVertical, ThumbsUp, ThumbsDown, Calendar, Voicemail, Ban, PhoneMissed, PhoneOff, Check, Loader2, MessageSquare, Mail, Clock,
  // Additional icons for disposition customization
  Star, Heart, AlertCircle, XCircle, CheckCircle, UserX, UserCheck, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing,
  DollarSign, TrendingUp, Home, Building, FileText, Send, RefreshCw, Bell, Target, Zap
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

interface SmsTemplate {
  id: string
  name: string
  content: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
}

interface Sequence {
  id: string
  name: string
}

interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface Tag {
  id: string
  name: string
  color: string
}

const ACTION_TYPES = [
  { value: 'ADD_TAG', label: 'Add Tag', desc: 'Add a tag to the contact' },
  { value: 'REMOVE_TAG', label: 'Remove Tag', desc: 'Remove a tag from the contact' },
  { value: 'ADD_TO_DNC', label: 'Add to DNC', desc: 'Add contact to Do Not Call list' },
  { value: 'REMOVE_FROM_DNC', label: 'Remove from DNC', desc: 'Remove from Do Not Call list' },
  { value: 'TRIGGER_SEQUENCE', label: 'Trigger Sequence', desc: 'Enroll contact in a sequence' },
  { value: 'SEND_SMS', label: 'Send SMS', desc: 'Send an SMS immediately' },
  { value: 'SEND_EMAIL', label: 'Send Email', desc: 'Send an email immediately' },
  { value: 'CREATE_TASK', label: 'Create Task', desc: 'Create a follow-up task' },
  { value: 'REQUEUE_CONTACT', label: 'Requeue Contact', desc: 'Put contact back in dialer queue for retry' },
  { value: 'REMOVE_FROM_QUEUE', label: 'Remove from Queue', desc: 'Remove contact from dialer queue(s)' },
  { value: 'MARK_BAD_NUMBER', label: 'Mark Bad Number', desc: 'Mark phone as invalid/bad number' },
  { value: 'DELETE_CONTACT', label: 'Delete Contact', desc: 'Permanently delete the contact from CRM' }
]

const TASK_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'other', label: 'Other' }
]

const DYNAMIC_FIELDS = [
  { value: '{firstName}', label: 'First Name' },
  { value: '{lastName}', label: 'Last Name' },
  { value: '{fullName}', label: 'Full Name' },
  { value: '{phone}', label: 'Phone' },
  { value: '{email}', label: 'Email' },
  { value: '{propertyAddress}', label: 'Property Address' },
  { value: '{city}', label: 'City' },
  { value: '{state}', label: 'State' }
]

const ICON_OPTIONS = [
  // Positive outcomes
  { value: 'ThumbsUp', label: 'Thumbs Up', icon: ThumbsUp },
  { value: 'CheckCircle', label: 'Check Circle', icon: CheckCircle },
  { value: 'Check', label: 'Check', icon: Check },
  { value: 'Star', label: 'Star', icon: Star },
  { value: 'Heart', label: 'Heart', icon: Heart },
  { value: 'UserCheck', label: 'User Check', icon: UserCheck },
  { value: 'TrendingUp', label: 'Trending Up', icon: TrendingUp },
  // Negative outcomes
  { value: 'ThumbsDown', label: 'Thumbs Down', icon: ThumbsDown },
  { value: 'XCircle', label: 'X Circle', icon: XCircle },
  { value: 'Ban', label: 'Ban', icon: Ban },
  { value: 'UserX', label: 'User X', icon: UserX },
  { value: 'AlertCircle', label: 'Alert Circle', icon: AlertCircle },
  // Phone related
  { value: 'Phone', label: 'Phone', icon: Phone },
  { value: 'PhoneCall', label: 'Phone Call', icon: PhoneCall },
  { value: 'PhoneIncoming', label: 'Phone Incoming', icon: PhoneIncoming },
  { value: 'PhoneOutgoing', label: 'Phone Outgoing', icon: PhoneOutgoing },
  { value: 'PhoneMissed', label: 'Phone Missed', icon: PhoneMissed },
  { value: 'PhoneOff', label: 'Phone Off', icon: PhoneOff },
  { value: 'Voicemail', label: 'Voicemail', icon: Voicemail },
  // Scheduling / Time
  { value: 'Calendar', label: 'Calendar', icon: Calendar },
  { value: 'Clock', label: 'Clock', icon: Clock },
  { value: 'Bell', label: 'Bell', icon: Bell },
  { value: 'RefreshCw', label: 'Refresh / Retry', icon: RefreshCw },
  // Business / Real Estate
  { value: 'DollarSign', label: 'Dollar Sign', icon: DollarSign },
  { value: 'Home', label: 'Home', icon: Home },
  { value: 'Building', label: 'Building', icon: Building },
  { value: 'Target', label: 'Target', icon: Target },
  { value: 'Zap', label: 'Zap / Quick', icon: Zap },
  // Communication
  { value: 'MessageSquare', label: 'Message', icon: MessageSquare },
  { value: 'Mail', label: 'Email', icon: Mail },
  { value: 'Send', label: 'Send', icon: Send },
  { value: 'FileText', label: 'Document', icon: FileText },
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

  // Reference data for action configs
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tagSearch, setTagSearch] = useState('')

  useEffect(() => {
    loadDispositions()
    loadReferenceData()
  }, [])

  const loadReferenceData = async () => {
    // Load all reference data in parallel
    const [smsRes, emailRes, seqRes, teamRes, tagsRes] = await Promise.all([
      fetch('/api/templates').catch(() => null),
      fetch('/api/email/templates').catch(() => null),
      fetch('/api/sequences').catch(() => null),
      fetch('/api/admin/team-users').catch(() => null),
      fetch('/api/tags').catch(() => null)
    ])

    if (smsRes?.ok) {
      const data = await smsRes.json()
      setSmsTemplates(Array.isArray(data) ? data : [])
    }
    if (emailRes?.ok) {
      const data = await emailRes.json()
      setEmailTemplates(data.templates || [])
    }
    if (seqRes?.ok) {
      const data = await seqRes.json()
      setSequences(data.sequences || data || [])
    }
    if (teamRes?.ok) {
      const data = await teamRes.json()
      setTeamMembers(data.users || [])
    }
    if (tagsRes?.ok) {
      const data = await tagsRes.json()
      setTags(Array.isArray(data) ? data : data.tags || [])
    }
  }

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
                          {/* ADD/REMOVE TAG - Searchable dropdown with create option */}
                          {(action.actionType === 'ADD_TAG' || action.actionType === 'REMOVE_TAG') && (
                            <div className="space-y-2">
                              <Input
                                placeholder="Search or type new tag name..."
                                value={tagSearch || (action.config.tagName as string) || ''}
                                onChange={(e) => {
                                  setTagSearch(e.target.value)
                                  updateAction(idx, 'tagName', e.target.value)
                                }}
                                onFocus={() => setTagSearch((action.config.tagName as string) || '')}
                              />
                              {tagSearch && (
                                <div className="border rounded-md max-h-32 overflow-y-auto">
                                  {tags
                                    .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                    .map(tag => (
                                      <div
                                        key={tag.id}
                                        className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center gap-2"
                                        onClick={() => {
                                          updateAction(idx, 'tagName', tag.name)
                                          updateAction(idx, 'tagId', tag.id)
                                          setTagSearch('')
                                        }}
                                      >
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                        <span className="text-sm">{tag.name}</span>
                                      </div>
                                    ))}
                                  {!tags.some(t => t.name.toLowerCase() === tagSearch.toLowerCase()) && action.actionType === 'ADD_TAG' && (
                                    <div
                                      className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center gap-2 text-blue-600 border-t"
                                      onClick={() => {
                                        updateAction(idx, 'tagName', tagSearch)
                                        updateAction(idx, 'tagId', '') // Will create new tag
                                        setTagSearch('')
                                      }}
                                    >
                                      <Plus className="h-3 w-3" />
                                      <span className="text-sm">Create &quot;{tagSearch}&quot;</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(action.config.tagName as string) && !tagSearch && (
                                <Badge variant="secondary" className="text-xs">
                                  Selected: {action.config.tagName as string}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* ADD TO DNC */}
                          {action.actionType === 'ADD_TO_DNC' && (
                            <Input placeholder="Reason (optional)" value={(action.config.reason as string) || ''} onChange={(e) => updateAction(idx, 'reason', e.target.value)} />
                          )}

                          {/* SEND SMS - Template selector + delay */}
                          {action.actionType === 'SEND_SMS' && (
                            <div className="space-y-2">
                              <Select
                                value={(action.config.templateId as string) || ''}
                                onValueChange={(v) => updateAction(idx, 'templateId', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select SMS template..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {smsTemplates.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                      <div className="flex items-center gap-2">
                                        <MessageSquare className="h-3 w-3" />
                                        {t.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {smsTemplates.length === 0 && (
                                <p className="text-xs text-amber-600">No SMS templates found. Create templates in Settings → Templates.</p>
                              )}
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  placeholder="Delay (minutes)"
                                  className="w-32"
                                  value={(action.config.delayMinutes as number) || ''}
                                  onChange={(e) => updateAction(idx, 'delayMinutes', parseInt(e.target.value) || 0)}
                                />
                                <span className="text-xs text-muted-foreground">0 = send immediately</span>
                              </div>
                            </div>
                          )}

                          {/* SEND EMAIL - Template selector + delay */}
                          {action.actionType === 'SEND_EMAIL' && (
                            <div className="space-y-2">
                              <Select
                                value={(action.config.templateId as string) || ''}
                                onValueChange={(v) => updateAction(idx, 'templateId', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select email template..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {emailTemplates.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3" />
                                        {t.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {emailTemplates.length === 0 && (
                                <p className="text-xs text-amber-600">No email templates found. Create templates in Settings → Templates.</p>
                              )}
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  placeholder="Delay (minutes)"
                                  className="w-32"
                                  value={(action.config.delayMinutes as number) || ''}
                                  onChange={(e) => updateAction(idx, 'delayMinutes', parseInt(e.target.value) || 0)}
                                />
                                <span className="text-xs text-muted-foreground">0 = send immediately</span>
                              </div>
                            </div>
                          )}

                          {/* CREATE TASK - Full fields */}
                          {action.actionType === 'CREATE_TASK' && (
                            <div className="space-y-2">
                              {/* Task Type */}
                              <div>
                                <Label className="text-xs">Task Type</Label>
                                <Select
                                  value={(action.config.taskType as string) || 'follow_up'}
                                  onValueChange={(v) => updateAction(idx, 'taskType', v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TASK_TYPES.map(t => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* Task Title with dynamic field dropdown */}
                              <div>
                                <Label className="text-xs">Task Title</Label>
                                <div className="flex gap-1">
                                  <Input
                                    placeholder="e.g., Follow up with {firstName}"
                                    value={(action.config.taskTitle as string) || ''}
                                    onChange={(e) => updateAction(idx, 'taskTitle', e.target.value)}
                                    className="flex-1"
                                  />
                                  <Select onValueChange={(v) => updateAction(idx, 'taskTitle', ((action.config.taskTitle as string) || '') + v)}>
                                    <SelectTrigger className="w-24">
                                      <SelectValue placeholder="Insert" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DYNAMIC_FIELDS.map(f => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {/* Task Description with dynamic field dropdown */}
                              <div>
                                <Label className="text-xs">Description</Label>
                                <div className="flex gap-1">
                                  <Textarea
                                    placeholder="Task description (optional)"
                                    value={(action.config.taskDescription as string) || ''}
                                    onChange={(e) => updateAction(idx, 'taskDescription', e.target.value)}
                                    rows={2}
                                    className="flex-1"
                                  />
                                  <Select onValueChange={(v) => updateAction(idx, 'taskDescription', ((action.config.taskDescription as string) || '') + v)}>
                                    <SelectTrigger className="w-24 h-auto">
                                      <SelectValue placeholder="Insert" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DYNAMIC_FIELDS.map(f => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Due in days</Label>
                                  <Input
                                    type="number"
                                    placeholder="1"
                                    value={(action.config.taskDueInDays as number) || ''}
                                    onChange={(e) => updateAction(idx, 'taskDueInDays', parseInt(e.target.value))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Priority</Label>
                                  <Select
                                    value={(action.config.taskPriority as string) || 'medium'}
                                    onValueChange={(v) => updateAction(idx, 'taskPriority', v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Assign to</Label>
                                <Select
                                  value={(action.config.assignToUserId as string) || '__unassigned__'}
                                  onValueChange={(v) => updateAction(idx, 'assignToUserId', v === '__unassigned__' ? '' : v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="(Unassigned)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                    {teamMembers.map(m => (
                                      <SelectItem key={m.id} value={m.id}>
                                        {m.firstName} {m.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          {/* TRIGGER SEQUENCE */}
                          {action.actionType === 'TRIGGER_SEQUENCE' && (
                            <div className="space-y-2">
                              <Select
                                value={(action.config.sequenceId as string) || ''}
                                onValueChange={(v) => updateAction(idx, 'sequenceId', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sequence..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {sequences.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {sequences.length === 0 && (
                                <p className="text-xs text-amber-600">No sequences found. Create sequences first.</p>
                              )}
                            </div>
                          )}

                          {/* REQUEUE CONTACT */}
                          {action.actionType === 'REQUEUE_CONTACT' && (
                            <Input type="number" placeholder="Delay in hours (0 = immediate)" value={(action.config.delayHours as number) || 0} onChange={(e) => updateAction(idx, 'delayHours', parseInt(e.target.value) || 0)} />
                          )}

                          {/* MARK BAD NUMBER */}
                          {action.actionType === 'MARK_BAD_NUMBER' && (
                            <Input placeholder="Reason (e.g., disconnected, wrong number)" value={(action.config.reason as string) || ''} onChange={(e) => updateAction(idx, 'reason', e.target.value)} />
                          )}

                          {/* REMOVE FROM QUEUE - Scope selection */}
                          {action.actionType === 'REMOVE_FROM_QUEUE' && (
                            <div className="space-y-2">
                              <Label className="text-xs">Remove from</Label>
                              <Select
                                value={(action.config.scope as string) || 'current'}
                                onValueChange={(v) => updateAction(idx, 'scope', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="current">Current queue only</SelectItem>
                                  <SelectItem value="all">All dialer queues</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* DELETE CONTACT - Confirmation warning */}
                          {action.actionType === 'DELETE_CONTACT' && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                              <p className="text-xs text-red-600 font-medium">⚠️ Warning: This will permanently delete the contact from the CRM.</p>
                              <p className="text-xs text-red-500 mt-1">This action cannot be undone.</p>
                            </div>
                          )}

                          {/* Show description for actions without config */}
                          {['REMOVE_FROM_DNC'].includes(action.actionType) && (
                            <p className="text-xs text-muted-foreground">
                              {ACTION_TYPES.find(t => t.value === action.actionType)?.desc}
                            </p>
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

