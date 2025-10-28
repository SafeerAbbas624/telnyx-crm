"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Phone, Plus, Trash2, Edit2, X, Send } from "lucide-react"
import BulkEmailDialog from "./bulk-email-dialog"

interface LoanContact {
  id: string
  name: string
  role: string
  company: string
  email: string
  phone: string
}

interface LoanContactsTabProps {
  loanId: string
  contacts: LoanContact[]
  onAddContact: (contact: Omit<LoanContact, 'id'>) => void
  onDeleteContact: (contactId: string) => void
  onAddFrequent: (contact: Omit<LoanContact, 'id'>) => void
  onSendBulkEmail?: (recipients: string[], subject: string, body: string) => Promise<void>
}

const FREQUENT_CONTACTS = [
  { name: 'Stephanie Zalai', email: 'stephanie@titleratenow.com', phone: '(917) 963-0181', role: 'Title Company', company: 'Title Rate Now' },
  { name: 'Janet Garcia', email: 'janet@grandphoenixins.com', phone: '(602) 555-7890', role: 'Insurance Agent', company: 'Grand Phoenix Insurance' },
  { name: 'John Smith', email: 'john@loananalyst.com', phone: '(555) 123-4567', role: 'Loan Analyst', company: 'Loan Analysis Inc' },
]

export default function LoanContactsTab({ loanId, contacts, onAddContact, onDeleteContact, onAddFrequent, onSendBulkEmail }: LoanContactsTabProps) {
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    company: '',
    email: '',
    phone: '',
  })

  const handleAddContact = () => {
    if (formData.name && formData.email) {
      onAddContact(formData)
      setFormData({ name: '', role: '', company: '', email: '', phone: '' })
      setIsAddingContact(false)
    }
  }

  const groupedContacts = contacts.reduce((acc, contact) => {
    if (!acc[contact.role]) {
      acc[contact.role] = []
    }
    acc[contact.role].push(contact)
    return acc
  }, {} as Record<string, LoanContact[]>)

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'Title Company': 'bg-blue-100 text-blue-800',
      'Insurance Agent': 'bg-green-100 text-green-800',
      'Loan Analyst': 'bg-purple-100 text-purple-800',
      'Appraiser': 'bg-orange-100 text-orange-800',
      'Attorney': 'bg-red-100 text-red-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contacts</h3>
        <div className="flex gap-2">
          {onSendBulkEmail && contacts.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowBulkEmailDialog(true)}
              variant="outline"
            >
              <Send className="mr-2 h-4 w-4" /> Send Bulk Email
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setIsAddingContact(true)}
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Add Contact Form */}
      {isAddingContact && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Add New Contact</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setIsAddingContact(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="Contact name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Input
                  placeholder="e.g., Title Company"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <Input
                  placeholder="Company name"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddContact} className="flex-1">
                Add Contact
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAddingContact(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Add Frequent Contacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick Add Frequent Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENT_CONTACTS.map((contact) => (
              <Button
                key={contact.email}
                size="sm"
                variant="outline"
                onClick={() => onAddFrequent(contact)}
                className="text-xs"
              >
                <Plus className="mr-1 h-3 w-3" /> {contact.role}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contacts by Role */}
      {Object.entries(groupedContacts).length > 0 ? (
        Object.entries(groupedContacts).map(([role, roleContacts]) => (
          <Card key={role}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{role}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {roleContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{contact.name}</div>
                    <div className="text-xs text-muted-foreground">{contact.company}</div>
                    <div className="flex gap-2 mt-2 text-xs">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={() => onDeleteContact(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">No contacts yet. Add your first contact.</p>
            <Button onClick={() => setIsAddingContact(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Contact Button */}
      {!isAddingContact && (
        <Button onClick={() => setIsAddingContact(true)} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add New Contact
        </Button>
      )}

      {/* Bulk Email Dialog */}
      {onSendBulkEmail && (
        <BulkEmailDialog
          open={showBulkEmailDialog}
          onOpenChange={setShowBulkEmailDialog}
          contacts={contacts}
          onSendBulkEmail={onSendBulkEmail}
        />
      )}
    </div>
  )
}

