'use client'

/**
 * Multi-Line Power Dialer Script Panel
 * 
 * Shows the call script with dynamic field hydration when a call is answered.
 * Displays contact information and the script content with placeholders replaced.
 */

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  User, 
  Building2, 
  MapPin, 
  Phone,
  Tag,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import type { ActiveLeg, DialerContact } from '@/lib/dialer/types'
import { cn } from '@/lib/utils'

interface CallScript {
  id: string
  name: string
  content: string
  variables: string[]
}

interface DialerScriptPanelProps {
  script: CallScript | null
  answeredLeg: ActiveLeg | null
  onLoadScript?: (scriptId: string) => Promise<CallScript | null>
}

/**
 * Hydrate script content with contact data
 */
function hydrateScript(content: string, contact: DialerContact): string {
  const replacements: Record<string, string> = {
    '{firstName}': contact.firstName || '',
    '{lastName}': contact.lastName || '',
    '{fullName}': contact.fullName || '',
    '{phone}': contact.phone || '',
    '{phone2}': contact.phone2 || '',
    '{phone3}': contact.phone3 || '',
    '{company}': contact.llcName || '',
    '{llcName}': contact.llcName || '',
    '{propertyAddress}': contact.propertyAddress || '',
    '{city}': contact.city || '',
    '{state}': contact.state || '',
    '{zipCode}': contact.zipCode || '',
    '{address}': [contact.propertyAddress, contact.city, contact.state].filter(Boolean).join(', '),
  }

  let hydrated = content
  for (const [placeholder, value] of Object.entries(replacements)) {
    hydrated = hydrated.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'gi'), value)
  }

  return hydrated
}

function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

export function DialerScriptPanel({
  script,
  answeredLeg,
  onLoadScript
}: DialerScriptPanelProps) {
  const [copied, setCopied] = useState(false)
  const [showContactDetails, setShowContactDetails] = useState(true)

  const contact = answeredLeg?.contact

  // Hydrate script with contact data
  const hydratedContent = useMemo(() => {
    if (!script?.content || !contact) return null
    return hydrateScript(script.content, contact)
  }, [script?.content, contact])

  const handleCopyScript = async () => {
    if (!hydratedContent) return
    try {
      await navigator.clipboard.writeText(hydratedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy script:', err)
    }
  }

  // No answered call - show placeholder
  if (!answeredLeg || answeredLeg.status !== 'answered') {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full text-center p-8">
          <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Waiting for Call</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The call script will appear here when a contact answers
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col border-green-200 bg-green-50/30">
      {/* Header */}
      <CardHeader className="pb-3 border-b bg-green-100/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            <span className="text-green-800">Connected: {contact?.fullName}</span>
          </CardTitle>
          <Badge variant="default" className="bg-green-600 animate-pulse">
            LIVE
          </Badge>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Contact Details (Collapsible) */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={() => setShowContactDetails(!showContactDetails)}
            >
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Details
              </span>
              {showContactDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showContactDetails && contact && (
              <div className="bg-white rounded-lg p-3 space-y-2 text-sm border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{contact.fullName}</span>
                </div>

                {contact.llcName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.llcName}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{formatPhoneDisplay(contact.phone)}</span>
                </div>

                {contact.phone2 && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-muted-foreground text-xs">Alt:</span>
                    <span className="font-mono text-xs">{formatPhoneDisplay(contact.phone2)}</span>
                  </div>
                )}

                {contact.propertyAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {contact.propertyAddress}
                      {contact.city && `, ${contact.city}`}
                      {contact.state && `, ${contact.state}`}
                      {contact.zipCode && ` ${contact.zipCode}`}
                    </span>
                  </div>
                )}

                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {contact.tags.map(tag => (
                      <Badge key={tag.id} variant="secondary" className="text-xs">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Script Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {script?.name || 'Call Script'}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyScript}
                disabled={!hydratedContent}
              >
                {copied ? (
                  <><Check className="h-4 w-4 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-4 w-4 mr-1" /> Copy</>
                )}
              </Button>
            </div>

            {hydratedContent ? (
              <div className="bg-white rounded-lg p-4 border">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: hydratedContent }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg p-4 border text-center text-muted-foreground">
                <p>No script selected for this dialer list.</p>
                <p className="text-xs mt-1">You can add a script in the list settings.</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </Card>
  )
}

