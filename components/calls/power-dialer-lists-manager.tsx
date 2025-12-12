'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Play, Plus, Tag, Shuffle, ArrowUpDown, Phone, Users, Clock, FileText, Edit } from 'lucide-react'
import { PowerDialerViewRedesign } from './power-dialer-view-redesign'
import type { CallerIdStrategy } from '@/lib/dialer/types'

interface PowerDialerList {
  id: string
  name: string
  description?: string
  status: string
  totalContacts: number
  contactsCalled: number
  contactsAnswered: number
  contactsNoAnswer: number
  contactsVoicemail?: number
  contactsBusy?: number
  contactsFailed?: number
  maxLines?: number
  callerIdStrategy?: CallerIdStrategy
  scriptId?: string
  createdAt: string
  updatedAt?: string
  lastWorkedOn?: string
  completedAt?: string
  // Tag sync fields
  syncTagIds?: string[]
  autoSync?: boolean
  lastSyncAt?: string
  syncTags?: { id: string; name: string; color: string }[]
}

interface TagOption {
  id: string
  name: string
  color: string
  _count?: { contacts: number }
}

interface Contact {
  id: string
  firstName?: string | null
  lastName?: string | null
  phone1?: string | null
  phone2?: string | null
  propertyAddress?: string | null
  city?: string | null
  state?: string | null
  createdAt: string
  tags?: { id: string; name: string }[]
}

interface CallScript {
  id: string
  name: string
  content: string
  variables: string[]
}

interface PowerDialerListsManagerProps {
  onSelectList?: (listId: string) => void
  onCreateList?: (list: PowerDialerList) => void
}

