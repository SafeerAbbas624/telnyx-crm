"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X, Phone, Mail, Building2, Calendar, Tag, MessageSquare, PhoneCall, FileText, CheckSquare, User, Plus, Save, Loader2, Trash2, ChevronDown, ChevronUp, Edit2, Check, Cloud, CloudOff, GripHorizontal, Minimize2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { Contact, Activity } from "@/lib/types"
import { format } from "date-fns"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { useMakeCall } from "@/hooks/use-make-call"
import { useTaskUI } from "@/lib/context/task-ui-context"
import { usePhoneNumber } from "@/lib/context/phone-number-context"
import Link from "next/link"

import { TagInput } from "@/components/ui/tag-input"
import { toast } from "sonner"
import ContactSequences from "./contact-sequences"
import { formatPhoneNumberForTelnyx, formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import { normalizePropertyType, getStandardPropertyTypes } from "@/lib/property-type-mapper"
import { CallButtonWithCellHover } from "@/components/ui/call-button-with-cell-hover"

interface ContactSidePanelProps {
  contact: Contact | null
  open: boolean
  onClose: () => void
}

interface Task {
  id: string
  subject: string
  description?: string
  status: string
  priority?: string
  dueDate?: string
  taskType?: string
}

interface Deal {
  id: string
  title: string
  value: number
  stage: string
  stageLabel?: string
  stageColor?: string
  probability: number
  isLoanDeal?: boolean
  lenderName?: string
  propertyAddress?: string
}

interface Property {
  id?: string
  address: string
  city: string
  state: string
  zipCode: string
  llcName: string
  propertyType: string
  bedrooms?: number
  totalBathrooms?: number
  buildingSqft?: number
  lotSizeSqft?: number
  lastSaleDate?: string
  lastSaleAmount?: number
  estValue?: number
  estEquity?: number
}

// Phone number type for Telnyx
interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  isActive: boolean
  capabilities: string[]
}

