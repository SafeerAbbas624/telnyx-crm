"use client"

import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useContacts } from "@/lib/context/contacts-context"
import { useToast } from "@/hooks/use-toast"
import type { Contact, Tag } from "@/lib/types"

interface EditContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
}

export default function EditContactDialog({ open, onOpenChange, contact }: EditContactDialogProps) {
  const { updateContact, tags } = useContacts()
  const { toast } = useToast()

  const [firstName, setFirstName] = useState(contact?.firstName || "")
  const [lastName, setLastName] = useState(contact?.lastName || "")
  const [llcName, setLlcName] = useState(contact?.llcName || "")
  const [phone1, setPhone1] = useState(contact?.phone1 || "")
  const [phone2, setPhone2] = useState(contact?.phone2 || "")
  const [phone3, setPhone3] = useState(contact?.phone3 || "")
  const [email1, setEmail1] = useState(contact?.email1 || "")
  const [email2, setEmail2] = useState(contact?.email2 || "")
  const [email3, setEmail3] = useState(contact?.email3 || "")
  const [propertyAddress, setPropertyAddress] = useState(contact?.propertyAddress || "")
  const [contactAddress, setContactAddress] = useState(contact?.contactAddress || "")
  const [city, setCity] = useState(contact?.city || "")
  const [state, setState] = useState(contact?.state || "")
  const [propertyCounty, setPropertyCounty] = useState(contact?.propertyCounty || "")
  const [propertyType, setPropertyType] = useState(contact?.propertyType || "")
  const [bedrooms, setBedrooms] = useState<number | undefined>(contact?.bedrooms ?? undefined)
  const [totalBathrooms, setTotalBathrooms] = useState<number | undefined>(contact?.totalBathrooms ?? undefined)
  const [buildingSqft, setBuildingSqft] = useState<number | undefined>(contact?.buildingSqft ?? undefined)
  const [effectiveYearBuilt, setEffectiveYearBuilt] = useState<number | undefined>(contact?.effectiveYearBuilt ?? undefined)
  const [estValue, setEstValue] = useState<number | undefined>(contact?.estValue ?? undefined)
  const [debtOwed, setDebtOwed] = useState<number | undefined>(contact?.debtOwed ?? undefined)
  const [estEquity, setEstEquity] = useState<number | undefined>(contact?.estEquity ?? undefined)
  const [dealStatus, setDealStatus] = useState<Contact["dealStatus"]>(contact?.dealStatus ?? "lead")
  const [dnc, setDnc] = useState(contact?.dnc ?? false)
  const [dncReason, setDncReason] = useState(contact?.dncReason || "")
  const [notes, setNotes] = useState(contact?.notes || "")
  const [selectedTags, setSelectedTags] = useState<Tag[]>(contact?.tags || [])
  const [newTagName, setNewTagName] = useState("")

  useEffect(() => {
    if (contact) {
      setFirstName(contact.firstName)
      setLastName(contact.lastName)
      setLlcName(contact.llcName || "")
      setPhone1(contact.phone1 || "")
      setPhone2(contact.phone2 || "")
      setPhone3(contact.phone3 || "")
      setEmail1(contact.email1 || "")
      setEmail2(contact.email2 || "")
      setEmail3(contact.email3 || "")
      setPropertyAddress(contact.propertyAddress || "")
      setContactAddress(contact.contactAddress || "")
      setCity(contact.city || "")
      setState(contact.state || "")
      setPropertyCounty(contact.propertyCounty || "")
      setPropertyType(contact.propertyType || "")
      setBedrooms(contact.bedrooms ?? undefined)
      setTotalBathrooms(contact.totalBathrooms ?? undefined)
      setBuildingSqft(contact.buildingSqft ?? undefined)
      setEffectiveYearBuilt(contact.effectiveYearBuilt ?? undefined)
      setEstValue(contact.estValue ?? undefined)
      setDebtOwed(contact.debtOwed ?? undefined)
      setEstEquity(contact.estEquity ?? undefined)
      setDealStatus(contact.dealStatus ?? "lead")
      setDnc(contact.dnc ?? false)
      setDncReason(contact.dncReason || "")
      setNotes(contact.notes || "")
      setSelectedTags(contact.tags || [])
    }
  }, [contact])

  const handleSubmit = async () => {
    if (!contact) return

    if (!firstName || !lastName) {
      toast({
        title: "Error",
        description: "First Name and Last Name are required.",
        variant: "destructive",
      })
      return
    }

    const payload: Partial<Contact> & { tags?: any[] } = {
      firstName,
      lastName,
      llcName: llcName || undefined,
      phone1: phone1 || undefined,
      phone2: phone2 || undefined,
      phone3: phone3 || undefined,
      email1: email1 || undefined,
      email2: email2 || undefined,
      email3: email3 || undefined,
      propertyAddress: propertyAddress || undefined,
      contactAddress: contactAddress || undefined,
      city: city || undefined,
      state: state || undefined,
      propertyCounty: propertyCounty || undefined,
      propertyType: propertyType || undefined,
      bedrooms,
      totalBathrooms,
      buildingSqft,
      effectiveYearBuilt,
      estValue,
      estEquity,
      dealStatus,
      dnc,
      dncReason: dnc ? dncReason || "N/A" : undefined,
      notes: notes || undefined,
      tags: selectedTags.map((t: any) => ({
        id: typeof t.id === 'string' && t.id.startsWith('new:') ? undefined : t.id,
        name: t.name,
        color: t.color,
      })),
    }

    const updated = await updateContact(contact.id, payload)
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
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Select
                  onValueChange={(value) => {
                    const tag = tags.find((t) => t.id === value)
                    if (tag && !selectedTags.some((t) => t.id === tag.id)) {
                      setSelectedTags([...selectedTags, tag])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing tags" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  placeholder="New tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = newTagName.trim()
                      if (!name) return
                      if (!selectedTags.some((t: any) => t.name.toLowerCase() === name.toLowerCase())) {
                        const newTag: any = { id: `new:${name}`, name, color: '#3B82F6' }
                        setSelectedTags([...selectedTags, newTag])
                      }
                      setNewTagName("")
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedTags.map((tag: any) => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color || '#3B82F6', color: "white" }}
                  className="cursor-pointer"
                  onClick={() => setSelectedTags(selectedTags.filter((t: any) => t.id !== tag.id && t.name !== tag.name))}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
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
