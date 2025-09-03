import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import type { Contact } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Phone, MessageSquare, Mail, Clock } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { format, formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ContactsListProps {
  contacts: Contact[]
  onContactSelect: (contact: Contact) => void
  onEditContact: (contact: Contact) => void
  onDeleteContact: (contactId: string) => void
  selectedContacts?: string[]
  onContactSelectionChange?: (contactIds: string[]) => void
  onBulkDelete?: (contactIds: string[]) => void
}

// Real communication data fetched from APIs
const getLastCommunications = async (contactId: string) => {
  try {
    // Fetch real data from APIs
    const [callsResponse, messagesResponse, emailsResponse] = await Promise.allSettled([
      fetch(`/api/calls?contactId=${contactId}&limit=1`).then(res => res.ok ? res.json() : []),
      fetch(`/api/messages?contactId=${contactId}&limit=1`).then(res => res.ok ? res.json() : []),
      fetch(`/api/emails?contactId=${contactId}&limit=1`).then(res => res.ok ? res.json() : [])
    ])

    const calls = callsResponse.status === 'fulfilled' ? callsResponse.value : []
    const messages = messagesResponse.status === 'fulfilled' ? messagesResponse.value : []
    const emails = emailsResponse.status === 'fulfilled' ? emailsResponse.value : []

    return {
      lastCall: calls.length > 0 ? {
        date: new Date(calls[0].createdAt),
        duration: calls[0].duration || 0,
        type: calls[0].direction,
        status: calls[0].status
      } : null,
      lastMessage: messages.length > 0 ? {
        date: new Date(messages[0].createdAt || messages[0].timestamp),
        preview: messages[0].content || messages[0].text || '',
        type: messages[0].direction === 'inbound' ? 'inbound' : 'outbound',
        isRead: messages[0].status !== 'unread'
      } : null,
      lastEmail: emails.length > 0 ? {
        date: new Date(emails[0].createdAt),
        subject: emails[0].subject || 'No Subject',
        type: emails[0].direction,
        isRead: emails[0].status !== 'unread'
      } : null,
    }
  } catch (error) {
    console.error('Error fetching communications for contact:', contactId, error)
    // Return empty data on error
    return {
      lastCall: null,
      lastMessage: null,
      lastEmail: null,
    }
  }
}

// Individual contact card component with its own communication state
const ContactCard: React.FC<{
  contact: Contact
  onContactSelect: (contact: Contact) => void
  onEditContact: (contact: Contact) => void
  onDeleteContact: (contactId: string) => void
  isSelected?: boolean
  onSelectionChange?: (contactId: string, selected: boolean) => void
}> = ({ contact, onContactSelect, onEditContact, onDeleteContact, isSelected = false, onSelectionChange }) => {
  const [communications, setCommunications] = useState<{
    lastCall: any | null
    lastMessage: any | null
    lastEmail: any | null
  }>({
    lastCall: null,
    lastMessage: null,
    lastEmail: null,
  })
  const [isLoadingComms, setIsLoadingComms] = useState(true)
  const [showCallDialog, setShowCallDialog] = useState(false)
  const [callTitle, setCallTitle] = useState('')
  const [callDescription, setCallDescription] = useState('')
  const [callType, setCallType] = useState<'call' | 'meeting'>('call')
  const { toast } = useToast()

  useEffect(() => {
    const fetchCommunications = async () => {
      setIsLoadingComms(true)
      const comms = await getLastCommunications(contact.id)
      setCommunications(comms)
      setIsLoadingComms(false)
    }

    fetchCommunications()
  }, [contact.id])

  const handleStartCall = async () => {
    try {
      // Start the call (you can integrate with Telnyx or other calling service here)
      const phoneNumber = contact.phone1 || contact.phone2 || contact.phone3
      if (!phoneNumber) {
        toast({
          title: "No Phone Number",
          description: "This contact doesn't have a phone number.",
          variant: "destructive",
        })
        return
      }

      // For now, just open the phone dialer
      window.open(`tel:${phoneNumber}`, '_self')
      
      // Show the activity dialog
      setCallTitle(`Call with ${contact.firstName} ${contact.lastName}`)
      setCallDescription('')
      setShowCallDialog(true)

      toast({
        title: "Call Started",
        description: `Calling ${contact.firstName} ${contact.lastName}`,
      })
    } catch (error) {
      console.error('Error starting call:', error)
      toast({
        title: "Call Failed",
        description: "Failed to start the call. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSaveCallActivity = async () => {
    if (!callTitle.trim()) return

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId: contact.id,
          type: callType,
          title: callTitle.trim(),
          description: callDescription.trim() || '',
          status: 'completed',
          dueDate: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save activity')
      }

      toast({
        title: "Activity Saved",
        description: "Call activity has been logged successfully.",
      })

      // Reset form and close dialog
      setCallTitle('')
      setCallDescription('')
      setShowCallDialog(false)
      
      // Refresh communications
      const comms = await getLastCommunications(contact.id)
      setCommunications(comms)
    } catch (error) {
      console.error('Error saving call activity:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save the call activity. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      {/* Call Activity Dialog */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Call Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="callType">Activity Type</Label>
              <Select value={callType} onValueChange={(value: 'call' | 'meeting') => setCallType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="callTitle">Title</Label>
              <Input
                id="callTitle"
                value={callTitle}
                onChange={(e) => setCallTitle(e.target.value)}
                placeholder="Call summary..."
              />
            </div>
            <div>
              <Label htmlFor="callDescription">Notes</Label>
              <Textarea
                id="callDescription"
                value={callDescription}
                onChange={(e) => setCallDescription(e.target.value)}
                placeholder="Call notes and next steps..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCallDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCallActivity}>
                Save Activity
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Card */}
      <div className="relative group">
        <Card className="hover:shadow-lg transition-shadow duration-150 ease-in-out">
          <CardContent className="p-4">
            {/* Selection Checkbox */}
            {onSelectionChange && (
              <div className="absolute top-3 left-3 z-10">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectionChange(contact.id, !!checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <button
              onClick={() => onContactSelect(contact)}
              className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
              aria-label={`View details for ${contact.firstName} ${contact.lastName}`}
            >
              {/* Header Section */}
              <div className={`flex justify-between items-start mb-3 ${onSelectionChange ? 'ml-8' : ''}`}>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-primary truncate group-hover:underline">
                    {`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact'}
                  </h3>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-sm text-muted-foreground">{contact.phone1}</p>
                    {contact.dnc && (
                      <Badge variant="destructive" className="text-xs">DNC</Badge>
                    )}
                    {contact.dealStatus && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {contact.dealStatus.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600 hover:bg-green-100"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleStartCall()
            }}
            title="Call Contact"
          >
            <Phone size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:bg-blue-100"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onEditContact(contact)
            }}
            title="Edit Contact"
          >
            <Edit size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:bg-red-100"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onDeleteContact(contact.id)
            }}
            title="Delete Contact"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </>
  )
}

const ContactsList: React.FC<ContactsListProps> = ({
  contacts,
  onContactSelect,
  onEditContact,
  onDeleteContact,
  selectedContacts = [],
  onContactSelectionChange,
  onBulkDelete
}) => {
  const handleSelectionChange = (contactId: string, selected: boolean) => {
    if (!onContactSelectionChange) return

    let newSelection: string[]
    if (selected) {
      newSelection = [...selectedContacts, contactId]
    } else {
      newSelection = selectedContacts.filter(id => id !== contactId)
    }
    onContactSelectionChange(newSelection)
  }

  return (
    <div>
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          onContactSelect={onContactSelect}
          onEditContact={onEditContact}
          onDeleteContact={onDeleteContact}
          isSelected={selectedContacts.includes(contact.id)}
          onSelectionChange={onContactSelectionChange ? handleSelectionChange : undefined}
        />
      ))}
    </div>
  )
}

export default ContactsList