export default function ContactSidePanel({ contact, open, onClose }: ContactSidePanelProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [loadingDeals, setLoadingDeals] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentContact, setCurrentContact] = useState<Contact | null>(contact)

  // Editable fields
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phones, setPhones] = useState<string[]>([])
  const [emails, setEmails] = useState<string[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedTags, setSelectedTags] = useState<any[]>([])
  const [dealStatus, setDealStatus] = useState<string>("lead")
  const [showActivityHistory, setShowActivityHistory] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string>('')

  // Removed local phone number state - now using global context

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskData, setEditingTaskData] = useState<Partial<Task>>({})

  // Dragging state for non-modal floating panel
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 }) // 0,0 means default right side
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  const { openSms } = useSmsUI()
  const { openEmail } = useEmailUI()
  const { makeCall } = useMakeCall()
  const { openTask, setOnTaskCreated } = useTaskUI()
  const { selectedPhoneNumber } = usePhoneNumber() // Use global phone number

  // Dragging handlers
  const handleDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return
    setIsDragging(true)
    const rect = panelRef.current.getBoundingClientRect()
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    // Prevent text selection while dragging
    e.preventDefault()
  }

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStartPos.current.x
    const newY = e.clientY - dragStartPos.current.y
    // Clamp to viewport
    const maxX = window.innerWidth - 400 // panel width
    const maxY = window.innerHeight - 100
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach/detach global mouse handlers
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Reset position when opening
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 })
      setIsMinimized(false)
    }
  }, [open, contact?.id])

  // Initialize form when contact changes
  useEffect(() => {
    if (contact && open) {
      setCurrentContact(contact)
      initializeForm(contact)
    }
  }, [contact, open])

  const initializeForm = (c: Contact) => {
    setFirstName(c.firstName || "")
    setLastName(c.lastName || "")

    // Collect phones (only non-empty)
    const phoneList = [c.phone1, c.phone2, c.phone3].filter(Boolean) as string[]
    setPhones(phoneList.length > 0 ? phoneList : [""])

    // Collect emails (only non-empty)
    const emailList = [c.email1, c.email2, c.email3].filter(Boolean) as string[]
    setEmails(emailList.length > 0 ? emailList : [""])

    // Collect properties
    const propList: Property[] = []
    // Add primary property from contact if exists
    if (c.propertyAddress) {
      propList.push({
        address: c.propertyAddress || "",
        city: c.city || "",
        state: c.state || "",
        zipCode: c.zipCode || "",
        llcName: c.llcName || "",
        propertyType: normalizePropertyType(c.propertyType) || "",
        bedrooms: c.bedrooms ?? undefined,
        totalBathrooms: c.totalBathrooms ?? undefined,
        buildingSqft: c.buildingSqft ?? undefined,
        lotSizeSqft: (c as any).lotSizeSqft ?? undefined,
        lastSaleDate: (c as any).lastSaleDate ?? undefined,
        lastSaleAmount: (c as any).lastSaleAmount ?? undefined,
        estValue: c.estValue ?? undefined,
        estEquity: c.estEquity ?? undefined,
      })
    }
    // Add additional properties
    if ((c as any).properties) {
      (c as any).properties.forEach((p: any) => {
        propList.push({
          id: p.id,
          address: p.address || "",
          city: p.city || "",
          state: p.state || "",
          zipCode: p.zipCode || "",
          llcName: p.llcName || "",
          propertyType: normalizePropertyType(p.propertyType) || "",
          bedrooms: p.bedrooms,
          totalBathrooms: p.totalBathrooms,
          buildingSqft: p.buildingSqft,
          lotSizeSqft: p.lotSizeSqft,
          lastSaleDate: p.lastSaleDate,
          lastSaleAmount: p.lastSaleAmount,
          estValue: p.estValue,
          estEquity: p.estEquity,
        })
      })
    }
    setProperties(propList.length > 0 ? propList : [{ address: "", city: "", state: "", zipCode: "", llcName: "", propertyType: "" }])

    setSelectedTags(c.tags || [])
    setDealStatus(c.dealStatus || "lead")
    setHasChanges(false)
  }

  // Fetch full contact details
  useEffect(() => {
    const fetchFullContact = async () => {
      if (contact?.id && open) {
        try {
          const res = await fetch(`/api/contacts/${contact.id}`)
          if (res.ok) {
            const fullContact = await res.json()
            setCurrentContact(fullContact)
            initializeForm(fullContact)
          }
        } catch (error) {
          console.error('Failed to fetch full contact:', error)
        }
      }
    }
    fetchFullContact()
  }, [contact?.id, open])

  useEffect(() => {
    if (contact?.id && open) {
      loadActivities()
      loadTasks()
      loadDeals()
    }
  }, [contact?.id, open])

  // Register callback to refresh tasks when a task is created via global modal
  useEffect(() => {
    if (open && contact?.id) {
      setOnTaskCreated(() => {
        loadTasks()
      })
      return () => {
        setOnTaskCreated(undefined)
      }
    }
  }, [open, contact?.id, setOnTaskCreated])

  // Removed loadTelnyxPhoneNumbers - now using global phone number context

  // Auto-save functionality with debounce
  const performAutoSave = useCallback(async () => {
    if (!currentContact) return

    const payload: any = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      phone1: phones[0] || undefined,
      phone2: phones[1] || undefined,
      phone3: phones[2] || undefined,
      email1: emails[0] || undefined,
      email2: emails[1] || undefined,
      email3: emails[2] || undefined,
      dealStatus,
      tags: selectedTags.map((t: any) => ({
        id: typeof t.id === 'string' && t.id.startsWith('new:') ? undefined : t.id,
        name: t.name,
        color: t.color || '#3B82F6'
      })),
    }

    // First property goes to contact record
    if (properties[0]) {
      payload.propertyAddress = properties[0].address || undefined
      payload.city = properties[0].city || undefined
      payload.state = properties[0].state || undefined
      payload.zipCode = properties[0].zipCode || undefined
      payload.llcName = properties[0].llcName || undefined
      payload.propertyType = properties[0].propertyType || undefined
      payload.bedrooms = properties[0].bedrooms
      payload.totalBathrooms = properties[0].totalBathrooms
      payload.buildingSqft = properties[0].buildingSqft
      payload.lotSizeSqft = properties[0].lotSizeSqft
      payload.lastSaleDate = properties[0].lastSaleDate
      payload.lastSaleAmount = properties[0].lastSaleAmount
      payload.estValue = properties[0].estValue
      payload.estEquity = properties[0].estEquity
    }

    // Additional properties
    if (properties.length > 1) {
      payload.additionalProperties = properties.slice(1).map(p => ({
        id: p.id,
        address: p.address,
        city: p.city,
        state: p.state,
        zipCode: p.zipCode,
        llcName: p.llcName,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms,
        totalBathrooms: p.totalBathrooms,
        buildingSqft: p.buildingSqft,
        lotSizeSqft: p.lotSizeSqft,
        lastSaleDate: p.lastSaleDate,
        lastSaleAmount: p.lastSaleAmount,
        estValue: p.estValue,
        estEquity: p.estEquity,
      }))
    }

    // Check if data actually changed
    const currentDataString = JSON.stringify(payload)
    if (currentDataString === lastSavedDataRef.current) {
      return // No changes, skip save
    }

    setSaveStatus('saving')
    console.log('[ContactPanel] Auto-saving...', { tags: payload.tags?.length })
    try {
      const res = await fetch(`/api/contacts/${currentContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const updated = await res.json()
        console.log('[ContactPanel] Saved successfully', { tags: updated.tags?.length })
        setCurrentContact(updated)

        // Update local state with server response to sync any new tag IDs
        setSelectedTags(updated.tags || [])

        lastSavedDataRef.current = currentDataString
        setSaveStatus('saved')
        setHasChanges(false)
        toast.success('Auto-saved ✓', { duration: 2000 })

        // Emit event to notify contacts list to update this contact
        window.dispatchEvent(new CustomEvent('contact-updated', {
          detail: { contactId: currentContact.id, updatedContact: updated }
        }))

        // Emit event to notify tag components to refresh their data
        window.dispatchEvent(new CustomEvent('tags-updated'))

        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        const errText = await res.text()
        console.error('[ContactPanel] Save failed:', res.status, errText)
        setSaveStatus('error')
        toast.error('Failed to save changes')
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
      toast.error('Failed to save changes')
    }
  }, [currentContact, firstName, lastName, phones, emails, properties, selectedTags, dealStatus])

  // Trigger auto-save when changes are made (debounced)
  const markChanged = useCallback(() => {
    setHasChanges(true)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (800ms debounce)
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave()
    }, 800)
  }, [performAutoSave])

  // Instant save for tags (no debounce)
  const saveTagsInstantly = useCallback(() => {
    setHasChanges(true)

    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Save immediately
    performAutoSave()
  }, [performAutoSave])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Save pending changes when panel closes
  useEffect(() => {
    if (!open && hasChanges) {
      performAutoSave()
    }
  }, [open, hasChanges, performAutoSave])

  // Handle call using multi-call system
  const handleCall = async (phone: string) => {
    if (!currentContact) return
    const contactName = `${currentContact.firstName || ''} ${currentContact.lastName || ''}`.trim()
    await makeCall({
      phoneNumber: phone,
      contactId: currentContact.id,
      contactName,
    })
  }

  const handleText = (phone: string) => {
    if (!currentContact) return
    openSms({
      phoneNumber: phone,
      contact: {
        id: currentContact.id,
        firstName: currentContact.firstName,
        lastName: currentContact.lastName,
      },
    })
  }

  const handleEmail = (emailAddr: string) => {
    if (!currentContact) return
    openEmail({
      email: emailAddr,
      contact: {
        id: currentContact.id,
        firstName: currentContact.firstName,
        lastName: currentContact.lastName,
      },
    })
  }

  // Task completion handler
  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: completed ? 'completed' : 'open' }),
      })

      if (res.ok) {
        // Update local state
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: completed ? 'completed' : 'open' } : t
        ))
        toast.success(completed ? 'Task completed!' : 'Task reopened')
      } else {
        toast.error('Failed to update task')
      }
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('Failed to update task')
    }
  }

  // Start editing a task
  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTaskData({
      subject: task.subject,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
    })
  }

  // Cancel task editing
  const cancelEditingTask = () => {
    setEditingTaskId(null)
    setEditingTaskData({})
  }

  // Save task edits
  const saveTaskEdit = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTaskData),
      })

      if (res.ok) {
        // Update local state
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, ...editingTaskData } : t
        ))
        setEditingTaskId(null)
        setEditingTaskData({})
        toast.success('Task updated')
      } else {
        toast.error('Failed to update task')
      }
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('Failed to update task')
    }
  }

  // Open task creation dialog
  const handleCreateTask = () => {
    if (!currentContact) return
    openTask({
      contact: currentContact,
      contactId: currentContact.id,
    })
  }

  const loadActivities = async () => {
    if (!contact?.id) return
    setLoading(true)
    try {
      const response = await fetch(`/api/activities?contactId=${contact.id}`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!contact?.id) return
    setLoadingTasks(true)
    try {
      const response = await fetch(`/api/tasks?contactId=${contact.id}`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }

  const loadDeals = async () => {
    if (!contact?.id) return
    setLoadingDeals(true)
    try {
      const response = await fetch(`/api/deals?contactId=${contact.id}`)
      if (response.ok) {
        const data = await response.json()
        setDeals(data.deals || [])
      }
    } catch (error) {
      console.error('Failed to load deals:', error)
    } finally {
      setLoadingDeals(false)
    }
  }

  // Phone management
  const addPhone = () => {
    if (phones.length < 3) {
      setPhones([...phones, ""])
      markChanged()
    }
  }
  const removePhone = (idx: number) => {
    if (phones.length > 1) {
      setPhones(phones.filter((_, i) => i !== idx))
      markChanged()
    }
  }
  const updatePhone = (idx: number, value: string) => {
    const newPhones = [...phones]
    newPhones[idx] = value
    setPhones(newPhones)
    markChanged()
  }

  // Email management
  const addEmail = () => {
    if (emails.length < 3) {
      setEmails([...emails, ""])
      markChanged()
    }
  }
  const removeEmail = (idx: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== idx))
      markChanged()
    }
  }
  const updateEmail = (idx: number, value: string) => {
    const newEmails = [...emails]
    newEmails[idx] = value
    setEmails(newEmails)
    markChanged()
  }

  // Property management
  const addProperty = () => {
    setProperties([...properties, { address: "", city: "", state: "", zipCode: "", llcName: "", propertyType: "" }])
    markChanged()
  }
  const removeProperty = (idx: number) => {
    if (properties.length > 1) {
      setProperties(properties.filter((_, i) => i !== idx))
      markChanged()
    }
  }
  const updateProperty = (idx: number, field: keyof Property, value: any) => {
    const newProps = [...properties]
    ;(newProps[idx] as any)[field] = value
    setProperties(newProps)
    markChanged()
  }

  if (!open || !contact) return null

  // Split tasks into open and completed
  const openTasks = tasks.filter(t => t.status !== 'completed')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4 text-blue-500" />
      case 'sms': case 'text': return <MessageSquare className="h-4 w-4 text-green-500" />
      case 'email': return <Mail className="h-4 w-4 text-purple-500" />
      case 'task': return <CheckSquare className="h-4 w-4 text-orange-500" />
      default: return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  // Minimized pill view
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 shadow-lg border bg-white rounded-full px-4 py-2 flex items-center gap-3 cursor-pointer hover:shadow-xl transition-shadow"
        onClick={() => setIsMinimized(false)}
      >
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium">{firstName} {lastName}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setIsMinimized(false) }}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onClose() }}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Calculate panel position - default to right side, or use dragged position
  const panelStyle = position.x === 0 && position.y === 0
    ? { right: 0, top: 0 } // Default right-side position
    : { left: position.x, top: position.y, right: 'auto' } // Dragged position

  return (
    // No overlay - panel is non-modal
    <div
      ref={panelRef}
      className="fixed h-[calc(100vh-32px)] w-[420px] bg-white shadow-2xl z-50 flex flex-col rounded-lg border overflow-hidden"
      style={{ ...panelStyle, maxHeight: 'calc(100vh - 32px)', margin: position.x === 0 && position.y === 0 ? '16px' : 0 }}
    >
      {/* Draggable Header */}
      <div
        className="flex items-center justify-between p-2 border-b bg-gradient-to-r from-primary/5 to-primary/10 cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripHorizontal className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex gap-1 flex-1 min-w-0" onMouseDown={(e) => e.stopPropagation()}>
            <Input
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); markChanged() }}
              placeholder="First"
              className="h-7 text-sm font-semibold bg-white/50 min-w-0"
            />
            <Input
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); markChanged() }}
              placeholder="Last"
              className="h-7 text-sm font-semibold bg-white/50 min-w-0"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 ml-1 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {/* Auto-save status indicator */}
          <div className="flex items-center gap-1 text-xs mr-2">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="font-medium">Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded">
                <Cloud className="h-3 w-3" />
                <span className="font-medium">Saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded cursor-pointer" onClick={performAutoSave} title="Click to retry">
                <CloudOff className="h-3 w-3" />
                <span className="font-medium">Error</span>
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMinimized(true)} className="h-6 w-6">
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Contact Information - Phones & Emails */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {/* Phones */}
                {phones.map((phone, idx) => (
                  <div key={`phone-${idx}`} className="flex items-center gap-2">
                    <Input
                      value={phone}
                      onChange={(e) => updatePhone(idx, e.target.value)}
                      placeholder={`Phone ${idx + 1}`}
                      type="tel"
                      className="h-8 text-sm flex-1"
                    />
                    {phone && (
                      <div className="flex items-center gap-0.5">
                        <CallButtonWithCellHover
                          phoneNumber={phone}
                          contactId={currentContact?.id}
                          contactName={`${currentContact?.firstName || ''} ${currentContact?.lastName || ''}`.trim()}
                          onWebRTCCall={() => handleCall(phone)}
                          className="hover:bg-blue-50"
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-green-50" onClick={() => handleText(phone)} title="Text">
                          <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                      </div>
                    )}
                    {phones.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-50" onClick={() => removePhone(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                {phones.length < 3 && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0" onClick={addPhone}>
                    <Plus className="h-3 w-3 mr-1" /> Add Phone
                  </Button>
                )}

                {/* Emails */}
                <div className="border-t pt-2 mt-2">
                  {emails.map((email, idx) => (
                    <div key={`email-${idx}`} className="flex items-center gap-2 mb-2">
                      <Input
                        value={email}
                        onChange={(e) => updateEmail(idx, e.target.value)}
                        placeholder={`Email ${idx + 1}`}
                        type="email"
                        className="h-8 text-sm flex-1"
                      />
                      {email && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-purple-50" onClick={() => handleEmail(email)} title="Send Email">
                          <Mail className="h-3.5 w-3.5 text-purple-600" />
                        </Button>
                      )}
                      {emails.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-50" onClick={() => removeEmail(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {emails.length < 3 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0" onClick={addEmail}>
                      <Plus className="h-3 w-3 mr-1" /> Add Email
                    </Button>
                  )}
                </div>

                {/* Deal Status */}
                <div className="border-t pt-2 mt-2">
                  <Label className="text-xs text-gray-500">Deal Status</Label>
                  <Select value={dealStatus} onValueChange={(v) => { setDealStatus(v); markChanged() }}>
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="credit_run">Credit Run</SelectItem>
                      <SelectItem value="document_collection">Document Collection</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="underwriting">Underwriting</SelectItem>
                      <SelectItem value="closing">Closing</SelectItem>
                      <SelectItem value="funded">Funded</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Properties Section - Numbered */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Properties ({properties.length})
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0" onClick={addProperty}>
                    <Plus className="h-3 w-3 mr-1" /> Add Property
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                {properties.map((prop, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-600">Property {idx + 1}</span>
                      {properties.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-red-50" onClick={() => removeProperty(idx)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <Input
                      value={prop.address}
                      onChange={(e) => updateProperty(idx, 'address', e.target.value)}
                      placeholder="Address"
                      className="h-7 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      <Input
                        value={prop.city}
                        onChange={(e) => updateProperty(idx, 'city', e.target.value)}
                        placeholder="City"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={prop.state}
                        onChange={(e) => updateProperty(idx, 'state', e.target.value)}
                        placeholder="State"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={prop.zipCode}
                        onChange={(e) => updateProperty(idx, 'zipCode', e.target.value)}
                        placeholder="Zip"
                        className="h-7 text-xs"
                      />
                    </div>
                    <Input
                      value={prop.llcName}
                      onChange={(e) => updateProperty(idx, 'llcName', e.target.value)}
                      placeholder="LLC Name (optional)"
                      className="h-7 text-sm"
                    />
                    {/* Property Type - using normalized standard values */}
                    <Select
                      value={prop.propertyType || ''}
                      onValueChange={(v) => updateProperty(idx, 'propertyType', v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Property Type">
                          {prop.propertyType || "Property Type"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single-family (SFH)">Single-family (SFH)</SelectItem>
                        <SelectItem value="Duplex">Duplex</SelectItem>
                        <SelectItem value="Triplex">Triplex</SelectItem>
                        <SelectItem value="Quadplex">Quadplex</SelectItem>
                        <SelectItem value="Multi-family">Multi-family (5+)</SelectItem>
                        <SelectItem value="Townhouse">Townhouse</SelectItem>
                        <SelectItem value="Condo">Condo</SelectItem>
                        <SelectItem value="Mobile Home">Mobile Home</SelectItem>
                        <SelectItem value="Land">Land</SelectItem>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Beds, Baths, Sqft */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <Label className="text-[10px] text-gray-400">Beds</Label>
                        <Input
                          type="number"
                          value={prop.bedrooms || ''}
                          onChange={(e) => updateProperty(idx, 'bedrooms', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="—"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-400">Baths</Label>
                        <Input
                          type="number"
                          value={prop.totalBathrooms || ''}
                          onChange={(e) => updateProperty(idx, 'totalBathrooms', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="—"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-400">Sqft</Label>
                        <Input
                          type="number"
                          value={prop.buildingSqft || ''}
                          onChange={(e) => updateProperty(idx, 'buildingSqft', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="—"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    {/* Value & Equity */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[10px] text-gray-400">Est. Value</Label>
                        <Input
                          type="number"
                          value={prop.estValue || ''}
                          onChange={(e) => updateProperty(idx, 'estValue', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="$"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-400">Est. Equity</Label>
                        <Input
                          type="number"
                          value={prop.estEquity || ''}
                          onChange={(e) => updateProperty(idx, 'estEquity', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="$"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    {/* Last Sale Date & Amount - collapsed/less prominent */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-gray-100">
                      <div>
                        <Label className="text-[10px] text-gray-400">Last Sale Date</Label>
                        <Input
                          type="date"
                          value={prop.lastSaleDate ? prop.lastSaleDate.split('T')[0] : ''}
                          onChange={(e) => updateProperty(idx, 'lastSaleDate', e.target.value || undefined)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-400">Last Sale Amt</Label>
                        <Input
                          type="number"
                          value={prop.lastSaleAmount || ''}
                          onChange={(e) => updateProperty(idx, 'lastSaleAmount', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="$"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <TagInput
                  value={selectedTags}
                  onChange={(tags) => { setSelectedTags(tags); saveTagsInstantly() }}
                  contactId={currentContact?.id}
                  placeholder="Add tags..."
                  showSuggestions={true}
                  allowCreate={true}
                />
              </CardContent>
            </Card>

            {/* Open Tasks Section */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Open Tasks ({openTasks.length})
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 p-0" onClick={handleCreateTask}>
                    <Plus className="h-3 w-3 mr-1" /> Add Task
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {loadingTasks ? (
                  <div className="text-center py-3 text-gray-500 text-xs">Loading...</div>
                ) : openTasks.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 text-xs">No open tasks</div>
                ) : (
                  <div className="space-y-1.5">
                    {openTasks.map((task) => (
                      <div key={task.id} className="p-2 rounded border border-blue-100 bg-blue-50/50 text-sm">
                        {editingTaskId === task.id ? (
                          // Editing mode
                          <div className="space-y-2">
                            <Input
                              value={editingTaskData.subject || ''}
                              onChange={(e) => setEditingTaskData(prev => ({ ...prev, subject: e.target.value }))}
                              placeholder="Task subject"
                              className="h-7 text-sm"
                            />
                            <Input
                              value={editingTaskData.description || ''}
                              onChange={(e) => setEditingTaskData(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Description (optional)"
                              className="h-7 text-xs"
                            />
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={editingTaskData.dueDate ? editingTaskData.dueDate.split('T')[0] : ''}
                                onChange={(e) => setEditingTaskData(prev => ({ ...prev, dueDate: e.target.value }))}
                                className="h-7 text-xs flex-1"
                              />
                              <Select
                                value={editingTaskData.priority || 'low'}
                                onValueChange={(v) => setEditingTaskData(prev => ({ ...prev, priority: v }))}
                              >
                                <SelectTrigger className="h-7 text-xs w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={cancelEditingTask}>
                                Cancel
                              </Button>
                              <Button size="sm" className="h-6 text-xs" onClick={() => saveTaskEdit(task.id)}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <>
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={false}
                                onCheckedChange={(checked) => handleTaskComplete(task.id, !!checked)}
                                className="mt-0.5 h-4 w-4"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate text-sm">{task.subject}</div>
                                {task.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    task.priority === 'high' ? 'border-red-400 text-red-600 bg-red-50' :
                                    task.priority === 'medium' ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                                    'border-gray-300 text-gray-500'
                                  }`}
                                >
                                  {task.priority || 'low'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-blue-100"
                                  onClick={() => startEditingTask(task)}
                                >
                                  <Edit2 className="h-3 w-3 text-blue-600" />
                                </Button>
                              </div>
                            </div>
                            {task.dueDate && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 ml-6">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.dueDate), 'MMM d, yyyy')}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sequences Section */}
            {currentContact?.id && (
              <ContactSequences contactId={currentContact.id} />
            )}

            {/* Deals Section */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Deals ({deals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {loadingDeals ? (
                  <div className="text-center py-3 text-gray-500 text-xs">Loading...</div>
                ) : deals.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 text-xs">No deals yet</div>
                ) : (
                  <div className="space-y-1.5">
                    {deals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={deal.isLoanDeal ? `/loan-copilot/${deal.id}` : `/deals?dealId=${deal.id}`}
                        className="block p-2 rounded border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate text-sm">{deal.title}</div>
                            {deal.propertyAddress && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{deal.propertyAddress}</p>
                            )}
                            {deal.lenderName && (
                              <p className="text-xs text-gray-400 mt-0.5">Lender: {deal.lenderName}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                              style={{
                                backgroundColor: deal.stageColor ? `${deal.stageColor}20` : undefined,
                                borderColor: deal.stageColor || undefined,
                                color: deal.stageColor || undefined,
                              }}
                            >
                              {deal.stageLabel || deal.stage}
                            </Badge>
                            <span className="text-xs font-medium text-green-600">
                              ${deal.value?.toLocaleString() || 0}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity History - Collapsible */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle
                  className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between cursor-pointer"
                  onClick={() => setShowActivityHistory(!showActivityHistory)}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Activity History ({activities.length + completedTasks.length})
                  </div>
                  {showActivityHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              {showActivityHistory && (
                <CardContent className="px-3 pb-3">
                  {loading ? (
                    <div className="text-center py-3 text-gray-500 text-xs">Loading...</div>
                  ) : (activities.length === 0 && completedTasks.length === 0) ? (
                    <div className="text-center py-3 text-gray-400 text-xs">No activity yet</div>
                  ) : (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {/* Combine activities and completed tasks, sort by date */}
                      {[
                        ...activities.map(a => ({ ...a, itemType: 'activity' as const, sortDate: new Date(a.createdAt || a.dueDate || 0) })),
                        ...completedTasks.map(t => ({
                          id: t.id,
                          title: t.subject,
                          description: t.description,
                          type: 'task',
                          itemType: 'completedTask' as const,
                          sortDate: new Date(t.dueDate || 0)
                        }))
                      ]
                        .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
                        .map((item) => (
                          <div key={item.id} className="p-2 rounded border border-gray-100 bg-gray-50/50 text-sm">
                            <div className="flex items-start gap-2">
                              {item.itemType === 'completedTask' ? (
                                <Checkbox
                                  checked={true}
                                  onCheckedChange={(checked) => handleTaskComplete(item.id, !!checked)}
                                  className="mt-0.5 h-4 w-4"
                                />
                              ) : (
                                <div className="mt-0.5">{getActivityIcon(item.type)}</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-medium text-sm truncate ${item.itemType === 'completedTask' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                    {item.title}
                                  </span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${item.itemType === 'completedTask' ? 'text-green-600 border-green-300 bg-green-50' : 'text-gray-500'}`}>
                                    {item.itemType === 'completedTask' ? 'completed' : item.type}
                                  </Badge>
                                </div>
                                {item.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                                )}
                                <div className="text-[10px] text-gray-400 mt-1">
                                  {format(item.sortDate, 'MMM d, yyyy h:mm a')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </ScrollArea>
      </div>
  )
}

