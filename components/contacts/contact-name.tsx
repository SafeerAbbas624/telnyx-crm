"use client"

import React, { useMemo } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Home, DollarSign } from "lucide-react"

import type { Contact } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"
import { useContactPanel } from "@/lib/context/contact-panel-context"
import { cn } from "@/lib/utils"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"

export interface ContactNameProps {
  contactId?: string
  contact?: Contact
  name?: string
  className?: string
  /** Stop event bubbling so parent row/card clicks don't also fire */
  stopPropagation?: boolean
  /** What to do on click: none (let parent handle), panel (new side panel - default) */
  clickMode?: 'none' | 'popup' | 'drawer' | 'panel'
}

export default function ContactName({ contactId, contact: contactProp, name, className, stopPropagation = true, clickMode = 'panel' }: ContactNameProps) {
  const { getContactById } = useContacts()
  const { openContactPanel } = useContactPanel()

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

  const idToFetch = contactProp?.id || contactId || contactFromContext?.id

  const onClick = (e: React.MouseEvent) => {
    if (clickMode === 'none') {
      // Let parent handlers run as normal
      return
    }
    if (stopPropagation) {
      e.preventDefault()
      e.stopPropagation()
    }
    // Open the new side panel for all click modes (panel, popup, drawer)
    if (idToFetch) {
      openContactPanel(idToFetch)
    }
  }

  return (
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
      <HoverCardContent align="start" className="w-[340px] p-0 overflow-hidden">
        {contactFromContext ? (
          <div className="bg-white">
            {/* Header */}
            <div className="p-4 pb-3 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {contactFromContext.firstName?.[0] || ''}{contactFromContext.lastName?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{displayName}</div>
                  {contactFromContext.dealStatus && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {contactFromContext.dealStatus}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="p-3 space-y-2">
              {contactFromContext.phone1 && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{formatPhoneNumberForDisplay(contactFromContext.phone1)}</span>
                </div>
              )}
              {contactFromContext.email1 && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate">{contactFromContext.email1}</span>
                </div>
              )}
              {contactFromContext.propertyAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <Home className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-foreground line-clamp-2">{contactFromContext.propertyAddress}</span>
                </div>
              )}
              {contactFromContext.propertyValue && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-medium">${contactFromContext.propertyValue.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 bg-muted/50 border-t">
              <p className="text-xs text-muted-foreground text-center">Click name to view full details</p>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            Hover to preview. Click to load full details…
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