export function PowerDialerListsManager({ onSelectList, onCreateList }: PowerDialerListsManagerProps) {
  const [lists, setLists] = useState<PowerDialerList[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Edit list state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingList, setEditingList] = useState<PowerDialerList | null>(null)
  const [editListName, setEditListName] = useState('')
  const [editListDescription, setEditListDescription] = useState('')
  const [editSelectedTagIds, setEditSelectedTagIds] = useState<string[]>([])
  const [editExcludeTagIds, setEditExcludeTagIds] = useState<string[]>([])
  const [editAutoSync, setEditAutoSync] = useState(false)
  const [editSelectedScriptId, setEditSelectedScriptId] = useState<string>('')
  const [editTagSearch, setEditTagSearch] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Simple tag-based selection
  const [availableTags, setAvailableTags] = useState<TagOption[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]) // Tags to exclude
  const [matchingContacts, setMatchingContacts] = useState<Contact[]>([])
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'random'>('newest')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [autoSync, setAutoSync] = useState(true) // Auto-sync enabled by default
  const [createTagSearch, setCreateTagSearch] = useState('') // Search for create dialog
  const [createExcludeTagSearch, setCreateExcludeTagSearch] = useState('') // Search for exclude tags in create dialog

  // Scripts
  const [scripts, setScripts] = useState<CallScript[]>([])
  const [selectedScriptId, setSelectedScriptId] = useState<string>('')
  const [customScriptContent, setCustomScriptContent] = useState<string>('')
  const [useCustomScript, setUseCustomScript] = useState(false)

  // Active list queue
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [queueContacts, setQueueContacts] = useState<Contact[]>([])
  const [currentCallIndex, setCurrentCallIndex] = useState(0)

  // Multi-line dialer view
  const [selectedList, setSelectedList] = useState<PowerDialerList | null>(null)

  useEffect(() => {
    loadLists()
    loadTags()
    loadScripts()
  }, [])

  const loadLists = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/power-dialer/lists?sort=lastWorkedOn')
      if (!response.ok) throw new Error('Failed to load lists')
      const data = await response.json()
      setLists(data)
    } catch (error) {
      console.error('Error loading lists:', error)
      toast.error('Failed to load call lists')
    } finally {
      setLoading(false)
    }
  }

  const loadTags = async () => {
    try {
      const response = await fetch('/api/tags?includeUsage=true')
      if (!response.ok) throw new Error('Failed to load tags')
      const data = await response.json()
      // Transform to include _count.contacts format
      const tagsWithCount = (data.tags || []).map((tag: any) => ({
        ...tag,
        _count: { contacts: tag.usage_count || 0 }
      }))
      setAvailableTags(tagsWithCount)
    } catch (error) {
      console.error('Error loading tags:', error)
    }
  }

  const loadScripts = async () => {
    try {
      const response = await fetch('/api/call-scripts?activeOnly=true')
      if (!response.ok) throw new Error('Failed to load scripts')
      const data = await response.json()
      setScripts(data.scripts || [])
    } catch (error) {
      console.error('Error loading scripts:', error)
    }
  }

  // Load contacts when tags are selected (include OR exclude changes)
  useEffect(() => {
    const loadContactsByTags = async () => {
      try {
        setContactsLoading(true)
        const tagParams = selectedTagIds.join(',')
        const excludeParams = excludeTagIds.join(',')
        let url = `/api/contacts?tags=${tagParams}&limit=10000`
        if (excludeParams) {
          url += `&excludeTags=${excludeParams}`
        }
        console.log('[PowerDialerLists] Fetching contacts preview:', url)
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to load contacts')
        const data = await response.json()
        let contacts = data.contacts || []

        // Apply sorting
        if (sortOrder === 'newest') {
          contacts.sort((a: Contact, b: Contact) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        } else if (sortOrder === 'oldest') {
          contacts.sort((a: Contact, b: Contact) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        } else if (sortOrder === 'random') {
          contacts = shuffleArray([...contacts])
        }

        console.log('[PowerDialerLists] Contacts preview loaded:', contacts.length, 'contacts')
        setMatchingContacts(contacts)
      } catch (error) {
        console.error('Error loading contacts:', error)
        toast.error('Failed to load contacts')
      } finally {
        setContactsLoading(false)
      }
    }

    if (selectedTagIds.length > 0) {
      loadContactsByTags()
    } else {
      setMatchingContacts([])
    }
  }, [selectedTagIds, excludeTagIds, sortOrder])

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('List name is required')
      return
    }

    if (matchingContacts.length === 0) {
      toast.error('Please select tags with contacts')
      return
    }

    try {
      setIsCreating(true)
      const contactIds = matchingContacts.map(c => c.id)

      let finalScriptId = selectedScriptId || undefined

      // If using custom script, create it first
      if (useCustomScript && customScriptContent.trim()) {
        const scriptResponse = await fetch('/api/call-scripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${newListName} Script`,
            content: customScriptContent,
            variables: ['firstName', 'lastName', 'propertyAddress'],
          })
        })

        if (scriptResponse.ok) {
          const scriptData = await scriptResponse.json()
          finalScriptId = scriptData.id
        }
      }

      const response = await fetch('/api/power-dialer/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName,
          contactIds,
          scriptId: finalScriptId,
          // Pass tag sync settings if tags are selected
          syncTagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          excludeTagIds: excludeTagIds.length > 0 ? excludeTagIds : undefined,
          autoSync: selectedTagIds.length > 0 ? autoSync : false,
        })
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create list')
      }

      const { list, syncEnabled } = responseData
      setLists([list, ...lists])
      resetCreateForm()
      setIsCreateOpen(false)

      const syncMessage = syncEnabled ? ' (auto-sync enabled)' : ''
      toast.success(`Call list created with ${contactIds.length} contacts${syncMessage}`)
      if (onCreateList) onCreateList(list)
    } catch (error) {
      console.error('Error creating list:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create call list')
    } finally {
      setIsCreating(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const resetCreateForm = () => {
    setNewListName('')
    setSelectedTagIds([])
    setExcludeTagIds([])
    setMatchingContacts([])
    setSortOrder('newest')
    setSelectedScriptId('')
    setAutoSync(true)
    setUseCustomScript(false)
    setCustomScriptContent('')
    setCreateTagSearch('')
    setCreateExcludeTagSearch('')
  }

  // Load queue for active list
  const loadListQueue = async (listId: string) => {
    try {
      setActiveListId(listId)
      const response = await fetch(`/api/power-dialer/lists/${listId}/contacts?limit=1000`)
      if (!response.ok) throw new Error('Failed to load list contacts')

      const data = await response.json()
      // Extract contact objects from PowerDialerListContact objects
      const contacts = (data.contacts || []).map((item: any) => item.contact)
      setQueueContacts(contacts)
      setCurrentCallIndex(0)
      toast.success(`Loaded ${contacts.length} contacts into call queue`)
    } catch (error) {
      console.error('Error loading list queue:', error)
      toast.error('Failed to load call queue')
    }
  }

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list?')) return

    try {
      const response = await fetch(`/api/power-dialer/lists?listId=${listId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete list')

      setLists(lists.filter(l => l.id !== listId))
      toast.success('Call list deleted')
    } catch (error) {
      console.error('Error deleting list:', error)
      toast.error('Failed to delete call list')
    }
  }

  // Open edit dialog
  const handleOpenEdit = (list: PowerDialerList) => {
    setEditingList(list)
    setEditListName(list.name)
    setEditListDescription(list.description || '')
    setEditSelectedTagIds(list.syncTagIds || [])
    setEditExcludeTagIds((list as any).excludeTagIds || [])
    setEditAutoSync(list.autoSync || false)
    setEditSelectedScriptId(list.scriptId || '')
    setEditTagSearch('')
    setIsEditOpen(true)
  }

  // Save edit changes
  const handleSaveEdit = async (resyncContacts = false) => {
    if (!editingList || !editListName.trim()) {
      toast.error('List name is required')
      return
    }

    try {
      setIsEditing(true)
      const response = await fetch(`/api/power-dialer/lists/${editingList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editListName,
          description: editListDescription || null,
          syncTagIds: editSelectedTagIds,
          excludeTagIds: editExcludeTagIds,
          autoSync: editAutoSync,
          scriptId: editSelectedScriptId || null,
          resyncContacts, // If true, will add new contacts matching the tags
        })
      })

      if (!response.ok) throw new Error('Failed to update list')

      const updatedList = await response.json()
      setLists(lists.map(l => l.id === editingList.id ? { ...l, ...updatedList } : l))
      setIsEditOpen(false)
      setEditingList(null)
      toast.success(resyncContacts ? 'List updated and contacts synced!' : 'List updated successfully')
    } catch (error) {
      console.error('Error updating list:', error)
      toast.error('Failed to update list')
    } finally {
      setIsEditing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      ACTIVE: 'default',
      PAUSED: 'secondary',
      COMPLETED: 'outline',
      ARCHIVED: 'outline',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const getProgressPercentage = (list: PowerDialerList) => {
    if (list.totalContacts === 0) return 0
    return Math.round((list.contactsCalled / list.totalContacts) * 100)
  }

  if (loading) {
    return <div className="text-center py-8">Loading call lists...</div>
  }

  // Show redesigned power dialer when a list is selected
  if (selectedList) {
    return (
      <PowerDialerViewRedesign
        listId={selectedList.id}
        listName={selectedList.name}
        onBack={() => {
          setSelectedList(null)
          loadLists() // Refresh lists when returning
        }}
      />
    )
  }

  return (
    <div className="h-full flex gap-6">
      {/* LEFT SIDE - Lists */}
      <div className="flex-1 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Power Dialer Lists</h2>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New List
          </Button>
        </div>

      {/* Simple Create Dialog - Tag Based */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open)
        if (!open) resetCreateForm()
      }}>
        <DialogContent className="max-w-lg z-[60]">
          <DialogHeader>
            <DialogTitle>Create Call List</DialogTitle>
            <DialogDescription>
              Select tags to add contacts to your call queue
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* List Name */}
            <div>
              <Label>List Name</Label>
              <Input
                placeholder="e.g., Hot Leads - December"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>

            {/* Tag Selection */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4" />
                Select Tags
              </Label>
              <Input
                placeholder="Search tags..."
                value={createTagSearch}
                onChange={(e) => setCreateTagSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-40 border rounded-lg p-3">
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tags available</p>
                ) : (
                  <div className="space-y-2">
                    {availableTags
                      .filter(tag => tag.name.toLowerCase().includes(createTagSearch.toLowerCase()))
                      .map(tag => (
                      <div
                        key={tag.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedTagIds.includes(tag.id)
                            ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-700'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                        }`}
                        onClick={() => toggleTag(tag.id)}
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        {tag._count?.contacts !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {tag._count.contacts} contacts
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Exclude Tags Selection */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-red-500" />
                Exclude Tags (NOT)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Contacts with these tags will be excluded from the list
              </p>
              <Input
                placeholder="Search exclude tags..."
                value={createExcludeTagSearch}
                onChange={(e) => setCreateExcludeTagSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-32 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tags available</p>
                ) : (
                  <div className="space-y-2">
                    {availableTags
                      .filter(tag => tag.name.toLowerCase().includes(createExcludeTagSearch.toLowerCase()))
                      .map(tag => (
                      <div
                        key={tag.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          excludeTagIds.includes(tag.id)
                            ? 'bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-700'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                        }`}
                        onClick={() => {
                          setExcludeTagIds(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }}
                      >
                        <Checkbox
                          checked={excludeTagIds.includes(tag.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => {
                            setExcludeTagIds(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        {tag._count?.contacts !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {tag._count.contacts}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Sort Order */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <ArrowUpDown className="w-4 h-4" />
                Sort Order
              </Label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Newest First
                    </div>
                  </SelectItem>
                  <SelectItem value="oldest">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Oldest First
                    </div>
                  </SelectItem>
                  <SelectItem value="random">
                    <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      Random Shuffle
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Call Script (Optional) */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                Call Script (Optional)
              </Label>

              {/* Option to use existing script or write custom */}
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={!useCustomScript ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseCustomScript(false)}
                >
                  Use Existing
                </Button>
                <Button
                  type="button"
                  variant={useCustomScript ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseCustomScript(true)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Write Custom
                </Button>
              </div>

              {!useCustomScript ? (
                <>
                  <Select
                    value={selectedScriptId || 'none'}
                    onValueChange={(v) => {
                      setSelectedScriptId(v === 'none' ? '' : v)
                      // Load selected script content for preview
                      const script = scripts.find(s => s.id === v)
                      if (script) {
                        setCustomScriptContent(script.content)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No script selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No script</SelectItem>
                      {scripts.map(script => (
                        <SelectItem key={script.id} value={script.id}>
                          {script.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {scripts.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No scripts available. Create scripts in Settings.
                    </p>
                  )}
                  {/* Show preview of selected script */}
                  {selectedScriptId && customScriptContent && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm max-h-32 overflow-y-auto">
                      <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                      <p className="whitespace-pre-wrap text-gray-700">{customScriptContent}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Textarea
                    placeholder="Write your call script here... Use {{firstName}}, {{lastName}}, {{propertyAddress}} for dynamic fields."
                    value={customScriptContent}
                    onChange={(e) => setCustomScriptContent(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{propertyAddress}}'}
                  </p>
                </>
              )}
            </div>

            {/* Auto-Sync Option (when tags selected) */}
            {selectedTagIds.length > 0 && (
              <div className="border rounded-lg p-3 bg-blue-50 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="autoSync"
                    checked={autoSync}
                    onCheckedChange={(checked) => setAutoSync(checked === true)}
                  />
                  <Label htmlFor="autoSync" className="text-sm font-medium cursor-pointer">
                    Auto-sync new contacts with these tags
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {autoSync
                    ? "✓ New contacts tagged with the selected tags will be automatically added to this list every minute."
                    : "New contacts won't be added automatically. You can manually sync later."}
                </p>
              </div>
            )}

            {/* Preview */}
            {selectedTagIds.length > 0 && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Contacts Preview
                  </span>
                  {contactsLoading ? (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  ) : (
                    <Badge variant="default">{matchingContacts.length} contacts</Badge>
                  )}
                </div>
                {!contactsLoading && matchingContacts.length > 0 && (
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {matchingContacts.slice(0, 10).map((contact, idx) => (
                        <div key={contact.id} className="flex items-center gap-2 text-sm py-1">
                          <span className="text-muted-foreground w-6">{idx + 1}.</span>
                          <span className="font-medium truncate">
                            {contact.firstName || ''} {contact.lastName || ''}
                          </span>
                          <span className="text-muted-foreground text-xs truncate">
                            {contact.phone1}
                          </span>
                        </div>
                      ))}
                      {matchingContacts.length > 10 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          ...and {matchingContacts.length - 10} more
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={isCreating || !newListName.trim() || matchingContacts.length === 0}
            >
              {isCreating ? 'Creating...' : `Create List (${matchingContacts.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog - Full Settings */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[60]">
          <DialogHeader>
            <DialogTitle>Edit Call List</DialogTitle>
            <DialogDescription>
              Update all settings for your call list
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* List Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">List Name</Label>
              <Input
                id="edit-list-name"
                value={editListName}
                onChange={(e) => setEditListName(e.target.value)}
                placeholder="Enter list name"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-list-description">Description (optional)</Label>
              <Textarea
                id="edit-list-description"
                value={editListDescription}
                onChange={(e) => setEditListDescription(e.target.value)}
                placeholder="Enter description"
                rows={2}
              />
            </div>

            {/* Tag Selection with Search */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4" />
                Include Tags
              </Label>
              <Input
                placeholder="Search tags..."
                value={editTagSearch}
                onChange={(e) => setEditTagSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-32 border rounded-lg p-3">
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tags available</p>
                ) : (
                  <div className="space-y-1">
                    {availableTags
                      .filter(tag => tag.name.toLowerCase().includes(editTagSearch.toLowerCase()))
                      .map(tag => (
                      <div
                        key={tag.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          editSelectedTagIds.includes(tag.id)
                            ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-700'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                        }`}
                        onClick={() => {
                          setEditSelectedTagIds(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }}
                      >
                        <Checkbox
                          checked={editSelectedTagIds.includes(tag.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => {
                            setEditSelectedTagIds(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        {tag._count?.contacts !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {tag._count.contacts}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Exclude Tags Selection */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-red-500" />
                Exclude Tags (NOT)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Contacts with these tags will be excluded
              </p>
              <ScrollArea className="h-28 border border-red-200 dark:border-red-800 rounded-lg p-3">
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tags available</p>
                ) : (
                  <div className="space-y-1">
                    {availableTags
                      .filter(tag => tag.name.toLowerCase().includes(editTagSearch.toLowerCase()))
                      .map(tag => (
                      <div
                        key={tag.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          editExcludeTagIds.includes(tag.id)
                            ? 'bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-700'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                        }`}
                        onClick={() => {
                          setEditExcludeTagIds(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }}
                      >
                        <Checkbox
                          checked={editExcludeTagIds.includes(tag.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => {
                            setEditExcludeTagIds(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#3B82F6' }}
                        />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Call Script Selection */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                Call Script
              </Label>
              <Select
                value={editSelectedScriptId || 'none'}
                onValueChange={(v) => setEditSelectedScriptId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No script selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No script</SelectItem>
                  {scripts.map(script => (
                    <SelectItem key={script.id} value={script.id}>
                      {script.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-Sync Option */}
            {editSelectedTagIds.length > 0 && (
              <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="editAutoSync"
                    checked={editAutoSync}
                    onCheckedChange={(checked) => setEditAutoSync(checked === true)}
                  />
                  <Label htmlFor="editAutoSync" className="text-sm font-medium cursor-pointer">
                    Auto-sync new contacts with these tags
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {editAutoSync
                    ? "✓ New contacts tagged with the selected tags will be automatically added."
                    : "New contacts won't be added automatically."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            {editSelectedTagIds.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => handleSaveEdit(true)}
                disabled={isEditing || !editListName.trim()}
              >
                {isEditing ? 'Syncing...' : 'Save & Sync Contacts'}
              </Button>
            )}
            <Button
              onClick={() => handleSaveEdit(false)}
              disabled={isEditing || !editListName.trim()}
            >
              {isEditing ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            No call lists yet. Create one to get started!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lists.map((list) => {
            const progress = getProgressPercentage(list)
            return (
              <Card key={list.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{list.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {list.lastWorkedOn
                            ? formatDistanceToNow(new Date(list.lastWorkedOn), { addSuffix: true })
                            : formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {list.description && (
                        <CardDescription>{list.description}</CardDescription>
                      )}
                    </div>
                    {getStatusBadge(list.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Contacts:</span>
                      <p className="font-semibold">{list.totalContacts}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Calls Completed:</span>
                      <p className="font-semibold">{list.contactsCalled}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Answered:</span>
                      <p className="font-semibold text-green-600">{list.contactsAnswered}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">No Answer:</span>
                      <p className="font-semibold text-red-600">{list.contactsNoAnswer}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Tag Sync Status */}
                  {list.syncTags && list.syncTags.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <Tag className="w-3 h-3 text-blue-500" />
                      <span className="text-muted-foreground">
                        Synced tags: {list.syncTags.map(t => t.name).join(', ')}
                      </span>
                      {list.autoSync && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                          Auto-sync
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedList(list)
                        onSelectList?.(list.id)
                      }}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Open Dialer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(list)}
                      title="Edit list"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteList(list.id)}
                      title="Delete list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </div>

      {/* RIGHT SIDE - Call Queue */}
      <div className="w-[450px] flex flex-col border rounded-lg bg-card">
        {/* Queue Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h3 className="font-semibold">Call Queue</h3>
          </div>
          {queueContacts.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {queueContacts.length - currentCallIndex} contacts remaining
            </p>
          )}
        </div>

        {/* Queue List */}
        <ScrollArea className="flex-1">
          {queueContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Phone className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No contacts in queue</p>
              <p className="text-xs text-muted-foreground mt-1">Click Resume on a list to load contacts</p>
            </div>
          ) : (
            <div className="divide-y">
              {queueContacts.map((contact, index) => {
                const isCurrent = index === currentCallIndex
                const phone = contact.phone1 || contact.phone2 || ''

                return (
                  <div
                    key={contact.id}
                    className={`p-3 transition-colors ${
                      isCurrent ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Index */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>

                      {/* Contact Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name */}
                        <div className="font-medium text-sm">
                          {contact.firstName} {contact.lastName}
                        </div>

                        {/* Phone */}
                        {phone && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            📞 {phone}
                          </div>
                        )}

                        {/* Property Address */}
                        {contact.propertyAddress && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            📍 {contact.propertyAddress}{contact.city ? `, ${contact.city}` : ''}{contact.state ? `, ${contact.state}` : ''}
                          </div>
                        )}

                        {/* Tags */}
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {contact.tags.map(tag => (
                              <Badge key={tag.id} variant="outline" className="text-xs">
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

export default PowerDialerListsManager
