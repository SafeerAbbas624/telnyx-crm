"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { X } from "lucide-react"
import type { Contact, Tag } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"
import { TagInput } from "@/components/ui/tag-input"

interface AddContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddContact: (contact: Omit<Contact, "id" | "createdAt">) => void
}

export default function AddContactDialog({ open, onOpenChange, onAddContact }: AddContactDialogProps) {
  const { tags } = useContacts()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    llcName: "",
    phone1: "",
    phone2: "",
    phone3: "",
    email1: "",
    email2: "",
    email3: "",
    propertyAddress: "",
    contactAddress: "",
    city: "",
    state: "",
    propertyCounty: "",
    propertyType: "",
    bedrooms: "",
    totalBathrooms: "",
    buildingSqft: "",
    effectiveYearBuilt: "",
    estValue: "",
    estEquity: "",
    dealStatus: "lead",
    dnc: false,
    dncReason: "",
    notes: "",
    tags: [] as Tag[],
  })

  const propertyTypes = [
    "Single-family (SFR)",
    "Duplex",
    "Triplex",
    "Quadplex",
    "Multifamily (5+ units)",
    "Townhouse",
    "Condominium (Condo)",
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName.trim() || !formData.phone1.trim()) {
      // Frontend guard; API also validates
      return
    }

    const toNumber = (v: string) => (v && v.trim() !== "" ? Number(v) : undefined)

    const tagsPayload = formData.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color
    }))

    const contactData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName || undefined,
      llcName: formData.llcName || undefined,
      phone1: formData.phone1,
      phone2: formData.phone2 || undefined,
      phone3: formData.phone3 || undefined,
      email1: formData.email1 || undefined,
      email2: formData.email2 || undefined,
      email3: formData.email3 || undefined,
      propertyAddress: formData.propertyAddress || undefined,
      contactAddress: formData.contactAddress || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      propertyCounty: formData.propertyCounty || undefined,
      propertyType: formData.propertyType || undefined,
      bedrooms: toNumber(formData.bedrooms),
      totalBathrooms: toNumber(formData.totalBathrooms),
      buildingSqft: toNumber(formData.buildingSqft),
      effectiveYearBuilt: toNumber(formData.effectiveYearBuilt),
      estValue: toNumber(formData.estValue),
      estEquity: toNumber(formData.estEquity),
      dealStatus: formData.dealStatus || 'lead',
      dnc: !!formData.dnc,
      dncReason: formData.dnc ? (formData.dncReason || 'N/A') : undefined,
      notes: formData.notes || undefined,
      tags: tagsPayload,
      updatedAt: new Date().toISOString(),
    }

    onAddContact(contactData)

    // Reset form
    setFormData({
      firstName: "",
      lastName: "",
      llcName: "",
      phone1: "",
      phone2: "",
      phone3: "",
      email1: "",
      email2: "",
      email3: "",
      propertyAddress: "",
      contactAddress: "",
      city: "",
      state: "",
      propertyCounty: "",
      propertyType: "",
      bedrooms: "",
      totalBathrooms: "",
      buildingSqft: "",
      effectiveYearBuilt: "",
      estValue: "",
      estEquity: "",
      dealStatus: "lead",
      dnc: false,
      dncReason: "",
      notes: "",
      tags: [],
    })
  }

  const handleTagToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId) ? prev.tags.filter((id) => id !== tagId) : [...prev.tags, tagId],
    }))
  }

  const getTagInfo = (tagId: string) => {
    return tags.find((tag) => tag.id === tagId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llcName">LLC Name</Label>
            <Input id="llcName" value={formData.llcName} onChange={(e) => setFormData((p) => ({ ...p, llcName: e.target.value }))} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="phone1">Phone 1 *</Label>
              <Input id="phone1" type="tel" value={formData.phone1} onChange={(e) => setFormData((p) => ({ ...p, phone1: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="phone2">Phone 2</Label>
              <Input id="phone2" type="tel" value={formData.phone2} onChange={(e) => setFormData((p) => ({ ...p, phone2: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="phone3">Phone 3</Label>
              <Input id="phone3" type="tel" value={formData.phone3} onChange={(e) => setFormData((p) => ({ ...p, phone3: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="email1">Email 1</Label>
              <Input id="email1" type="email" value={formData.email1} onChange={(e) => setFormData((p) => ({ ...p, email1: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="email2">Email 2</Label>
              <Input id="email2" type="email" value={formData.email2} onChange={(e) => setFormData((p) => ({ ...p, email2: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="email3">Email 3</Label>
              <Input id="email3" type="email" value={formData.email3} onChange={(e) => setFormData((p) => ({ ...p, email3: e.target.value }))} />
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="propertyCounty">County</Label>
              <Input id="propertyCounty" value={formData.propertyCounty} onChange={(e) => setFormData((p) => ({ ...p, propertyCounty: e.target.value }))} />
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input id="bedrooms" type="number" value={formData.bedrooms} onChange={(e) => setFormData((p) => ({ ...p, bedrooms: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="totalBathrooms">Bathrooms</Label>
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
              <Label htmlFor="effectiveYearBuilt">Year Built (Effective)</Label>
              <Input id="effectiveYearBuilt" type="number" value={formData.effectiveYearBuilt} onChange={(e) => setFormData((p) => ({ ...p, effectiveYearBuilt: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="estValue">Estimated Value ($)</Label>
              <Input id="estValue" type="number" value={formData.estValue} onChange={(e) => setFormData((p) => ({ ...p, estValue: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="estEquity">Estimated Equity ($)</Label>
              <Input id="estEquity" type="number" value={formData.estEquity} onChange={(e) => setFormData((p) => ({ ...p, estEquity: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealStatus">Deal Status</Label>
            <Select value={formData.dealStatus} onValueChange={(value) => setFormData((p) => ({ ...p, dealStatus: value }))}>
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
            <Switch id="dnc" checked={formData.dnc} onCheckedChange={(v) => setFormData((p) => ({ ...p, dnc: v }))} />
            <Label htmlFor="dnc">Do Not Call</Label>
          </div>
          {formData.dnc && (
            <div className="space-y-2">
              <Label htmlFor="dncReason">DNC Reason</Label>
              <Input id="dncReason" value={formData.dncReason} onChange={(e) => setFormData((p) => ({ ...p, dncReason: e.target.value }))} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput
              value={formData.tags}
              onChange={(tags) => setFormData((p) => ({ ...p, tags }))}
              placeholder="Add tags to organize this contact..."
              showSuggestions={true}
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
