"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Phone, Mail, MapPin, DollarSign, Home, GripHorizontal, Building2, Calendar, User, Tag, AlertCircle } from "lucide-react"
import type { Contact } from "@/lib/types"
import { ContactNotes } from "./contact-notes"
import ContactActivities from "./contact-activities"
import ContactCalls from "./contact-calls"
import ContactMessages from "./contact-messages"
import ContactEmails from "./contact-emails"
import ContactTimeline from "./contact-timeline"
import ContactScheduledMessages from "./contact-scheduled-messages"
import EditContactDialog from "./edit-contact-dialog"
import TaskDashboard from "@/components/tasks/task-dashboard"
import CustomFieldsDisplay from "./custom-fields-display"
import { useContacts } from "@/lib/context/contacts-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import InlineTagEditor from "./inline-tag-editor"
import { normalizePropertyType } from "@/lib/property-type-mapper"

interface ContactDetailsProps {
  contact: Contact
  onBack: () => void
}

export default function ContactDetails({ contact, onBack }: ContactDetailsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [topPanelHeight, setTopPanelHeight] = useState(50) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { updateContact, tags } = useContacts()


  const [fullContact, setFullContact] = useState<Contact | null>(null)
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState(0)

  useEffect(() => {
    let isMounted = true
    fetch(`/api/contacts/${contact.id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (isMounted && data) setFullContact(data) })
      .catch(() => {})
    return () => { isMounted = false }
  }, [contact.id])

  const properties = fullContact?.properties ?? []
  const c = fullContact || contact

  const activeProp = (properties.length > 0 && properties[selectedPropertyIndex]) ? properties[selectedPropertyIndex] : {
    address: c.propertyAddress || '',
    city: c.city || '',
    state: c.state || '',
    county: c.propertyCounty || '',
    propertyType: c.propertyType || '',
    bedrooms: c.bedrooms ?? null,
    totalBathrooms: (typeof c.totalBathrooms === 'number' ? c.totalBathrooms : (c.totalBathrooms ? Number(c.totalBathrooms) : null)),
    buildingSqft: c.buildingSqft ?? null,
    effectiveYearBuilt: c.effectiveYearBuilt ?? null,
    estValue: (typeof c.estValue === 'number' ? c.estValue : (c.estValue ? Number(c.estValue) : null)),
    estEquity: (typeof c.estEquity === 'number' ? c.estEquity : (c.estEquity ? Number(c.estEquity) : null)),
  }
  const activeDebtOwed = (activeProp.estValue != null && activeProp.estEquity != null)
    ? (activeProp.estValue - activeProp.estEquity)
    : (c.debtOwed ?? null)


  const handleUpdateContact = async (id: string, updates: Partial<Contact>) => {
    const updated = await updateContact(id, updates)
    if (updated) setFullContact(updated as any)
    setShowEditDialog(false)
  }

  const getTagInfo = (tagId: string) => {
    return tags.find((tag) => tag.id === tagId)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const headerHeight = 80 // Reduced header height
    const availableHeight = rect.height - headerHeight
    const mouseY = e.clientY - rect.top - headerHeight

    const newTopPanelHeight = Math.min(Math.max((mouseY / availableHeight) * 100, 20), 80)
    setTopPanelHeight(newTopPanelHeight)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white">
      {/* Compact Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
              <ArrowLeft size={18} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                {c.firstName?.[0]}{c.lastName?.[0]}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {c.firstName} {c.lastName}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={c.dealStatus === 'closed' ? 'default' : c.dealStatus === 'negotiating' ? 'secondary' : 'outline'} className="capitalize text-xs h-5">
                    {c.dealStatus?.replace('_', ' ') || 'Lead'}
                  </Badge>
                  {c.dnc && (
                    <Badge variant="destructive" className="flex items-center gap-1 text-xs h-5">
                      <AlertCircle className="h-3 w-3" />
                      DNC
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowEditDialog(true)} size="sm" className="flex items-center gap-2">
            <Edit size={14} />
            Edit
          </Button>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Top Row - Contact Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Contact Information Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <User className="h-4 w-4 text-blue-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.llcName && (
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">Company</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{c.llcName}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Phone</p>
                    {c.phone1 && <p className="text-sm font-medium text-gray-900">{formatPhoneNumberForDisplay(c.phone1)}</p>}
                    {c.phone2 && <p className="text-xs text-gray-600">{formatPhoneNumberForDisplay(c.phone2)}</p>}
                    {c.phone3 && <p className="text-xs text-gray-600">{formatPhoneNumberForDisplay(c.phone3)}</p>}
                    {!c.phone1 && <p className="text-sm text-gray-400">No phone</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Email</p>
                    {c.email1 && <p className="text-sm font-medium text-gray-900 truncate">{c.email1}</p>}
                    {c.email2 && <p className="text-xs text-gray-600 truncate">{c.email2}</p>}
                    {c.email3 && <p className="text-xs text-gray-600 truncate">{c.email3}</p>}
                    {!c.email1 && <p className="text-sm text-gray-400">No email</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Mailing Address</p>
                    {c.contactAddress ? (
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{c.contactAddress}</p>
                    ) : (
                      <p className="text-sm text-gray-400">No address</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Property Details Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                    <Home className="h-4 w-4 text-green-600" />
                    Property Details
                  </CardTitle>
                  {properties.length > 1 && (
                    <Badge variant="secondary" className="text-xs">{selectedPropertyIndex + 1} of {properties.length}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Property Address</p>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{activeProp.address || '—'}</p>
                    <p className="text-xs text-gray-600">{[activeProp.city, activeProp.state, activeProp.county].filter(Boolean).join(', ') || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="text-sm font-bold text-gray-900">{normalizePropertyType(activeProp.propertyType) || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Beds</p>
                    <p className="text-sm font-bold text-gray-900">{activeProp.bedrooms ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Baths</p>
                    <p className="text-sm font-bold text-gray-900">{activeProp.totalBathrooms ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Sq Ft</p>
                    <p className="text-sm font-bold text-gray-900">{activeProp.buildingSqft ? activeProp.buildingSqft.toLocaleString() : '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Year Built</p>
                    <p className="text-sm font-bold text-gray-900">{activeProp.effectiveYearBuilt ?? '—'}</p>
                  </div>
                </div>
                {properties.length > 1 && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPropertyIndex(Math.max(0, selectedPropertyIndex - 1))}
                      disabled={selectedPropertyIndex === 0}
                    >
                      ← Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPropertyIndex(Math.min(properties.length - 1, selectedPropertyIndex + 1))}
                      disabled={selectedPropertyIndex === properties.length - 1}
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial Information Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium mb-1">Property Value</p>
                  <p className="text-lg font-bold text-blue-700">
                    {activeProp.estValue ? `$${activeProp.estValue.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <p className="text-xs text-red-600 font-medium mb-1">Debt Owed</p>
                  <p className="text-lg font-bold text-red-700">
                    {activeDebtOwed != null ? `$${activeDebtOwed.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Equity</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {activeProp.estEquity != null ? `$${activeProp.estEquity.toLocaleString()}` : '—'}
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* All Properties Section */}
          {properties.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <Home className="h-4 w-4 text-green-600" />
                  Properties Owned ({properties.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {properties.map((prop: any, idx: number) => (
                    <div
                      key={prop.id || idx}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPropertyIndex === idx
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPropertyIndex(idx)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{prop.address || '—'}</p>
                          <p className="text-xs text-gray-600">{[prop.city, prop.state].filter(Boolean).join(', ') || '—'}</p>
                          {prop.llcName && (
                            <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {prop.llcName}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2 text-xs text-gray-600">
                            <span>{prop.bedrooms ?? '—'} bed</span>
                            <span>•</span>
                            <span>{prop.totalBathrooms ?? '—'} bath</span>
                            <span>•</span>
                            <span>{normalizePropertyType(prop.propertyType) || '—'}</span>
                          </div>
                          {prop.estValue && (
                            <div className="mt-1 text-xs">
                              <span className="text-green-600 font-medium">
                                ${prop.estValue.toLocaleString()}
                              </span>
                              {prop.estEquity && (
                                <span className="text-gray-500 ml-2">
                                  (Equity: ${prop.estEquity.toLocaleString()})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {selectedPropertyIndex === idx && (
                          <Badge variant="default" className="ml-2 flex-shrink-0">Active</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Custom Fields Section */}
          <CustomFieldsDisplay contact={c} />

          {/* Tags Row - Inline Editor */}
          <Card className="shadow-sm">
            <CardContent className="py-3">
              <InlineTagEditor
                contactId={c.id}
                initialTags={c.tags || []}
                onTagsChange={(newTags) => {
                  // Update local state
                  setFullContact(prev => prev ? { ...prev, tags: newTags } : null);
                }}
              />
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <Card className="shadow-sm">
            <Tabs defaultValue="timeline" className="w-full">
              <CardHeader className="pb-2">
                <TabsList className="grid w-full grid-cols-8 h-9">
                  <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
                  <TabsTrigger value="activities" className="text-xs">Activities</TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
                  <TabsTrigger value="calls" className="text-xs">Calls</TabsTrigger>
                  <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
                  <TabsTrigger value="emails" className="text-xs">Emails</TabsTrigger>
                  <TabsTrigger value="scheduled" className="text-xs">Scheduled</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <TabsContent value="timeline" className="mt-0 p-4">
                    <ContactTimeline contactId={contact.id} />
                  </TabsContent>

                  <TabsContent value="notes" className="mt-0 p-4">
                    <ContactNotes contact={contact} />
                  </TabsContent>

                  <TabsContent value="activities" className="mt-0 p-4">
                    <ContactActivities contactId={contact.id} />
                  </TabsContent>

                  <TabsContent value="tasks" className="mt-0 p-4">
                    <TaskDashboard contactId={contact.id} />
                  </TabsContent>

                  <TabsContent value="calls" className="mt-0 p-4">
                    <ContactCalls contactId={contact.id} />
                  </TabsContent>

                  <TabsContent value="messages" className="mt-0 p-4">
                    <ContactMessages contactId={contact.id} />
                  </TabsContent>

                  <TabsContent value="emails" className="mt-0 p-4">
                    <ContactEmails contactId={contact.id} />
                  </TabsContent>

                  <TabsContent value="scheduled" className="mt-0 p-4">
                    <ContactScheduledMessages contactId={contact.id} />
                  </TabsContent>
                </div>
              </CardContent>
            </Tabs>
          </Card>

        </div>
      </div>

      {/* Edit Contact Dialog */}
      <EditContactDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        contact={contact}
        onUpdate={handleUpdateContact}
      />
    </div>
  )
}
