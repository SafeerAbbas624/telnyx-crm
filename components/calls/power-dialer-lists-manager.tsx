'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Play, Pause, Archive, Plus, Search, Filter, X } from 'lucide-react'
import type { Contact } from '@/lib/types'

interface PowerDialerList {
  id: string
  name: string
  description?: string
  status: string
  totalContacts: number
  contactsCalled: number
  contactsAnswered: number
  contactsNoAnswer: number
  createdAt: string
  lastWorkedOn?: string
  completedAt?: string
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
  const [newListDescription, setNewListDescription] = useState('')
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [filterOptions, setFilterOptions] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filter state
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterSearchQueries, setFilterSearchQueries] = useState({
    state: '',
    city: '',
    propertyType: '',
    tags: ''
  })

  const { toast } = useToast()

  useEffect(() => {
    loadLists()
    loadAllContacts()
    loadFilterOptions()
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
      toast({
        title: 'Error',
        description: 'Failed to load call lists',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadAllContacts = async () => {
    try {
      setContactsLoading(true)
      const response = await fetch('/api/contacts?limit=10000')
      if (!response.ok) throw new Error('Failed to load contacts')
      const data = await response.json()
      setAllContacts(data.contacts || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load contacts',
        variant: 'destructive',
      })
    } finally {
      setContactsLoading(false)
    }
  }

  const loadFilterOptions = async () => {
    try {
      const response = await fetch('/api/contacts/filter-options')
      if (!response.ok) throw new Error('Failed to load filter options')
      const data = await response.json()
      setFilterOptions(data)
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'Error',
        description: 'List name is required',
        variant: 'destructive',
      })
      return
    }

    if (selectedContactIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one contact',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsCreating(true)
      console.log('Creating list with:', { name: newListName, contactIds: selectedContactIds.length })

      const response = await fetch('/api/power-dialer/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName,
          description: newListDescription,
          contactIds: selectedContactIds,
        })
      })

      console.log('Response status:', response.status)
      const responseData = await response.json()
      console.log('Response data:', responseData)

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create list')
      }

      const { list } = responseData

      setLists([list, ...lists])
      setNewListName('')
      setNewListDescription('')
      setSelectedContactIds([])
      setContactSearchQuery('')
      setSelectedStates([])
      setSelectedCities([])
      setSelectedPropertyTypes([])
      setSelectedTags([])
      setFilterSearchQueries({ state: '', city: '', propertyType: '', tags: '' })
      setIsCreateOpen(false)

      toast({
        title: 'Success',
        description: `Call list created with ${selectedContactIds.length} contacts`,
      })

      if (onCreateList) onCreateList(list)
    } catch (error) {
      console.error('Error creating list:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create call list'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
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
      toast({
        title: 'Success',
        description: 'Call list deleted',
      })
    } catch (error) {
      console.error('Error deleting list:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete call list',
        variant: 'destructive',
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
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

  // Filter contacts based on search query and filters
  const filteredContacts = allContacts.filter(contact => {
    // Search filter
    const searchLower = contactSearchQuery.toLowerCase()
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase()
    const phone = (contact.phone1 || '').toLowerCase()
    const searchMatch = fullName.includes(searchLower) || phone.includes(searchLower)

    // State filter
    const stateMatch = selectedStates.length === 0 || selectedStates.includes(contact.state || '')

    // City filter
    const cityMatch = selectedCities.length === 0 || selectedCities.includes(contact.city || '')

    // Property type filter
    const propertyTypeMatch = selectedPropertyTypes.length === 0 || selectedPropertyTypes.includes(contact.propertyType || '')

    // Tags filter
    const tagsMatch = selectedTags.length === 0 || (contact.tags && contact.tags.some(tag => selectedTags.includes(tag.id)))

    return searchMatch && stateMatch && cityMatch && propertyTypeMatch && tagsMatch
  })

  const hasActiveFilters = selectedStates.length > 0 || selectedCities.length > 0 || selectedPropertyTypes.length > 0 || selectedTags.length > 0

  const handleResetFilters = () => {
    setSelectedStates([])
    setSelectedCities([])
    setSelectedPropertyTypes([])
    setSelectedTags([])
    setFilterSearchQueries({
      state: '',
      city: '',
      propertyType: '',
      tags: ''
    })
  }

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([])
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Call Lists</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New List
        </Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create New Call List</DialogTitle>
            <DialogDescription>
              Create a new named call list and select contacts to add
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 px-4">
            <div>
              <label className="text-sm font-medium">List Name *</label>
              <Input
                placeholder="e.g., Hot Leads - January"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                placeholder="Add notes about this list..."
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Filters Section */}
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <label className="text-sm font-medium">Filter Contacts (Optional)</label>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {selectedStates.length + selectedCities.length + selectedPropertyTypes.length + selectedTags.length} active
                    </Badge>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetFilters}
                    className="h-6 px-2"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <Tabs defaultValue="location" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="location" className="text-xs">
                    Location
                    {(selectedStates.length + selectedCities.length) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-blue-100 text-blue-700">
                        {selectedStates.length + selectedCities.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="property" className="text-xs">
                    Property
                    {selectedPropertyTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-blue-100 text-blue-700">
                        {selectedPropertyTypes.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tags" className="text-xs">
                    Tags
                    {selectedTags.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-blue-100 text-blue-700">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Location Tab */}
                <TabsContent value="location" className="mt-2 space-y-2">
                  {/* States */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700">State</Label>
                    <Input
                      placeholder="Search states..."
                      value={filterSearchQueries.state}
                      onChange={(e) => setFilterSearchQueries({...filterSearchQueries, state: e.target.value})}
                      className="h-7 text-xs mb-1"
                    />
                    <ScrollArea className="h-24 border rounded p-1 bg-white">
                      <div className="space-y-1">
                        {(filterOptions?.states || [])
                          .filter((state: string) => state.toLowerCase().includes(filterSearchQueries.state.toLowerCase()))
                          .slice(0, 50)
                          .map((state: string) => (
                            <div key={`state-${state}`} className="flex items-center gap-2 p-1">
                              <Checkbox
                                id={`state-${state}`}
                                checked={selectedStates.includes(state)}
                                onCheckedChange={() => {
                                  setSelectedStates(prev =>
                                    prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
                                  )
                                }}
                                className="h-3 w-3"
                              />
                              <label htmlFor={`state-${state}`} className="text-xs cursor-pointer">{state}</label>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Cities */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700">City</Label>
                    <Input
                      placeholder="Search cities..."
                      value={filterSearchQueries.city}
                      onChange={(e) => setFilterSearchQueries({...filterSearchQueries, city: e.target.value})}
                      className="h-7 text-xs mb-1"
                    />
                    <ScrollArea className="h-24 border rounded p-1 bg-white">
                      <div className="space-y-1">
                        {(filterOptions?.cities || [])
                          .filter((city: string) => city.toLowerCase().includes(filterSearchQueries.city.toLowerCase()))
                          .slice(0, 50)
                          .map((city: string) => (
                            <div key={`city-${city}`} className="flex items-center gap-2 p-1">
                              <Checkbox
                                id={`city-${city}`}
                                checked={selectedCities.includes(city)}
                                onCheckedChange={() => {
                                  setSelectedCities(prev =>
                                    prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
                                  )
                                }}
                                className="h-3 w-3"
                              />
                              <label htmlFor={`city-${city}`} className="text-xs cursor-pointer">{city}</label>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* Property Tab */}
                <TabsContent value="property" className="mt-2 space-y-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Property Type</Label>
                    <Input
                      placeholder="Search property types..."
                      value={filterSearchQueries.propertyType}
                      onChange={(e) => setFilterSearchQueries({...filterSearchQueries, propertyType: e.target.value})}
                      className="h-7 text-xs mb-1"
                    />
                    <ScrollArea className="h-32 border rounded p-1 bg-white">
                      <div className="space-y-1">
                        {(filterOptions?.propertyTypes || [])
                          .filter((type: string) => type.toLowerCase().includes(filterSearchQueries.propertyType.toLowerCase()))
                          .slice(0, 50)
                          .map((type: string) => (
                            <div key={`ptype-${type}`} className="flex items-center gap-2 p-1">
                              <Checkbox
                                id={`ptype-${type}`}
                                checked={selectedPropertyTypes.includes(type)}
                                onCheckedChange={() => {
                                  setSelectedPropertyTypes(prev =>
                                    prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                                  )
                                }}
                                className="h-3 w-3"
                              />
                              <label htmlFor={`ptype-${type}`} className="text-xs cursor-pointer">{type}</label>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* Tags Tab */}
                <TabsContent value="tags" className="mt-2 space-y-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Tags</Label>
                    <Input
                      placeholder="Search tags..."
                      value={filterSearchQueries.tags}
                      onChange={(e) => setFilterSearchQueries({...filterSearchQueries, tags: e.target.value})}
                      className="h-7 text-xs mb-1"
                    />
                    <ScrollArea className="h-32 border rounded p-1 bg-white">
                      <div className="space-y-1">
                        {(filterOptions?.tags || [])
                          .filter((tag: any) => tag.name.toLowerCase().includes(filterSearchQueries.tags.toLowerCase()))
                          .slice(0, 50)
                          .map((tag: any) => (
                            <div key={`tag-${tag.id}`} className="flex items-center gap-2 p-1">
                              <Checkbox
                                id={`tag-${tag.id}`}
                                checked={selectedTags.includes(tag.id)}
                                onCheckedChange={() => {
                                  setSelectedTags(prev =>
                                    prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                                  )
                                }}
                                className="h-3 w-3"
                              />
                              <label htmlFor={`tag-${tag.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{backgroundColor: tag.color || '#3B82F6'}}></span>
                                {tag.name}
                              </label>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">
                  Select Contacts * ({selectedContactIds.length} selected)
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleSelectAll}
                  disabled={contactsLoading}
                >
                  {selectedContactIds.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="border rounded-lg p-2 mb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts by name or phone..."
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="border-0"
                  />
                </div>
              </div>

              <ScrollArea className="h-64 border rounded-lg p-3">
                {contactsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading contacts...</div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No contacts found</div>
                ) : (
                  <div className="space-y-2">
                    {filteredContacts.map(contact => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => toggleContactSelection(contact.id)}
                      >
                        <Checkbox
                          checked={selectedContactIds.includes(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{contact.phone1}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <div className="flex gap-2 px-4 pb-4 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                setNewListName('')
                setNewListDescription('')
                setSelectedContactIds([])
                setContactSearchQuery('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={isCreating || !newListName.trim() || selectedContactIds.length === 0}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create List'}
            </Button>
          </div>
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
                      <CardTitle>{list.name}</CardTitle>
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

                  {list.lastWorkedOn && (
                    <p className="text-xs text-gray-500">
                      Last worked on: {formatDistanceToNow(new Date(list.lastWorkedOn), { addSuffix: true })}
                    </p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectList?.(list.id)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteList(list.id)}
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
  )
}

