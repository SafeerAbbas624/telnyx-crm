"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useContacts } from "@/lib/context/contacts-context"
import { useToast } from "@/hooks/use-toast"
import { TagInput } from "@/components/ui/tag-input"
import type { Contact, Tag } from "@/lib/types"

interface EditContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
}

// Helper to format phone to 10 digits
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  return digits
}

const propertyTypes = [
  "Single-family (SFR)",
  "Duplex",
  "Triplex",
  "Quadplex",
  "Multifamily (5+ units)",
  "Townhouse",
  "Condominium (Condo)",
]

export default function EditContactDialog({ open, onOpenChange, contact }: EditContactDialogProps) {
  const { updateContact, refreshFilterOptions } = useContacts()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    fullName: "",
    llcName: "",
    phone: "",
    email: "",
    propertyAddress: "",
    contactAddress: "",
    city: "",
    state: "",
    propertyType: "",
    bedrooms: "",
    totalBathrooms: "",
    buildingSqft: "",
    effectiveYearBuilt: "",
    estValue: "",
    estEquity: "",
    tags: [] as Tag[],
  })

  // Load contact data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        fullName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
        llcName: contact.llcName || "",
        phone: contact.phone1 || "",
        email: contact.email1 || "",
        propertyAddress: contact.propertyAddress || "",
        contactAddress: contact.contactAddress || "",
        city: contact.city || "",
        state: contact.state || "",
        propertyType: contact.propertyType || "",
        bedrooms: contact.bedrooms?.toString() || "",
        totalBathrooms: contact.totalBathrooms?.toString() || "",
        buildingSqft: contact.buildingSqft?.toString() || "",
        effectiveYearBuilt: contact.effectiveYearBuilt?.toString() || "",
        estValue: contact.estValue?.toString() || "",
        estEquity: contact.estEquity?.toString() || "",
        tags: contact.tags || [],
      })
    }
  }, [contact])

  // Use callback to prevent tag updates from resetting other form fields
  const handleTagChange = useCallback((newTags: Tag[]) => {
    setFormData(prev => ({ ...prev, tags: newTags }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact) return

    if (!formData.fullName.trim() || !formData.phone.trim()) {
      toast({
        title: "Error",
        description: "Full Name and Phone are required.",
        variant: "destructive",
      })
      return
    }

    const toNumber = (v: string) => (v && v.trim() !== "" ? Number(v) : undefined)

    // Split full name into first and last name
    const nameParts = formData.fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || ""
    const lastName = nameParts.slice(1).join(" ") || ""

    const tagsPayload = formData.tags.map((t: any) => {
      // Handle new tags (prefixed with 'new:')
      if (typeof t.id === 'string' && t.id.startsWith('new:')) {
        return { name: t.name, color: t.color || '#3B82F6' }
      }
      // Handle existing tags
      return { id: t.id, name: t.name, color: t.color }
    })

    const payload: Partial<Contact> & { tags?: any[] } = {
      firstName,
      lastName: lastName || undefined,
      llcName: formData.llcName || undefined,
      phone1: formData.phone || undefined,
      email1: formData.email || undefined,
      propertyAddress: formData.propertyAddress || undefined,
      contactAddress: formData.contactAddress || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      propertyType: formData.propertyType || undefined,
      bedrooms: toNumber(formData.bedrooms),
      totalBathrooms: toNumber(formData.totalBathrooms),
      buildingSqft: toNumber(formData.buildingSqft),
      effectiveYearBuilt: toNumber(formData.effectiveYearBuilt),
      estValue: toNumber(formData.estValue),
      estEquity: toNumber(formData.estEquity),
      tags: tagsPayload,
    }

    await updateContact(contact.id, payload)

    // Force refresh filter options after updating contact (especially for tags)
    console.log('🔄 [EDIT CONTACT] Manually refreshing filter options after update')
    await refreshFilterOptions()

    toast({
      title: "Contact updated",
      description: `${firstName} ${lastName}'s details have been updated.`,
    })
    onOpenChange(false)
    return updated
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Make changes to {contact?.firstName} {contact?.lastName}&apos;s details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="llcName">LLC Name</Label>
            <Input id="llcName" value={llcName} onChange={(e) => setLlcName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone1">Phone 1</Label>
              <Input id="phone1" value={phone1} onChange={(e) => setPhone1(e.target.value)} type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone2">Phone 2</Label>
              <Input id="phone2" value={phone2} onChange={(e) => setPhone2(e.target.value)} type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone3">Phone 3</Label>
              <Input id="phone3" value={phone3} onChange={(e) => setPhone3(e.target.value)} type="tel" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email1">Email 1</Label>
              <Input id="email1" value={email1} onChange={(e) => setEmail1(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email2">Email 2</Label>
              <Input id="email2" value={email2} onChange={(e) => setEmail2(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email3">Email 3</Label>
              <Input id="email3" value={email3} onChange={(e) => setEmail3(e.target.value)} type="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address</Label>
            <Input id="propertyAddress" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactAddress">Contact Address</Label>
            <Input
              id="contactAddress"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="Where the person lives (different from property address)"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="propertyCounty">Property County</Label>
              <Input id="propertyCounty" value={propertyCounty} onChange={(e) => setPropertyCounty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type</Label>
              <Input id="propertyType" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                value={bedrooms ?? ""}
                onChange={(e) => setBedrooms(e.target.value ? Number.parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalBathrooms">Total Bathrooms</Label>
              <Input
                id="totalBathrooms"
                type="number"
                value={totalBathrooms ?? ""}
                onChange={(e) => setTotalBathrooms(e.target.value ? Number.parseFloat(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buildingSqft">Building Sqft</Label>
              <Input
                id="buildingSqft"
                type="number"
                value={buildingSqft ?? ""}
                onChange={(e) => setBuildingSqft(e.target.value ? Number.parseInt(e.target.value) : undefined)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveYearBuilt">Effective Year Built</Label>
              <Input
                id="effectiveYearBuilt"
                type="number"
                value={effectiveYearBuilt ?? ""}
                onChange={(e) => setEffectiveYearBuilt(e.target.value ? Number.parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estValue">Estimated Value</Label>
              <Input
                id="estValue"
                type="number"
                value={estValue ?? ""}
                onChange={(e) => setEstValue(e.target.value ? Number.parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debtOwed">Debt Owed</Label>
              <Input
                id="debtOwed"
                type="number"
                value={debtOwed ?? ""}
                onChange={(e) => setDebtOwed(e.target.value ? Number.parseInt(e.target.value) : undefined)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estEquity">Estimated Equity</Label>
            <Input
              id="estEquity"
              type="number"
              value={estEquity ?? ""}
              onChange={(e) => setEstEquity(e.target.value ? Number.parseInt(e.target.value) : undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dealStatus">Deal Status</Label>
            <Select value={dealStatus as string} onValueChange={(value) => setDealStatus(value as Contact["dealStatus"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select deal status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="credit_run">Credit Run</SelectItem>
                <SelectItem value="document_collection">Document Collection</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="appraisal_fee">Appraisal Fee</SelectItem>
                <SelectItem value="underwriting">Underwriting</SelectItem>
                <SelectItem value="closing">Closing</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="dnc" checked={dnc} onCheckedChange={setDnc} />
            <Label htmlFor="dnc">Do Not Call</Label>
          </div>
          {dnc && (
            <div className="space-y-2">
              <Label htmlFor="dncReason">DNC Reason</Label>
              <Input id="dncReason" value={dncReason} onChange={(e) => setDncReason(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {/* Custom Fields Section */}
          {fieldDefinitions.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Custom Fields</Label>
                <Badge variant="secondary" className="text-xs">{fieldDefinitions.length} fields</Badge>
              </div>
              <div className="grid gap-4">
                {fieldDefinitions.map((field: any) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`custom-${field.fieldKey}`}>
                      {field.name}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.fieldType === 'textarea' ? (
                      <Textarea
                        id={`custom-${field.fieldKey}`}
                        value={customFields[field.fieldKey] || ''}
                        onChange={(e) => setCustomFields({ ...customFields, [field.fieldKey]: e.target.value })}
                        placeholder={field.placeholder || ''}
                        rows={3}
                      />
                    ) : field.fieldType === 'boolean' ? (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`custom-${field.fieldKey}`}
                          checked={customFields[field.fieldKey] || false}
                          onCheckedChange={(checked) => setCustomFields({ ...customFields, [field.fieldKey]: checked })}
                        />
                        <Label htmlFor={`custom-${field.fieldKey}`} className="font-normal cursor-pointer">
                          {customFields[field.fieldKey] ? 'Yes' : 'No'}
                        </Label>
                      </div>
                    ) : field.fieldType === 'select' ? (
                      <Select
                        value={customFields[field.fieldKey] || ''}
                        onValueChange={(value) => setCustomFields({ ...customFields, [field.fieldKey]: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder || 'Select...'} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options && Array.isArray(field.options) && field.options.map((option: string) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.fieldType === 'date' ? (
                      <Input
                        id={`custom-${field.fieldKey}`}
                        type="date"
                        value={customFields[field.fieldKey] || ''}
                        onChange={(e) => setCustomFields({ ...customFields, [field.fieldKey]: e.target.value })}
                      />
                    ) : field.fieldType === 'number' || field.fieldType === 'decimal' || field.fieldType === 'currency' ? (
                      <Input
                        id={`custom-${field.fieldKey}`}
                        type="number"
                        step={field.fieldType === 'decimal' || field.fieldType === 'currency' ? '0.01' : '1'}
                        value={customFields[field.fieldKey] || ''}
                        onChange={(e) => setCustomFields({ ...customFields, [field.fieldKey]: e.target.value })}
                        placeholder={field.placeholder || ''}
                      />
                    ) : (
                      <Input
                        id={`custom-${field.fieldKey}`}
                        type={field.fieldType === 'email' ? 'email' : field.fieldType === 'url' ? 'url' : field.fieldType === 'phone' ? 'tel' : 'text'}
                        value={customFields[field.fieldKey] || ''}
                        onChange={(e) => setCustomFields({ ...customFields, [field.fieldKey]: e.target.value })}
                        placeholder={field.placeholder || ''}
                      />
                    )}
                    {field.helpText && (
                      <p className="text-xs text-gray-500">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <TagInput
              value={selectedTags}
              onChange={setSelectedTags}
              contactId={contact?.id}
              placeholder="Add tags to organize this contact..."
              showSuggestions={true}
              allowCreate={true}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
