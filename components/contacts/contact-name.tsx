"use client"

import React, { useEffect, useMemo, useState } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Dialog, DialogContent } from "@/components/ui/dialog"

import ContactDetails from "@/components/contacts/contact-details"
import type { Contact } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"
import { cn } from "@/lib/utils"

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
            className={cn("inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus:outline-none", className)}
            onClick={onClick}
            title={displayName}
          >
            {displayName}
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-80">
          <div className="space-y-2">
            <div className="font-semibold text-foreground">{displayName}</div>
            {contactFromContext ? (
              <div className="text-sm text-muted-foreground space-y-1">
                {contactFromContext.phone1 && <div>📞 {contactFromContext.phone1}</div>}
                {contactFromContext.email1 && <div>✉️ {contactFromContext.email1}</div>}
                {contactFromContext.contactAddress && <div>🏠 {contactFromContext.contactAddress}</div>}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Hover to preview. Click to load full details…</div>
            )}
          </div>
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
          <DialogContent className="sm:max-w-2xl w-[95vw] p-0 max-h-[80vh] overflow-hidden">
            <div className="h-[80vh] overflow-auto">
              {fullContact ? (
                <ContactDetails contact={fullContact} onBack={() => setOpen(false)} />
              ) : (
                <div className="p-6 text-sm text-muted-foreground">{loading ? 'Loading…' : 'Contact not found.'}</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

