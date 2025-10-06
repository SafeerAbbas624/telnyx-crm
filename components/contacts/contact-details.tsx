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
import EditContactDialog from "./edit-contact-dialog"
import { useContacts } from "@/lib/context/contacts-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"

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

    <div ref={containerRef} className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="p-1.5">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {c.firstName} {c.lastName}
              </h1>
              <p className="text-sm text-gray-600">Contact Details</p>
            </div>
          </div>
          <Button onClick={() => setShowEditDialog(true)} className="flex items-center gap-2 text-sm px-3 py-1.5">
            <Edit size={14} />
            Edit Contact
          </Button>
        </div>
      </div>

      {/* Main Content - Resizable Split Layout */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Contact Details Section - Resizable Top Panel */}
        <div
          className="overflow-y-auto p-6 bg-gray-50"
          style={{ height: `${topPanelHeight}%` }}
        >
          {/* Contact Overview Card */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {c.firstName?.[0]}{c.lastName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{c.firstName} {c.lastName}</h2>
                    {c.llcName && <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><Building2 className="h-4 w-4" />{c.llcName}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={c.dealStatus === 'closed' ? 'default' : c.dealStatus === 'negotiating' ? 'secondary' : 'outline'} className="capitalize">
                        {c.dealStatus?.replace('_', ' ') || 'Lead'}
                      </Badge>
                      {c.dnc && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Do Not Call
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {c.tags && c.tags.length > 0 && (
                <div className="mb-4 pb-4 border-b">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-gray-500" />
                    {c.tags.map((tag: any) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}15`,
                          borderColor: tag.color,
                          color: tag.color
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Phone</p>
                    {c.phone1 && <p className="text-sm font-medium text-gray-900">{formatPhoneNumberForDisplay(c.phone1)}</p>}
                    {c.phone2 && <p className="text-sm text-gray-600">{formatPhoneNumberForDisplay(c.phone2)}</p>}
                    {c.phone3 && <p className="text-sm text-gray-600">{formatPhoneNumberForDisplay(c.phone3)}</p>}
                    {!c.phone1 && !c.phone2 && !c.phone3 && <p className="text-sm text-gray-400">No phone</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    {c.email1 && <p className="text-sm font-medium text-gray-900 truncate">{c.email1}</p>}
                    {c.email2 && <p className="text-sm text-gray-600 truncate">{c.email2}</p>}
                    {c.email3 && <p className="text-sm text-gray-600 truncate">{c.email3}</p>}
                    {!c.email1 && !c.email2 && !c.email3 && <p className="text-sm text-gray-400">No email</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Address</p>
                    {c.contactAddress ? (
                      <p className="text-sm font-medium text-gray-900">{c.contactAddress}</p>
                    ) : (
                      <p className="text-sm text-gray-400">No address</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Information Card */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5" />
                Property Information
              </CardTitle>
            </CardHeader>
            <CardContent>


              {/* Property Tabs (only when multiple properties) */}
              {properties.length > 1 && (
                <div className="mb-4">
                  <Tabs
                    value={`prop-${selectedPropertyIndex}`}
                    onValueChange={(v) => {
                      const idx = parseInt((v || 'prop-0').split('-')[1])
                      setSelectedPropertyIndex(Number.isFinite(idx) ? Math.max(0, idx) : 0)
                    }}
                  >
                    <TabsList className="flex flex-wrap">
                      {properties.map((p, idx) => {
                        const label = p.address || [p.city, p.state].filter(Boolean).join(', ') || `Property ${idx + 1}`
                        return (
                          <TabsTrigger key={p.id} value={`prop-${idx}`}>
                            {label}
                          </TabsTrigger>
                        )
                      })}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Property Address */}
              <div className="mb-4 pb-4 border-b">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Property Address</p>
                    <p className="text-sm font-medium text-gray-900">{activeProp.address || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-gray-900">
                      {[activeProp.city, activeProp.state, activeProp.county].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Property Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Bedrooms</p>
                  <p className="text-lg font-bold text-gray-900">{activeProp.bedrooms ?? '—'}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Bathrooms</p>
                  <p className="text-lg font-bold text-gray-900">{activeProp.totalBathrooms ?? '—'}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Sq Ft</p>
                  <p className="text-lg font-bold text-gray-900">{activeProp.buildingSqft ? activeProp.buildingSqft.toLocaleString() : '—'}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Year Built</p>
                  <p className="text-lg font-bold text-gray-900">{activeProp.effectiveYearBuilt ?? '—'}</p>
                </div>
              </div>

              {/* Property Type */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Property Type</p>
                <p className="text-sm font-medium text-gray-900">{activeProp.propertyType || '—'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Information Card */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">Estimated Value</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {activeProp.estValue != null ? `$${Number(activeProp.estValue).toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs text-red-600 font-medium mb-1">Debt Owed</p>
                  <p className="text-2xl font-bold text-red-900">
                    {activeDebtOwed != null ? `$${Number(activeDebtOwed).toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-medium mb-1">Estimated Equity</p>
                  <p className="text-2xl font-bold text-green-900">
                    {activeProp.estEquity != null ? `$${Number(activeProp.estEquity).toLocaleString()}` : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information Card */}
          {(c.notes || c.dncReason) && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {c.notes && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Notes</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{c.notes}</p>
                  </div>
                )}
                {c.dnc && c.dncReason && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">DNC Reason</p>
                    <p className="text-sm text-gray-900">{c.dncReason}</p>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <p className="mb-1">Created</p>
                    <p className="text-gray-900">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <div>
                    <p className="mb-1">Last Updated</p>
                    <p className="text-gray-900">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {c.tags && c.tags.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {c.tags.map((tag) => {
                  const tagInfo = typeof tag === 'string' ? getTagInfo(tag) : tag
                  return (
                    <Badge
                      key={typeof tag === 'string' ? tag : tag.id}
                      variant="outline"
                      className="text-gray-700 border-gray-300"
                    >
                      {tagInfo?.name || (typeof tag === 'string' ? tag : tag.name)}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Resizable Divider */}
        <div
          className={`relative h-2 bg-gray-100 border-y border-gray-200 cursor-row-resize hover:bg-gray-200 transition-colors flex items-center justify-center group ${isDragging ? 'bg-blue-200' : ''}`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-center w-12 h-1 bg-gray-400 rounded-full group-hover:bg-gray-500 transition-colors">
            <GripHorizontal size={12} className="text-gray-600" />
          </div>
        </div>

        {/* Tabs Section - Resizable Bottom Panel */}
        <div
          className="overflow-hidden bg-white"
          style={{ height: `${100 - topPanelHeight}%` }}
        >
          <Tabs defaultValue="timeline" className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 grid w-full grid-cols-6">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="calls">Calls</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="timeline" className="mt-0 h-full">
                <ContactTimeline contactId={contact.id} />
              </TabsContent>

              <TabsContent value="notes" className="mt-0 h-full">
                <ContactNotes contact={contact} />
              </TabsContent>

              <TabsContent value="activities" className="mt-0 h-full">
                <ContactActivities contactId={contact.id} />
              </TabsContent>

              <TabsContent value="calls" className="mt-0 h-full">
                <ContactCalls contactId={contact.id} />
              </TabsContent>

              <TabsContent value="messages" className="mt-0 h-full">
                <ContactMessages contactId={contact.id} />
              </TabsContent>

              <TabsContent value="emails" className="mt-0 h-full">
                <ContactEmails contactId={contact.id} />
              </TabsContent>
            </div>
          </Tabs>
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
