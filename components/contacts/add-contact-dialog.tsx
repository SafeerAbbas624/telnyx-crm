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
import { X } from "lucide-react"
import type { Contact, Tag } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"

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
    phone: "",
    email: "",
    propertyAddress: "",
    propertyValue: "",
    debtOwed: "",
    propertyType: "",
    notes: "",
    tags: [] as string[],
  })

  const propertyTypes = [
    "Single Family",
    "Multi Family",
    "Condo",
    "Townhouse",
    "Mobile Home",
    "Land",
    "Commercial",
    "Other",
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const contactData: Omit<Contact, "id" | "createdAt"> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      propertyAddress: formData.propertyAddress || undefined,
      propertyValue: formData.propertyValue ? Number.parseInt(formData.propertyValue) : undefined,
      debtOwed: formData.debtOwed ? Number.parseInt(formData.debtOwed) : undefined,
      propertyType: formData.propertyType || undefined,
      notes: formData.notes || undefined,
      tags: formData.tags.length > 0 ? formData.tags.map(tagId => tags.find(t => t.id === tagId)).filter(Boolean) as Tag[] : undefined,
      updatedAt: new Date().toISOString(),
    }

    onAddContact(contactData)

    // Reset form
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      propertyAddress: "",
      propertyValue: "",
      debtOwed: "",
      propertyType: "",
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
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="contact@example.com"
              />
            </div>
          </div>

          {/* Property Information */}
          <div>
            <Label htmlFor="propertyAddress">Property Address</Label>
            <Input
              id="propertyAddress"
              value={formData.propertyAddress}
              onChange={(e) => setFormData((prev) => ({ ...prev, propertyAddress: e.target.value }))}
              placeholder="123 Main St, City, State 12345"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="propertyType">Property Type</Label>
              <Select
                value={formData.propertyType}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, propertyType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="propertyValue">Property Value ($)</Label>
              <Input
                id="propertyValue"
                type="number"
                value={formData.propertyValue}
                onChange={(e) => setFormData((prev) => ({ ...prev, propertyValue: e.target.value }))}
                placeholder="450000"
              />
            </div>
            <div>
              <Label htmlFor="debtOwed">Debt Owed ($)</Label>
              <Input
                id="debtOwed"
                type="number"
                value={formData.debtOwed}
                onChange={(e) => setFormData((prev) => ({ ...prev, debtOwed: e.target.value }))}
                placeholder="320000"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => {
                const isSelected = formData.tags.includes(tag.id)
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    style={
                      isSelected
                        ? {
                            backgroundColor: tag.color,
                            borderColor: tag.color,
                          }
                        : {
                            borderColor: tag.color,
                            color: tag.color,
                          }
                    }
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                    {isSelected && <X size={12} className="ml-1" />}
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional notes about this contact..."
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Contact</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
