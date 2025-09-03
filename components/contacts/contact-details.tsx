"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, Phone, Mail, MapPin, DollarSign, Home, GripHorizontal } from "lucide-react"
import type { Contact } from "@/lib/types"
import { ContactNotes } from "./contact-notes"
import ContactActivities from "./contact-activities"
import ContactCalls from "./contact-calls"
import ContactMessages from "./contact-messages"
import ContactEmails from "./contact-emails"
import ContactTimeline from "./contact-timeline"
import EditContactDialog from "./edit-contact-dialog"
import { useContacts } from "@/lib/context/contacts-context"

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



  const handleUpdateContact = (id: string, updates: Partial<Contact>) => {
    updateContact(id, updates)
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
                {contact.firstName} {contact.lastName}
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
          className="overflow-y-auto p-6 bg-white"
          style={{ height: `${topPanelHeight}%` }}
        >


          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">First Name</p>
              <p className="text-gray-900 font-medium">{contact.firstName || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Last Name</p>
              <p className="text-gray-900 font-medium">{contact.lastName || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">LLC Name</p>
              <p className="text-gray-900 font-medium">{contact.llcName || '—'}</p>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Phone 1</p>
              <p className="text-gray-900 font-medium">{contact.phone1 || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Phone 2</p>
              <p className="text-gray-900 font-medium">{contact.phone2 || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Phone 3</p>
              <p className="text-gray-900 font-medium">{contact.phone3 || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Email 1</p>
              <p className="text-gray-900 font-medium">{contact.email1 || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Email 2</p>
              <p className="text-gray-900 font-medium">{contact.email2 || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Email 3</p>
              <p className="text-gray-900 font-medium">{contact.email3 || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Contact Address</p>
              <p className="text-gray-900 font-medium">{contact.contactAddress || '—'}</p>
            </div>
          </div>

          {/* Property Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Property Address</p>
              <p className="text-gray-900 font-medium">{contact.propertyAddress || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">City</p>
              <p className="text-gray-900 font-medium">{contact.city || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">State</p>
              <p className="text-gray-900 font-medium">{contact.state || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">County</p>
              <p className="text-gray-900 font-medium">{contact.propertyCounty || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Property Type</p>
              <p className="text-gray-900 font-medium">{contact.propertyType || '—'}</p>
            </div>
          </div>

          {/* Property Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Bedrooms</p>
              <p className="text-gray-900 font-medium">{contact.bedrooms || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Bathrooms</p>
              <p className="text-gray-900 font-medium">{contact.totalBathrooms || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Square Feet</p>
              <p className="text-gray-900 font-medium">{contact.buildingSqft ? contact.buildingSqft.toLocaleString() : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Year Built</p>
              <p className="text-gray-900 font-medium">{contact.effectiveYearBuilt || '—'}</p>
            </div>
          </div>

          {/* Financial Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Estimated Value</p>
              <p className="text-gray-900 font-medium">{contact.estValue ? `$${Number(contact.estValue).toLocaleString()}` : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Debt Owed</p>
              <p className="text-gray-900 font-medium">{contact.debtOwed ? `$${Number(contact.debtOwed).toLocaleString()}` : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Estimated Equity</p>
              <p className="text-gray-900 font-medium">{contact.estEquity ? `$${Number(contact.estEquity).toLocaleString()}` : '—'}</p>
            </div>
          </div>

          {/* Status Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Deal Status</p>
              <p className="text-gray-900 font-medium capitalize">{contact.dealStatus ? contact.dealStatus.replace('_', ' ') : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Do Not Call</p>
              <p className="text-gray-900 font-medium">{contact.dnc !== undefined ? (contact.dnc ? 'Yes' : 'No') : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">DNC Reason</p>
              <p className="text-gray-900 font-medium">{contact.dncReason || '—'}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Notes</p>
            <p className="text-gray-900">{contact.notes || '—'}</p>
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag) => {
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
