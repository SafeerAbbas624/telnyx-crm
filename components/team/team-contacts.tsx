"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Search, User, Phone, Mail, MapPin, Building, Eye } from "lucide-react"

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
  createdAt: string
  updatedAt: string
}

export default function TeamContacts() {
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  // Team members only see their assigned contacts via the API

  useEffect(() => {
    if (session?.user) {
      loadContacts()
    }
  }, [session, searchQuery])

  const loadContacts = async () => {
    if (!session?.user) return

    setIsLoading(true)
    try {
      // Use team assigned contacts API
      const params = new URLSearchParams()
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await fetch(`/api/team/assigned-contacts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
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
      setIsLoading(false)
    }
  }

  // Filter contacts based on search query (with safety check)
  const filteredContacts = Array.isArray(contacts) ? contacts.filter(contact => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      contact.firstName?.toLowerCase().includes(query) ||
      contact.lastName?.toLowerCase().includes(query) ||
      contact.phone1?.includes(query) ||
      contact.email1?.toLowerCase().includes(query) ||
      contact.llcName?.toLowerCase().includes(query) ||
      contact.propertyAddress?.toLowerCase().includes(query) ||
      contact.city?.toLowerCase().includes(query)
    )
  }) : []

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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search contacts..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Contact Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Contacts</p>
                <p className="text-2xl font-bold">{Array.isArray(contacts) ? contacts.length : 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">With LLC</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(contacts) ? contacts.filter(c => c.llcName).length : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">With Email</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(contacts) ? contacts.filter(c => c.email1).length : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
          <ScrollArea className="h-[600px]">
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
                          {contact.firstName?.[0]}{contact.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-base">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.llcName && (
                              <p className="text-sm text-muted-foreground">
                                {contact.llcName}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `/contacts/${contact.id}`
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
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
                        
                        <div className="flex items-center gap-2 mt-3">
                          {contact.propertyType && (
                            <Badge variant="outline" className="text-xs">
                              {contact.propertyType}
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
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Selected Contact Details */}
      {selectedContact && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {selectedContact.firstName} {selectedContact.lastName}
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
                        <p><span className="text-muted-foreground">Type:</span> {selectedContact.propertyType}</p>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
