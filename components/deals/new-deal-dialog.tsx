"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Contact {
  id: string
  firstName: string
  lastName: string
  llcName?: string
  phone1?: string
  email1?: string
  propertyAddress?: string
  estValue?: number
}

interface NewDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateDeal: (dealData: any) => void
  stages: any[]
}

export default function NewDealDialog({
  open,
  onOpenChange,
  onCreateDeal,
  stages,
}: NewDealDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [openContactPopover, setOpenContactPopover] = useState(false)
  const [contactSearch, setContactSearch] = useState("")

  const [formData, setFormData] = useState({
    title: "",
    value: "",
    stage: stages[0]?.id || "lead",
    probability: "50",
    expectedCloseDate: "",
    notes: "",
  })

  useEffect(() => {
    if (open) {
      fetchContacts()
    }
  }, [open])

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.llcName?.toLowerCase().includes(contactSearch.toLowerCase())
  )

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)
    setFormData(prev => ({
      ...prev,
      title: `${contact.propertyAddress || 'Property'} - ${contact.firstName} ${contact.lastName}`,
      value: contact.estValue?.toString() || "",
    }))
    setOpenContactPopover(false)
  }

  const handleCreate = () => {
    if (!formData.title.trim() || !formData.value || !selectedContact) {
      toast({
        title: "Error",
        description: "Please select a contact and fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      onCreateDeal({
        title: formData.title,
        value: parseInt(formData.value),
        contactId: selectedContact.id,
        contactName: `${selectedContact.firstName} ${selectedContact.lastName}`,
        stage: formData.stage,
        probability: parseInt(formData.probability),
        expectedCloseDate: formData.expectedCloseDate,
        notes: formData.notes,
      })

      toast({
        title: "Success",
        description: "Deal created successfully!",
      })

      // Reset form
      setFormData({
        title: "",
        value: "",
        stage: stages[0]?.id || "lead",
        probability: "50",
        expectedCloseDate: "",
        notes: "",
      })
      setSelectedContact(null)
      setContactSearch("")
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create deal",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Selection */}
          <div className="space-y-2">
            <Label>Select Contact *</Label>
            <Popover open={openContactPopover} onOpenChange={setOpenContactPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openContactPopover}
                  className="w-full justify-between"
                  disabled={isLoading || contacts.length === 0}
                >
                  {selectedContact
                    ? `${selectedContact.firstName} ${selectedContact.lastName}`
                    : contacts.length === 0 ? "Loading contacts..." : "Select contact..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onValueChange={setContactSearch}
                  />
                  {filteredContacts.length === 0 ? (
                    <CommandEmpty>
                      {contacts.length === 0 ? "No contacts available" : "No contacts found."}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup>
                      <div className="max-h-[250px] overflow-y-auto">
                        {filteredContacts.map((contact) => (
                          <CommandItem
                            key={contact.id}
                            value={contact.id}
                            onSelect={() => handleSelectContact(contact)}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedContact?.id === contact.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                              {contact.llcName && <div className="text-sm text-gray-500">{contact.llcName}</div>}
                              {contact.phone1 && <div className="text-xs text-gray-400">{contact.phone1}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </div>
                    </CommandGroup>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Deal Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Deal Title *</Label>
            <Input
              id="title"
              placeholder="e.g., 123 Main St - Purchase"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Deal Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Deal Value *</Label>
            <Input
              id="value"
              type="number"
              placeholder="e.g., 350000"
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Stage */}
          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <Select value={formData.stage} onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}>
              <SelectTrigger id="stage" disabled={isLoading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Probability */}
          <div className="space-y-2">
            <Label htmlFor="probability">Probability (%)</Label>
            <Input
              id="probability"
              type="number"
              min="0"
              max="100"
              value={formData.probability}
              onChange={(e) => setFormData(prev => ({ ...prev, probability: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Expected Close Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
            <Input
              id="expectedCloseDate"
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this deal..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              disabled={isLoading}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || !selectedContact}>
            {isLoading ? "Creating..." : "Create Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

