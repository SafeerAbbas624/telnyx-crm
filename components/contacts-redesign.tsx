"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Search,
  Filter,
  Download,
  Tag,
  Plus,
  MapPin,
  Building2,
  Phone,
  Mail,
  User,
  Calendar,
  FileText,
  MessageSquare,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  Tags,
  X,
  Trash2,
  UserPlus,
  Edit
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import type { Contact } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"
import { useCallUI } from "@/lib/context/call-ui-context"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import AddContactDialog from "./contacts/add-contact-dialog"
import EditContactDialog from "./contacts/edit-contact-dialog"
import AdvancedFiltersRedesign from "./contacts/advanced-filters-redesign"
import BulkTagOperations from "./contacts/bulk-tag-operations"
import ContactTimeline from "./contacts/contact-timeline"
import AssignContactModal from "./admin/assign-contact-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ContactsRedesignProps {
  onAddContact?: () => void
}

export default function ContactsRedesign({ onAddContact }: ContactsRedesignProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const { openCall } = useCallUI()
  const {
    contacts,
    isLoading,
    pagination,
    goToPage,
    searchContacts,
    currentQuery,
    currentFilters,
    addContact,
    refreshContacts,
    deleteContact
  } = useContacts()

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activityTab, setActivityTab] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showBulkTagOperations, setShowBulkTagOperations] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showAllContacts, setShowAllContacts] = useState(true)
  const [showAddActivityDialog, setShowAddActivityDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([])
  const [contactTags, setContactTags] = useState<any[]>([])

  // Dashboard-style activity dialog state
  const [activityType, setActivityType] = useState<'call' | 'meeting' | 'email' | 'task' | 'note'>('task')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueTime, setDueTime] = useState("09:00")

  const isAdmin = session?.user?.role === 'ADMIN'

  // Initialize contacts
  useEffect(() => {
    searchContacts('', {})
  }, [])

  // Fetch phone numbers for calling
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const endpoint = isAdmin ? '/api/telnyx/phone-numbers' : '/api/team/assigned-phone-numbers'
        const res = await fetch(endpoint)
        if (res.ok) {
          const data = await res.json()
          setPhoneNumbers(data)
        }
      } catch (error) {
        console.error('Error fetching phone numbers:', error)
      }
    }
    fetchPhoneNumbers()
  }, [isAdmin])

  // Fetch contact tags when contact is selected
  useEffect(() => {
    if (selectedContact) {
      // If tags are already in selectedContact, use them
      if (selectedContact.tags && selectedContact.tags.length > 0) {
        console.log('Using tags from selectedContact:', selectedContact.tags)
        setContactTags(selectedContact.tags)
      } else {
        // Otherwise fetch from API
        const fetchContactTags = async () => {
          try {
            console.log('Fetching tags for contact:', selectedContact.id)
            const res = await fetch(`/api/contacts/${selectedContact.id}`)
            if (res.ok) {
              const data = await res.json()
              console.log('Fetched contact data:', data)
              console.log('Tags from API:', data.tags)
              setContactTags(data.tags || [])
            }
          } catch (error) {
            console.error('Error fetching contact tags:', error)
          }
        }
        fetchContactTags()
      }
    } else {
      setContactTags([])
    }
  }, [selectedContact?.id])

  // Sync local search query with context query
  useEffect(() => {
    if (currentQuery !== searchQuery) {
      setSearchQuery(currentQuery)
    }
  }, [currentQuery])

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== currentQuery) {
        searchContacts(searchQuery, currentFilters || {})
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, currentQuery, currentFilters])

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact)
  }

  const handleContactCheckbox = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedContactIds(prev => [...prev, contactId])
    } else {
      setSelectedContactIds(prev => prev.filter(id => id !== contactId))
    }
  }

  const handleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([])
    } else {
      setSelectedContactIds(contacts.map(c => c.id))
    }
  }

  // Export CSV handler - only export selected contacts
  const handleExportCsv = async () => {
    if (!isAdmin) return

    // Check if any contacts are selected
    if (selectedContactIds.length === 0) {
      toast({
        title: 'No contacts selected',
        description: 'Please select one or more contacts to export.',
        variant: 'destructive'
      })
      return
    }

    try {
      setExporting(true)
      const payload: any = {
        selectedIds: selectedContactIds,
        exportAllMatching: false,
      }

      const res = await fetch('/api/admin/contacts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to export contacts')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')
      a.download = `contacts-${ts}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `Exported ${selectedContactIds.length} contact${selectedContactIds.length !== 1 ? 's' : ''}`,
      })
    } catch (e) {
      console.error('Export failed', e)
      toast({
        title: 'Export failed',
        description: 'Please try again.',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  // Delete selected contacts
  const handleDeleteContacts = async () => {
    if (selectedContactIds.length === 0) {
      toast({
        title: 'No contacts selected',
        description: 'Please select one or more contacts to delete.',
        variant: 'destructive'
      })
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedContactIds.length} contact${selectedContactIds.length !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(true)

      // Delete each contact
      await Promise.all(
        selectedContactIds.map(id =>
          fetch(`/api/contacts/${id}`, { method: 'DELETE' })
        )
      )

      toast({
        title: 'Contacts deleted',
        description: `Successfully deleted ${selectedContactIds.length} contact${selectedContactIds.length !== 1 ? 's' : ''}`,
      })

      // Clear selection and refresh
      setSelectedContactIds([])
      setSelectedContact(null)
      await refreshContacts()
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: 'Failed to delete contacts. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
    }
  }

  // Handle call button click
  const handleCallContact = async () => {
    if (!selectedContact) return

    const phoneNumber = selectedContact.phone1 || selectedContact.phone2 || selectedContact.phone3
    if (!phoneNumber) {
      toast({
        title: 'No phone number',
        description: 'This contact doesn\'t have a phone number.',
        variant: 'destructive'
      })
      return
    }

    if (phoneNumbers.length === 0) {
      toast({
        title: 'No phone numbers available',
        description: 'You don\'t have any phone numbers assigned.',
        variant: 'destructive'
      })
      return
    }

    try {
      const fromNumber = phoneNumbers[0].phoneNumber || phoneNumbers[0].number

      // Try WebRTC first
      try {
        const { rtcClient } = await import('@/lib/webrtc/rtc-client')
        await rtcClient.ensureRegistered()
        const { sessionId } = await rtcClient.startCall({ toNumber: phoneNumber, fromNumber })

        // Log the call to database
        fetch('/api/telnyx/webrtc-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webrtcSessionId: sessionId,
            contactId: selectedContact.id,
            fromNumber,
            toNumber: phoneNumber,
          })
        }).catch(err => console.error('Failed to log call:', err))

        openCall({
          contact: { id: selectedContact.id, firstName: selectedContact.firstName, lastName: selectedContact.lastName },
          fromNumber,
          toNumber: phoneNumber,
          mode: 'webrtc',
          webrtcSessionId: sessionId,
        })
        toast({ title: 'Call Started (WebRTC)', description: `Calling ${selectedContact.firstName} ${selectedContact.lastName}` })
      } catch (webrtcErr) {
        console.warn('WebRTC attempt failed, falling back to Call Control:', webrtcErr)

        // Fallback to Call Control API
        const callResponse = await fetch('/api/telnyx/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromNumber, toNumber: phoneNumber, contactId: selectedContact.id }),
        })

        if (!callResponse.ok) {
          throw new Error('Failed to initiate call')
        }

        const callData = await callResponse.json()
        openCall({
          contact: { id: selectedContact.id, firstName: selectedContact.firstName, lastName: selectedContact.lastName },
          fromNumber,
          toNumber: phoneNumber,
          mode: 'call_control',
          telnyxCallId: callData.telnyxCallId,
        })
        toast({ title: 'Call Started', description: `Calling ${selectedContact.firstName} ${selectedContact.lastName}` })
      }
    } catch (error) {
      console.error('Call error:', error)
      toast({
        title: 'Call failed',
        description: 'Failed to start call. Please try again.',
        variant: 'destructive'
      })
    }
  }

  // Handle text button click
  const handleTextContact = () => {
    if (!selectedContact) return
    // Navigate to dashboard with messaging tab and contact ID
    router.push(`/dashboard?tab=messaging&contactId=${selectedContact.id}`)
  }

  // Handle task button click - Dashboard style
  const handleAddTask = () => {
    if (!selectedContact) return
    setActivityType("task")
    setTitle("")
    setDescription("")
    setDueDate(format(new Date(), "yyyy-MM-dd"))
    setDueTime("09:00")
    setShowAddActivityDialog(true)
  }

  // Save activity - Dashboard style
  const handleSaveActivity = async () => {
    if (!selectedContact || !title.trim()) return

    try {
      const dueDateObj = new Date(`${dueDate}T${dueTime}:00`)

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          type: activityType,
          title: title.trim(),
          description: description.trim() || '',
          dueDate: dueDateObj.toISOString(),
          status: 'planned',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add activity')
      }

      toast({
        title: "Success",
        description: "Activity created successfully",
      })

      // Reset form
      setTitle('')
      setDescription('')
      setDueDate(format(new Date(), "yyyy-MM-dd"))
      setDueTime("09:00")
      setShowAddActivityDialog(false)
    } catch (error) {
      console.error('Error saving activity:', error)
      toast({
        title: 'Error',
        description: 'Failed to create activity',
        variant: 'destructive'
      })
    }
  }

  const handleAddContact = async (newContactData: Omit<Contact, "id" | "createdAt">) => {
    try {
      await addContact(newContactData as any)
      setShowAddDialog(false)
      await refreshContacts()
      toast({
        title: "Success",
        description: "Contact added successfully",
      })
    } catch (e) {
      console.error('Failed to add contact', e)
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="flex h-screen bg-[#f8f9fa]">
      {/* Left Panel - Contact List */}
      <div className="w-[400px] border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
            <Button onClick={() => setShowAddDialog(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {/* All contacts info - no checkbox */}
          <div className="mb-4">
            <span className="text-sm font-medium text-gray-700">
              All Contacts ({pagination?.totalCount || contacts.length})
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts, properties, LLC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[700px] p-0"
                align="start"
                side="bottom"
              >
                <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                  {/* Filter Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvancedFilters(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Filter Content */}
                  <div className="p-4 max-h-[600px] overflow-y-auto">
                    <AdvancedFiltersRedesign onClose={() => setShowAdvancedFilters(false)} />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
                onClick={handleExportCsv}
                disabled={exporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            )}
          </div>
        </div>

        {/* Contact List */}
        <div className="p-4">
          {/* Bulk Selection Actions Card - Figma Design - ABOVE Select All */}
          {selectedContactIds.length > 0 && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md" style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9' }}>
              <span className="text-sm font-medium" style={{ color: '#1565C0' }}>
                {selectedContactIds.length} selected
              </span>
              <div className="h-4 w-px mx-1" style={{ backgroundColor: '#64B5F6' }} />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs hover:bg-white/50"
                style={{ color: '#1976D2' }}
                onClick={() => setShowBulkTagOperations(true)}
              >
                <Tags className="h-3 w-3 mr-1" />
                Add Tags
              </Button>
              {isAdmin && (
                <>
                  <AssignContactModal
                    contacts={contacts.filter(c => selectedContactIds.includes(c.id))}
                    onAssignmentComplete={() => {
                      toast({
                        title: "Success",
                        description: `${selectedContactIds.length} contact(s) assigned successfully`,
                      })
                      setSelectedContactIds([])
                      refreshContacts()
                    }}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs hover:bg-white/50"
                        style={{ color: '#1976D2' }}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Assign
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                    onClick={handleDeleteContacts}
                    disabled={deleting}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Select All Checkbox - Figma Design */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-700">
                Select All ({contacts.length})
              </span>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading contacts...</div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No contacts found</p>
                </div>
              ) : (
                contacts.map((contact) => (
                  <Card
                    key={contact.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedContact?.id === contact.id
                        ? 'border-2'
                        : 'hover:border-gray-300'
                    }`}
                    style={selectedContact?.id === contact.id ? {
                      backgroundColor: '#E3F2FD',
                      borderColor: '#2196F3'
                    } : {}}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedContactIds.includes(contact.id)}
                          onCheckedChange={(checked) => handleContactCheckbox(contact.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1" onClick={() => handleContactSelect(contact)}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">
                                {contact.firstName} {contact.lastName}
                              </h3>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {contact.dealStatus === 'active' && (
                                  <Badge className="text-white text-xs px-2 py-0" style={{ backgroundColor: '#2196F3' }}>active</Badge>
                                )}
                                {contact.dealStatus === 'hot-lead' && (
                                  <Badge className="bg-orange-500 text-white text-xs px-2 py-0">hot-lead</Badge>
                                )}
                                {contact.dealStatus === 'qualified' && (
                                  <Badge variant="outline" className="text-xs px-2 py-0">qualified</Badge>
                                )}
                                {contact.dealStatus === 'lead' && (
                                  <Badge variant="secondary" className="text-xs px-2 py-0">lead</Badge>
                                )}
                                {/* Show real tags from database */}
                                {contact.tags && contact.tags.map((tag: any) => (
                                  <Badge
                                    key={tag.id}
                                    variant="outline"
                                    style={{
                                      backgroundColor: `${tag.color}15`,
                                      borderColor: tag.color,
                                      color: tag.color
                                    }}
                                    className="text-xs px-2 py-0"
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 text-sm text-gray-600">
                            {contact.propertyAddress && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-sm">{contact.propertyAddress}</span>
                              </div>
                            )}
                            {contact.city && contact.state && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-sm">{contact.city}, {contact.state} {contact.propertyCounty || ''}</span>
                              </div>
                            )}
                            {contact.llcName && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                <span className="truncate text-sm">{contact.llcName}</span>
                              </div>
                            )}
                            {contact.propertyType && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <span className="font-medium">
                                  {contact.propertyType}
                                  {contact.bedrooms && ` - ${contact.bedrooms} units`}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 space-y-1 text-sm">
                            {contact.phone1 && (
                              <div className="text-gray-900 font-medium">{contact.phone1}</div>
                            )}
                            {contact.email1 && (
                              <div className="text-gray-600 truncate text-sm">{contact.email1}</div>
                            )}
                          </div>

                          {contact.createdAt && (
                            <div className="mt-2 text-xs text-gray-400">
                              👤 {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={!pagination.hasMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Contact Details */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Contact Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedContact.firstName} {selectedContact.lastName}
                  </h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selectedContact.dealStatus === 'active' && (
                      <Badge className="text-white text-xs" style={{ backgroundColor: '#2196F3' }}>active</Badge>
                    )}
                    {selectedContact.dealStatus === 'hot-lead' && (
                      <Badge className="bg-orange-500 text-white text-xs">hot-lead</Badge>
                    )}
                    {selectedContact.dealStatus === 'qualified' && (
                      <Badge variant="outline" className="text-xs">qualified</Badge>
                    )}
                    {selectedContact.dealStatus === 'lead' && (
                      <Badge variant="secondary" className="text-xs">lead</Badge>
                    )}
                    {/* Show real tags */}
                    {contactTags.map((tag: any) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}15`,
                          borderColor: tag.color,
                          color: tag.color
                        }}
                        className="text-xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAddTask}>
                    <FileText className="h-4 w-4 mr-2" />
                    Task
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleTextContact}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Text
                  </Button>
                  <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleCallContact}>
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            </div>

            {/* Contact Details Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl space-y-6">
                {/* Property Information */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Property Information
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-gray-600">Address</label>
                        <p className="font-medium">{selectedContact.propertyAddress || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">City, State ZIP</label>
                        <p className="font-medium">
                          {selectedContact.city}, {selectedContact.state} {selectedContact.propertyCounty}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Property Type</label>
                        <p className="font-medium">{selectedContact.propertyType || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Bedrooms</label>
                        <p className="font-medium">{selectedContact.bedrooms || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">LLC Owner</label>
                        <p className="font-medium">{selectedContact.llcName || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone
                        </label>
                        <p className="font-medium">+1 {selectedContact.phone1?.replace('+1', '') || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </label>
                        <p className="font-medium">{selectedContact.email1 || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Company
                        </label>
                        <p className="font-medium">{selectedContact.llcName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Assigned To
                        </label>
                        <p className="font-medium">John Doe</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Last Contact
                        </label>
                        <p className="font-medium">
                          {selectedContact.createdAt ? format(new Date(selectedContact.createdAt), 'yyyy-MM-dd') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Notes
                    </h3>
                    <p className="text-gray-600">
                      {selectedContact.notes || 'Interested in purchasing multi-family property, follow up next week.'}
                    </p>
                  </CardContent>
                </Card>

                {/* Activity Timeline - Real Data */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Activity Timeline
                    </h3>
                    <ContactTimeline contactId={selectedContact.id} />
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Select a contact to view details</p>
          </div>
        )}
      </div>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAddContact={handleAddContact}
      />

      {/* Bulk Tag Operations Dialog */}
      <BulkTagOperations
        open={showBulkTagOperations}
        onOpenChange={setShowBulkTagOperations}
        selectedContactIds={selectedContactIds}
        onComplete={() => {
          setShowBulkTagOperations(false)
          setSelectedContactIds([])
          refreshContacts()
          toast({
            title: "Success",
            description: "Tags updated successfully",
          })
        }}
      />

      {/* Add Activity Dialog - Dashboard Style */}
      <Dialog open={showAddActivityDialog} onOpenChange={setShowAddActivityDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Add Activity for {selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activity-type">Activity Type</Label>
              <Select value={activityType} onValueChange={(value) => setActivityType(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter activity title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter activity description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-time">Due Time</Label>
                <Input id="due-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddActivityDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveActivity} disabled={!title || !dueDate}>
              Add Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <EditContactDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        contact={selectedContact}
      />
    </div>
  )
}

interface ActivityItemProps {
  type: 'call' | 'email' | 'sms'
  title: string
  description: string
  detail: string
  date: string
}

function ActivityItem({ type, title, description, detail, date }: ActivityItemProps) {
  const getIcon = () => {
    switch (type) {
      case 'call':
        return <PhoneCall className="h-5 w-5 text-blue-500" />
      case 'email':
        return <Mail className="h-5 w-5 text-purple-500" />
      case 'sms':
        return <MessageSquare className="h-5 w-5 text-green-500" />
    }
  }

  const getBgColor = () => {
    switch (type) {
      case 'call':
        return 'bg-blue-50'
      case 'email':
        return 'bg-purple-50'
      case 'sms':
        return 'bg-green-50'
    }
  }

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
      <div className={`p-2 rounded-lg ${getBgColor()}`}>
        {getIcon()}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
        {detail && <p className="text-sm text-gray-500 mt-1">{detail}</p>}
      </div>
      <div className="text-sm text-gray-400">{date}</div>
    </div>
  )
}

