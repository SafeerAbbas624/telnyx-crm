"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Search, User, Phone, Mail, MapPin, Building, Eye, Plus, MessageSquare } from "lucide-react"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import ContactName from "@/components/contacts/contact-name"

import ContactDetails from "@/components/contacts/contact-details"
import AddContactDialog from "@/components/contacts/add-contact-dialog"
import { normalizePropertyType } from "@/lib/property-type-mapper"
import { useEmailUI } from "@/lib/context/email-ui-context"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useMakeCall } from "@/hooks/use-make-call"
import { CallButtonWithCellHover } from "@/components/ui/call-button-with-cell-hover"

interface Contact {
  id: string
  firstName: string
  lastName: string
  phone1?: string
  phone2?: string
  phone3?: string
  email1?: string
  email2?: string
  email3?: string
  llcName?: string
  propertyAddress?: string
  contactAddress?: string
  city?: string
  state?: string
  zipCode?: string
  propertyType?: string
  estValue?: number
  estEquity?: number
  tags?: { id: string; name: string; color: string }[]
  createdAt: string
  updatedAt: string
}

export default function TeamContacts() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { openEmail } = useEmailUI()
  const { openSms } = useSmsUI()
  const { makeCall } = useMakeCall()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Pagination state
  const [contactsPage, setContactsPage] = useState(1)
  const [contactsHasMore, setContactsHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Team members only see their assigned contacts via the API

  useEffect(() => {
    if (session?.user) {
      // Reset and load from page 1 when search changes
      setContacts([])
      setContactsPage(1)
      setContactsHasMore(true)
      loadContacts(true)
    }
  }, [session, searchQuery])

  // Scroll handler for infinite scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop
      const scrollHeight = scrollContainer.scrollHeight
      const clientHeight = scrollContainer.clientHeight

      // Load more when scrolled near bottom (within 200px)
      if (scrollHeight - scrollTop - clientHeight < 200 && contactsHasMore && !isLoadingMore && !searchQuery) {
        loadContacts(false)
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [contactsHasMore, isLoadingMore, searchQuery, contactsPage])

  const loadContacts = async (reset: boolean = false) => {
    if (!session?.user) return
    if (isLoadingMore) return

    const loading = reset ? setIsLoading : setIsLoadingMore
    loading(true)

    try {
      const page = reset ? 1 : contactsPage
      const limit = 100

      // Use team assigned contacts API
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await fetch(`/api/team/assigned-contacts?${params}`)
      if (response.ok) {
        const data = await response.json()
        const newContacts = data.contacts || []

        console.log(`Team contacts loaded (page ${page}):`, newContacts.length)

        if (reset) {
          setContacts(newContacts)
          setContactsPage(1)
        } else {
          setContacts(prev => [...prev, ...newContacts])
        }

        // Check if there are more pages
        setContactsHasMore(data.pagination?.hasMore || false)
        setContactsPage(page + 1)
      } else {
        console.error('Failed to load assigned contacts')
      }
    } catch (error) {
      console.error('Error loading assigned contacts:', error)
      toast({
        title: "Error",
        description: "Failed to load assigned contacts",
        variant: "destructive",
      })
    } finally {
      loading(false)
    }
  }

  // No need for client-side filtering since API handles search
  const filteredContacts = Array.isArray(contacts) ? contacts : []

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A"
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // The API will handle filtering by assigned contacts automatically
  // No need to check assignedContactIds here since the API does the filtering

  return (
    <div className="space-y-4">
      {/* Search + Add Contact */}
      <div className="flex gap-2 items-start">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search contacts..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowAddDialog(true)}
          title="Add new contact"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>


      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Assigned Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={scrollContainerRef}
            className="h-[600px] overflow-y-auto overflow-x-hidden"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="pb-40">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading contacts...</p>
                </div>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Contacts Found</h3>
                <p className="text-muted-foreground text-center">
                  {searchQuery ? "No contacts match your search." : "No contacts have been assigned to you yet."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedContact?.id === contact.id ? "bg-blue-50 border-r-2 border-blue-500" : ""
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-sm">
                          {(contact.firstName?.[0] || '?')}{(contact.lastName?.[0] || '?')}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-base">
                              <ContactName contact={contact as any} clickMode="none" stopPropagation={false} />
                            </p>
                            {contact.llcName && (
                              <p className="text-sm text-muted-foreground">
                                {contact.llcName}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {contact.phone1 && (
                              <>
                                <CallButtonWithCellHover
                                  phoneNumber={contact.phone1}
                                  contactId={contact.id}
                                  contactName={`${contact.firstName || ''} ${contact.lastName || ''}`.trim()}
                                  onWebRTCCall={() => makeCall({
                                    phoneNumber: contact.phone1!,
                                    contactId: contact.id,
                                    contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                                  })}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  iconClassName="h-4 w-4"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openSms({ phoneNumber: contact.phone1!, contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } })
                                  }}
                                  title="Send SMS"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {contact.email1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEmail({ email: contact.email1!, contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } })
                                }}
                                title="Send Email"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedContact(contact)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {contact.phone1 && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{contact.phone1}</span>
                            </div>
                          )}

                          {contact.email1 && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{contact.email1}</span>
                            </div>
                          )}

                          {contact.propertyAddress && (
                            <div className="flex items-center gap-2 md:col-span-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">
                                {contact.propertyAddress}
                                {contact.city && `, ${contact.city}`}
                                {contact.state && `, ${contact.state}`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {contact.propertyType && (
                            <Badge variant="outline" className="text-xs">
                              {normalizePropertyType(contact.propertyType)}
                            </Badge>
                          )}
                          {contact.estValue && (
                            <Badge variant="secondary" className="text-xs">
                              Est. Value: {formatCurrency(contact.estValue)}
                            </Badge>
                          )}
                          {contact.estEquity && (
                            <Badge variant="secondary" className="text-xs">
                              Est. Equity: {formatCurrency(contact.estEquity)}
                            </Badge>
                          )}
                          {Array.isArray(contact.tags) && contact.tags.length > 0 && contact.tags.slice(0, 5).map((t) => (
                            <Badge key={t.id} style={{ backgroundColor: t.color || '#3B82F6', color: '#fff' }} className="text-xs">
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoadingMore && (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                  </div>
                )}

                {/* End of list indicator */}
                {!contactsHasMore && filteredContacts.length > 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    All contacts loaded ({filteredContacts.length})
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Contact Details */}
      {selectedContact && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                <ContactName contact={selectedContact as any} clickMode="none" stopPropagation={false} />
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  window.location.href = `/contacts/${selectedContact.id}`
                }}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Profile
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedContact.phone1 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedContact.phone1}</span>
                      </div>
                    )}
                    {selectedContact.email1 && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedContact.email1}</span>
                      </div>
                    )}
                    {selectedContact.llcName && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedContact.llcName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedContact.propertyAddress && (
                  <div>
                    <h4 className="font-medium mb-2">Property Address</h4>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p>{selectedContact.propertyAddress}</p>
                        {(selectedContact.city || selectedContact.state || selectedContact.zipCode) && (
                          <p className="text-muted-foreground">
                            {selectedContact.city && selectedContact.city}
                            {selectedContact.state && `, ${selectedContact.state}`}
                            {selectedContact.zipCode && ` ${selectedContact.zipCode}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {(selectedContact.propertyType || selectedContact.estValue || selectedContact.estEquity) && (
                  <div>
                    <h4 className="font-medium mb-2">Property Details</h4>
                    <div className="space-y-2 text-sm">
                      {selectedContact.propertyType && (
                        <p><span className="text-muted-foreground">Type:</span> {normalizePropertyType(selectedContact.propertyType)}</p>
                      )}
                      {selectedContact.estValue && (
                        <p><span className="text-muted-foreground">Est. Value:</span> {formatCurrency(selectedContact.estValue)}</p>
                      )}
                      {selectedContact.estEquity && (
                        <p><span className="text-muted-foreground">Est. Equity:</span> {formatCurrency(selectedContact.estEquity)}</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Additional Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Added:</span> {new Date(selectedContact.createdAt).toLocaleDateString()}</p>
                    <p><span className="text-muted-foreground">Updated:</span> {new Date(selectedContact.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
      {/* Contact Details Drawer */}
      <Sheet modal={false} open={!!selectedContact} onOpenChange={(open) => { if (!open) setSelectedContact(null) }}>
        <SheetContent
          side="right"
          className="w-[80vw] sm:max-w-[900px] lg:max-w-[1100px] p-0"
          overlayClassName="bg-transparent backdrop-blur-0 pointer-events-none"
        >
          {selectedContact && (
            <ContactDetails contact={selectedContact as any} onBack={() => setSelectedContact(null)} />
          )}
        </SheetContent>
      </Sheet>

          </CardContent>
        </Card>
      )}

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAddContact={async (payload) => {
          try {
            const res = await fetch('/api/contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(err?.error || 'Failed to add contact')
            }
            toast({ title: 'Contact added', description: 'The contact has been created and assigned to you.' })
            setShowAddDialog(false)
            loadContacts()
          } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Failed to add contact', variant: 'destructive' })
          }
        }}
      />
    </div>
  )
}
