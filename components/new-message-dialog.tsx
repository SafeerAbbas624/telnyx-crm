"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Contact } from "@/lib/types"

interface NewMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSendMessage: (contact: Contact, message: string) => void
}

export default function NewMessageDialog({ open, onOpenChange, onSendMessage }: NewMessageDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [name, setName] = useState("")
  const [propertyAddress, setPropertyAddress] = useState("")
  const [cityState, setCityState] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [llcName, setLlcName] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = () => {
    if (!phoneNumber.trim() || !message.trim()) return

    setIsLoading(true)

    // Create a new contact
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      name: name.trim() || "Unknown",
      phoneNumber: phoneNumber.trim(),
      propertyAddress: propertyAddress.trim(),
      cityState: cityState.trim(),
      propertyType: propertyType.trim(),
      llcName: llcName.trim() || undefined,
    }

    // Send the message
    onSendMessage(newContact, message)

    // Reset form and close dialog
    setPhoneNumber("")
    setName("")
    setPropertyAddress("")
    setCityState("")
    setPropertyType("")
    setLlcName("")
    setMessage("")
    setIsLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Contact Name</Label>
            <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Property Address</Label>
            <Input
              id="address"
              placeholder="123 Main St"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cityState">City & State</Label>
              <Input
                id="cityState"
                placeholder="New York, NY"
                value={cityState}
                onChange={(e) => setCityState(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type</Label>
              <Input
                id="propertyType"
                placeholder="Single-Fam, Duplex, etc."
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llcName">LLC Name (Optional)</Label>
            <Input
              id="llcName"
              placeholder="Property Holdings LLC"
              value={llcName}
              onChange={(e) => setLlcName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={isLoading || !phoneNumber.trim() || !message.trim()}>
            {isLoading ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
