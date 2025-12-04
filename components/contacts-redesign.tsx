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
  Edit,
  LayoutGrid,
  List
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
import ContactsDataGrid from "./contacts/contacts-data-grid"
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
  const [fullContact, setFullContact] = useState<Contact | null>(null)
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState(0)
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
  // Removed viewMode - only using grid/excel view now

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

  // Fetch full contact data with properties and tags when contact is selected
  useEffect(() => {
    if (selectedContact) {
      const fetchFullContact = async () => {
        try {
          const res = await fetch(`/api/contacts/${selectedContact.id}`)
          if (res.ok) {
            const data = await res.json()
            setFullContact(data)
            setContactTags(data.tags || [])
            setSelectedPropertyIndex(0)
          }
        } catch (error) {
          console.error('Error fetching full contact:', error)
          setContactTags(selectedContact.tags || [])
        }
      }
      fetchFullContact()
    } else {
      setFullContact(null)
      setContactTags([])
      setSelectedPropertyIndex(0)
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

  const handleSelectAll = async () => {
    try {
      // If all contacts are already selected, deselect all
      if (selectedContactIds.length > 0) {
        setSelectedContactIds([])
        toast({
          title: "Success",
          description: "Deselected all contacts",
        })
        return
      }

      // Fetch ALL contacts matching current filters
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '10000')

      if (currentQuery) {
        params.set('search', currentQuery)
      }

      if (currentFilters) {
        Object.entries(currentFilters).forEach(([key, value]) => {
          if (value != null && String(value).length > 0) {
            params.set(key, String(value))
          }
        })
      }

      const res = await fetch(`/api/contacts?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch contacts')

      const data = await res.json()
      const allContacts = data.contacts || data

      if (Array.isArray(allContacts)) {
        const allContactIds = allContacts.map((contact: Contact) => contact.id)
        setSelectedContactIds(allContactIds)
        toast({
          title: "Success",
          description: `Selected ${allContacts.length} contacts`,
        })
      }
    } catch (error) {
      console.error('Error selecting all contacts:', error)
      toast({
        title: "Error",
        description: "Failed to select all contacts",
        variant: "destructive",
      })
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

  // Only Excel/Grid view - list view removed
  return (
    <div className="h-screen bg-[#f8f9fa] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
          <span className="text-sm text-muted-foreground">
            Excel-like view with resizable columns
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddDialog(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-hidden">
        <ContactsDataGrid
          onContactSelect={(contact) => {
            setSelectedContact(contact)
          }}
          onEditContact={(contact) => {
            setSelectedContact(contact)
            setShowEditDialog(true)
          }}
          onDeleteContact={async (contactId) => {
            if (confirm('Are you sure you want to delete this contact?')) {
              await deleteContact(contactId)
              await refreshContacts()
            }
          }}
        />
      </div>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAddContact={handleAddContact}
      />

      {/* Edit Contact Dialog */}
      {selectedContact && (
        <EditContactDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) refreshContacts()
          }}
          contact={selectedContact}
        />
      )}
    </div>
  )
}

// Removed old list view code - only using Excel view now

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

