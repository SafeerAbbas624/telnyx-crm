"use client"

import React, { useEffect, useMemo, useState } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Home, DollarSign, Building2 } from "lucide-react"

import ContactDetails from "@/components/contacts/contact-details"
import type { Contact } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"
import { cn } from "@/lib/utils"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"

export interface ContactNameProps {
  contactId?: string
  contact?: Contact
  name?: string
  className?: string
  /** Stop event bubbling so parent row/card clicks don't also fire */
  stopPropagation?: boolean
  /** What to do on click: none (let parent handle), popup (dialog), drawer (sheet) */
  clickMode?: 'none' | 'popup' | 'drawer'
}

export default function ContactName({ contactId, contact: contactProp, name, className, stopPropagation = true, clickMode = 'popup' }: ContactNameProps) {
  const { getContactById } = useContacts()

  const contactFromContext = useMemo(() => {
    if (contactProp) return contactProp
    if (contactId) return getContactById(contactId)
    return undefined
  }, [contactProp, contactId, getContactById])

  const displayName = useMemo(() => {
    if (name && name.trim()) return name
    if (contactFromContext) return `${contactFromContext.firstName || ''} ${contactFromContext.lastName || ''}`.trim() || 'Unnamed Contact'
    return 'Contact'
  }, [name, contactFromContext])

  const [open, setOpen] = useState(false)
  const [fullContact, setFullContact] = useState<Contact | null>(contactFromContext || null)
  const [loading, setLoading] = useState(false)
  const idToFetch = contactProp?.id || contactId || contactFromContext?.id

  // Ensure we show the correct contact when the target changes (e.g., selecting another conversation)
  useEffect(() => {
    if (!idToFetch) {
      setFullContact(null)
      return
    }
    // If the cached contact is for a different id, reset/sync to the current basic contact data
    setFullContact((prev) => {
      if (prev && prev.id === idToFetch) return prev
      return contactProp || contactFromContext || null
    })
  }, [idToFetch, contactProp, contactFromContext])

  // Load contact details when opening popup/drawer if not already available for this contact
  useEffect(() => {
    if (!open) return
    if (!idToFetch) return
    if (fullContact && fullContact.id === idToFetch) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/contacts/${idToFetch}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load contact")
        const data = await r.json()
        if (!cancelled) setFullContact(data)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, idToFetch, fullContact])

  const onClick = (e: React.MouseEvent) => {
    if (clickMode === 'none') {
      // Let parent handlers run as normal
      return
    }
    if (stopPropagation) {
      e.preventDefault()
      e.stopPropagation()
    }
    setOpen(true)
  }

  return (
    <>
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className={cn("inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus:outline-none font-medium", className)}
            onClick={onClick}
            title={displayName}
          >
            {displayName}
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-[360px] p-0 overflow-hidden border-none shadow-lg">
          {contactFromContext ? (
            <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50">
              {/* Header with Avatar */}
              <div className="p-4 pb-3 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                    <AvatarFallback className="bg-white text-blue-600 font-semibold text-base">
                      {contactFromContext.firstName?.[0] || ''}{contactFromContext.lastName?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-base truncate">{displayName}</div>
                    {contactFromContext.dealStatus && (
                      <Badge variant="secondary" className="mt-1 bg-white/20 text-white border-white/30 text-xs">
                        {contactFromContext.dealStatus}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="p-4 space-y-2.5 bg-white/80 backdrop-blur-sm">
                {contactFromContext.phone1 && (
                  <div className="flex items-center gap-2.5 text-sm group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-gray-700 font-medium">{formatPhoneNumberForDisplay(contactFromContext.phone1)}</span>
                  </div>
                )}
                {contactFromContext.email1 && (
                  <div className="flex items-center gap-2.5 text-sm group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <Mail className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700 truncate">{contactFromContext.email1}</span>
                  </div>
                )}
                {contactFromContext.propertyAddress && (
                  <div className="flex items-start gap-2.5 text-sm group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Home className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-gray-700 line-clamp-2">{contactFromContext.propertyAddress}</span>
                  </div>
                )}
                {contactFromContext.propertyValue && (
                  <div className="flex items-center gap-2.5 text-sm group">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-gray-700 font-medium">${contactFromContext.propertyValue.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">Click name to view full details</p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground bg-white">
              Hover to preview. Click to load full details…
            </div>
          )}
        </HoverCardContent>
      </HoverCard>

      {clickMode === 'drawer' ? (
        <Sheet modal={false} open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-[80vw] sm:max-w-[900px] lg:max-w-[1100px] p-0"
            overlayClassName="bg-transparent backdrop-blur-0 pointer-events-none"
          >
            {fullContact ? (
              <ContactDetails contact={fullContact} onBack={() => setOpen(false)} />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">{loading ? 'Loading…' : 'Contact not found.'}</div>
            )}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[95vw] w-[1200px] p-0 max-h-[90vh] overflow-hidden gap-0 bg-gradient-to-br from-gray-50 to-white">
            <div className="h-[90vh] overflow-auto">
              {fullContact ? (
                <ContactDetails contact={fullContact} onBack={() => setOpen(false)} />
              ) : (
                <div className="p-8 text-center">
                  {loading ? (
                    <div className="space-y-3">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 animate-pulse">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <p className="text-sm text-muted-foreground">Loading contact details...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                        <span className="text-red-600 text-xl">!</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Contact not found.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

