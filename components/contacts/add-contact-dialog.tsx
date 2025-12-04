"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { Contact, Tag } from "@/lib/types"
import { TagInput } from "@/components/ui/tag-input"

interface AddContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddContact: (contact: Omit<Contact, "id" | "createdAt">) => void
}

// Helper to format phone to 10 digits
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  return digits
}

const initialFormState = {
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
}

export default function AddContactDialog({ open, onOpenChange, onAddContact }: AddContactDialogProps) {
  const [formData, setFormData] = useState(initialFormState)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData(initialFormState)
    }
  }, [open])

  const propertyTypes = [
    "Single-family (SFR)",
    "Duplex",
    "Triplex",
    "Quadplex",
    "Multifamily (5+ units)",
    "Townhouse",
    "Condominium (Condo)",
  ]

  // Use callback to prevent tag updates from resetting other form fields
  const handleTagChange = useCallback((newTags: Tag[]) => {
    setFormData(prev => ({ ...prev, tags: newTags }))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fullName.trim() || !formData.phone.trim()) {
      return
    }

    const toNumber = (v: string) => (v && v.trim() !== "" ? Number(v) : undefined)

    // Split full name into first and last name
    const nameParts = formData.fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || ""
    const lastName = nameParts.slice(1).join(" ") || ""

    const tagsPayload = formData.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color
    }))

    const contactData: any = {
      firstName,
      lastName: lastName || undefined,
      llcName: formData.llcName || undefined,
      phone1: formData.phone, // Single phone field
      email1: formData.email || undefined, // Single email field
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
      updatedAt: new Date().toISOString(),
    }

    onAddContact(contactData)
    setFormData(initialFormState)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>Add a new contact to your CRM</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">Enter full name (will be split into first and last name)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llcName">LLC Name</Label>
            <Input id="llcName" value={formData.llcName} onChange={(e) => setFormData((p) => ({ ...p, llcName: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="9179630181"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                required
              />
              <p className="text-xs text-muted-foreground">10-digit format</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address</Label>
            <Input id="propertyAddress" value={formData.propertyAddress} onChange={(e) => setFormData((p) => ({ ...p, propertyAddress: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactAddress">Contact Address</Label>
            <Input id="contactAddress" value={formData.contactAddress} onChange={(e) => setFormData((p) => ({ ...p, contactAddress: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="NY" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="propertyType">Property Type</Label>
              <Select value={formData.propertyType} onValueChange={(value) => setFormData((p) => ({ ...p, propertyType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="bedrooms">Beds</Label>
                <Input id="bedrooms" type="number" value={formData.bedrooms} onChange={(e) => setFormData((p) => ({ ...p, bedrooms: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="totalBathrooms">Baths</Label>
                <Input id="totalBathrooms" type="number" value={formData.totalBathrooms} onChange={(e) => setFormData((p) => ({ ...p, totalBathrooms: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="buildingSqft">Sqft</Label>
                <Input id="buildingSqft" type="number" value={formData.buildingSqft} onChange={(e) => setFormData((p) => ({ ...p, buildingSqft: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="effectiveYearBuilt">Year Built</Label>
              <Input id="effectiveYearBuilt" type="number" value={formData.effectiveYearBuilt} onChange={(e) => setFormData((p) => ({ ...p, effectiveYearBuilt: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="estValue">Est. Value ($)</Label>
              <Input id="estValue" type="number" value={formData.estValue} onChange={(e) => setFormData((p) => ({ ...p, estValue: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="estEquity">Est. Equity ($)</Label>
              <Input id="estEquity" type="number" value={formData.estEquity} onChange={(e) => setFormData((p) => ({ ...p, estEquity: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput
              value={formData.tags}
              onChange={handleTagChange}
              placeholder="Add tags to organize this contact..."
              showSuggestions={false}
              allowCreate={true}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add Contact</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
