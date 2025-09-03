"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, User, Phone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useContacts } from "@/lib/context/contacts-context"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"
import type { Contact } from "@/lib/types"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  state?: string
  isActive: boolean
}

interface NewTextMessageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMessageSent?: () => void
}

export default function NewTextMessageModal({ 
  open, 
  onOpenChange, 
  onMessageSent 
}: NewTextMessageModalProps) {
  const { data: session } = useSession()
  const { contacts } = useContacts()
  const { toast } = useToast()
  
  // Form states
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [message, setMessage] = useState("")
  const [selectedSenderNumber, setSelectedSenderNumber] = useState<string>("")
  const [availableNumbers, setAvailableNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isSending, setIsSending] = useState(false)
  
  // New contact form
  const [newContactForm, setNewContactForm] = useState({
    firstName: "",
    lastName: "",
    phone1: "",
    llcName: "",
    propertyAddress: "",
    city: "",
    state: "",
  })

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'

  // Load available phone numbers
  useEffect(() => {
    if (open) {
      loadAvailableNumbers()
    }
  }, [open, session])

  const loadAvailableNumbers = async () => {
    try {
      console.log('Loading phone numbers...') // Debug log
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        console.log('Phone numbers response:', data) // Debug log

        // The API returns phone numbers directly as an array, not nested in phoneNumbers
        const phoneNumbers = Array.isArray(data) ? data : (data.phoneNumbers || [])
        console.log('Processed phone numbers:', phoneNumbers) // Debug log

        // Transform the data to match our interface
        const formattedNumbers = phoneNumbers.map((num: any) => ({
          id: num.id,
          phoneNumber: num.phoneNumber || num.number,
          state: num.state,
          isActive: num.isActive !== false, // Default to true if not specified
        }))

        setAvailableNumbers(formattedNumbers)

        // Auto-select sender number based on user role
        if (formattedNumbers.length > 0) {
          if (isAdmin) {
            // Admin can use any number - select first active one
            const activeNumber = formattedNumbers.find((num: TelnyxPhoneNumber) => num.isActive)
            if (activeNumber) {
              setSelectedSenderNumber(activeNumber.phoneNumber)
            }
          } else {
            // Team member - auto-select assigned number
            const assignedNumber = session?.user?.assignedPhoneNumber
            if (assignedNumber && formattedNumbers.find((num: TelnyxPhoneNumber) => num.phoneNumber === assignedNumber)) {
              setSelectedSenderNumber(assignedNumber)
            }
          }
        }
      } else {
        console.error('Failed to load phone numbers:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    }
  }

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      contact.firstName?.toLowerCase().includes(query) ||
      contact.lastName?.toLowerCase().includes(query) ||
      contact.phone1?.includes(query) ||
      contact.propertyAddress?.toLowerCase().includes(query)
    )
  })

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedSenderNumber) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    let targetContact: Contact | null = null

    if (activeTab === "existing") {
      if (!selectedContact) {
        toast({
          title: "Error",
          description: "Please select a contact",
          variant: "destructive",
        })
        return
      }
      targetContact = selectedContact
    } else {
      // Create new contact
      if (!newContactForm.firstName || !newContactForm.phone1) {
        toast({
          title: "Error",
          description: "Please fill in name and phone number",
          variant: "destructive",
        })
        return
      }

      try {
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: newContactForm.firstName.trim(),
            lastName: newContactForm.lastName.trim(),
            phone1: newContactForm.phone1.trim(),
            llcName: newContactForm.llcName.trim() || null,
            propertyAddress: newContactForm.propertyAddress.trim() || null,
            city: newContactForm.city.trim() || null,
            state: newContactForm.state.trim() || null,
          }),
        })

        if (response.ok) {
          const newContact = await response.json()
          targetContact = newContact.contact
        } else {
          throw new Error('Failed to create contact')
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to create contact",
          variant: "destructive",
        })
        return
      }
    }

    // Send message
    setIsSending(true)
    try {
      const response = await fetch('/api/telnyx/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber: selectedSenderNumber,
          toNumber: targetContact.phone1 || targetContact.phone2 || targetContact.phone3,
          message: message.trim(),
          contactId: targetContact.id,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Message sent successfully",
        })
        
        // Reset form
        setMessage("")
        setSelectedContact(null)
        setSearchQuery("")
        setNewContactForm({
          firstName: "",
          lastName: "",
          phone1: "",
          llcName: "",
          propertyAddress: "",
          city: "",
          state: "",
        })
        
        onMessageSent?.()
        onOpenChange(false)
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Send New Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Sender Number Selection */}
          <div className="space-y-2">
            <Label>Send From</Label>
            {availableNumbers.length === 0 && (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="font-medium">No phone numbers available</p>
                <p className="text-xs mt-1">Please contact your administrator to set up Telnyx phone numbers for SMS messaging.</p>
              </div>
            )}
            <Select
              value={selectedSenderNumber}
              onValueChange={setSelectedSenderNumber}
              disabled={(!isAdmin && !!session?.user?.assignedPhoneNumber) || availableNumbers.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={availableNumbers.length === 0 ? "No phone numbers available" : "Select sender number"} />
              </SelectTrigger>
              <SelectContent>
                {availableNumbers.length > 0 ? (
                  availableNumbers.map((number) => (
                    <SelectItem key={number.id} value={number.phoneNumber}>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{formatPhoneNumberForDisplay(number.phoneNumber)}</span>
                        {number.state && <span className="text-xs text-muted-foreground">({number.state})</span>}
                        {!isAdmin && number.phoneNumber === session?.user?.assignedPhoneNumber && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Assigned</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-numbers" disabled>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>No phone numbers available</span>
                    </div>
                  </SelectItem>
                )}}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Selection Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "existing" | "new")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Existing Contact</TabsTrigger>
              <TabsTrigger value="new">New Contact</TabsTrigger>
            </TabsList>
            
            <TabsContent value="existing" className="space-y-3">
              <div className="space-y-2">
                <Label>Search Contacts</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search by name, phone, or address..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${
                        selectedContact?.id === contact.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {contact.firstName?.[0]}{contact.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneNumberForDisplay(contact.phone1 || "")}
                          </p>
                          {contact.propertyAddress && (
                            <p className="text-xs text-muted-foreground truncate">
                              {contact.propertyAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredContacts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No contacts found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="new" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="John"
                    value={newContactForm.firstName}
                    onChange={(e) => setNewContactForm(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    placeholder="Doe"
                    value={newContactForm.lastName}
                    onChange={(e) => setNewContactForm(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={newContactForm.phone1}
                  onChange={(e) => setNewContactForm(prev => ({ ...prev, phone1: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>LLC Name</Label>
                <Input
                  placeholder="Property Holdings LLC"
                  value={newContactForm.llcName}
                  onChange={(e) => setNewContactForm(prev => ({ ...prev, llcName: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Property Address</Label>
                <Input
                  placeholder="123 Main St, City, State"
                  value={newContactForm.propertyAddress}
                  onChange={(e) => setNewContactForm(prev => ({ ...prev, propertyAddress: e.target.value }))}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={isSending || !message.trim() || !selectedSenderNumber || availableNumbers.length === 0}
          >
            {isSending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
