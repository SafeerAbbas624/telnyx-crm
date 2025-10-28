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
  city?: string
  state?: string
  propertyType?: string
  estValue?: number
}

interface NewLoanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateLoan: (loanData: any) => void
}

export default function NewLoanDialog({
  open,
  onOpenChange,
  onCreateLoan,
}: NewLoanDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [openContactPopover, setOpenContactPopover] = useState(false)
  const [contactSearch, setContactSearch] = useState("")
  const [funders, setFunders] = useState<any[]>([])

  const [formData, setFormData] = useState({
    loanNumber: "",
    borrowerName: "",
    entityName: "",
    propertyAddress: "",
    propertyType: "",
    estimatedValue: "",
    loanAmount: "",
    ltv: "",
    loanType: "DSCR",
    loanPurpose: "Purchase",
    funder: "",
    targetCloseDate: "",
  })

  // Fetch contacts on dialog open
  useEffect(() => {
    if (open) {
      fetchContacts()
      fetchFunders()
    }
  }, [open])

  const fetchContacts = async () => {
    try {
      console.log('Fetching contacts...')
      const response = await fetch('/api/contacts?limit=1000')
      if (response.ok) {
        const data = await response.json()
        console.log('Contacts response:', data)
        const contactsList = data.contacts || []
        console.log('Setting contacts:', contactsList.length)
        setContacts(contactsList)
      } else {
        console.error('Failed to fetch contacts:', response.status)
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }

  const fetchFunders = async () => {
    try {
      const res = await fetch('/api/funders')
      if (res.ok) {
        const data = await res.json()
        setFunders(data.funders || [])
      } else {
        console.error('Failed to fetch funders:', res.status)
        setFunders([])
      }
    } catch (error) {
      console.error('Failed to fetch funders:', error)
      setFunders([])
    }
  }

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.llcName?.toLowerCase().includes(contactSearch.toLowerCase())
  )

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)

    // Map common variants to our canonical dropdown values
    const canonicalizePropertyType = (pt?: string): string => {
      if (!pt) return ''
      const s = pt.toLowerCase()
      if (s.includes('single') && s.includes('family')) return 'Single-family (SFR)'
      if (s.includes('duplex')) return 'Duplex'
      if (s.includes('triplex')) return 'Triplex'
      if (s.includes('quad')) return 'Quadplex'
      if (s.includes('town')) return 'Townhouse'
      if (s.includes('condo')) return 'Condominium (Condo)'
      if ((s.includes('multi') && s.includes('family')) || s.includes('5+')) return 'Multifamily (5+ units)'
      if (s.includes('commercial')) return 'Commercial'
      if (s.includes('land')) return 'Land'
      if (s.includes('other')) return 'Other'
      return pt // fallback to original string
    }

    setFormData(prev => ({
      ...prev,
      borrowerName: `${contact.firstName} ${contact.lastName}`,
      entityName: contact.llcName || '',
      propertyAddress: contact.propertyAddress || '',
      propertyType: canonicalizePropertyType(contact.propertyType),
      estimatedValue: contact.estValue?.toString() || '',
    }))
    setOpenContactPopover(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Auto-calculate LTV if both loan amount and estimated value are present
    if ((field === "loanAmount" || field === "estimatedValue") && formData.loanAmount && formData.estimatedValue) {
      const loanAmt = field === "loanAmount" ? parseFloat(value) : parseFloat(formData.loanAmount)
      const estVal = field === "estimatedValue" ? parseFloat(value) : parseFloat(formData.estimatedValue)
      if (estVal > 0) {
        const ltv = ((loanAmt / estVal) * 100).toFixed(2)
        setFormData(prev => ({ ...prev, ltv }))
      }
    }
  }

  const handleCreate = () => {
    // Validate required fields
    if (!formData.borrowerName.trim() || !formData.propertyAddress.trim() ||
        !formData.loanAmount || !formData.estimatedValue || !formData.loanType ||
        !formData.loanPurpose || !formData.funder) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      onCreateLoan({
        ...formData,
        loanAmount: parseFloat(formData.loanAmount),
        estimatedValue: parseFloat(formData.estimatedValue),
        ltv: formData.ltv ? parseFloat(formData.ltv) : 0,
        contactId: selectedContact?.id || "",
      })

      toast({
        title: "Success",
        description: "Loan created successfully!",
      })

      // Reset form
      setFormData({
        loanNumber: "",
        borrowerName: "",
        entityName: "",
        propertyAddress: "",
        propertyType: "",
        estimatedValue: "",
        loanAmount: "",
        ltv: "",
        loanType: "DSCR",
        loanPurpose: "Purchase",
        funder: "",
        targetCloseDate: "",
      })
      setSelectedContact(null)
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create loan",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Loan</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Loan Number */}
            <div className="space-y-2">
              <Label htmlFor="loanNumber">Loan Number</Label>
              <Input
                id="loanNumber"
                placeholder="LN-0001"
                value={formData.loanNumber}
                onChange={(e) => handleInputChange("loanNumber", e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Contact Selection */}
            <div className="space-y-2">
              <Label>Select Borrower from Database</Label>
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

            {/* Top Row: Borrower Name, Entity Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="borrowerName">Borrower Name *</Label>
                <Input
                  id="borrowerName"
                  placeholder="John Doe"
                  value={formData.borrowerName}
                  onChange={(e) => handleInputChange("borrowerName", e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityName">Entity Name (Optional)</Label>
                <Input
                  id="entityName"
                  placeholder="ABC Properties LLC"
                  value={formData.entityName}
                  onChange={(e) => handleInputChange("entityName", e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Property Address */}
            <div className="space-y-2">
              <Label htmlFor="propertyAddress">Property Address *</Label>
              <Input
                id="propertyAddress"
                placeholder="123 Main St, City, State 12345"
                value={formData.propertyAddress}
                onChange={(e) => handleInputChange("propertyAddress", e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type *</Label>
              <Select value={formData.propertyType} onValueChange={(value) => handleInputChange("propertyType", value)}>
                <SelectTrigger id="propertyType" disabled={isLoading}>
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single-family (SFR)">Single-family (SFR)</SelectItem>
                  <SelectItem value="Duplex">Duplex</SelectItem>
                  <SelectItem value="Triplex">Triplex</SelectItem>
                  <SelectItem value="Quadplex">Quadplex</SelectItem>
                  <SelectItem value="Townhouse">Townhouse</SelectItem>
                  <SelectItem value="Condominium (Condo)">Condominium (Condo)</SelectItem>
                  <SelectItem value="Multifamily (5+ units)">Multifamily (5+ units)</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Land">Land</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Second Row: Estimated Value, Loan Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Estimated Value *</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  placeholder="500000"
                  value={formData.estimatedValue}
                  onChange={(e) => handleInputChange("estimatedValue", e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loanAmount">Loan Amount *</Label>
                <Input
                  id="loanAmount"
                  type="number"
                  placeholder="350000"
                  value={formData.loanAmount}
                  onChange={(e) => handleInputChange("loanAmount", e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Third Row: LTV, Loan Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ltv">LTV % (Optional)</Label>
                <Input
                  id="ltv"
                  type="number"
                  placeholder="70"
                  value={formData.ltv}
                  onChange={(e) => handleInputChange("ltv", e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loanType">Loan Type *</Label>
                <Select value={formData.loanType} onValueChange={(value) => handleInputChange("loanType", value)}>
                  <SelectTrigger id="loanType" disabled={isLoading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DSCR">DSCR</SelectItem>
                    <SelectItem value="Fix & Flip">Fix & Flip</SelectItem>
                    <SelectItem value="Ground up construction">Ground up construction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fourth Row: Loan Purpose, Funder */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loanPurpose">Loan Purpose *</Label>
                <Select value={formData.loanPurpose} onValueChange={(value) => handleInputChange("loanPurpose", value)}>
                  <SelectTrigger id="loanPurpose" disabled={isLoading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Purchase">Purchase</SelectItem>
                    <SelectItem value="Refinance">Refinance</SelectItem>
                    <SelectItem value="Cash-out refinance">Cash-out refinance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funder">Funder *</Label>
                <Select value={formData.funder} onValueChange={(value) => handleInputChange("funder", value)}>
                  <SelectTrigger id="funder" disabled={isLoading}>
                    <SelectValue placeholder="Select funder" />
                  </SelectTrigger>
                  <SelectContent>
                    {funders.map((funder) => (
                      <SelectItem key={funder.id} value={funder.id}>
                        {funder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Close Date */}
            <div className="space-y-2">
              <Label htmlFor="targetCloseDate">Target Close Date</Label>
              <Input
                id="targetCloseDate"
                type="date"
                value={formData.targetCloseDate}
                onChange={(e) => handleInputChange("targetCloseDate", e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

