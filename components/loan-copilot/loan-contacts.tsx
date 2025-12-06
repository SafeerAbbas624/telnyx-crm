'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Phone, Mail, User, Building2, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface LoanContactsProps {
  dealId: string;
}

interface LoanContact {
  id: string;
  name: string;
  role: string;
  company?: string;
  phone?: string;
  email?: string;
}

const CONTACT_ROLES = [
  'Borrower',
  'Co-Borrower',
  'Title Company',
  'Escrow Officer',
  'Insurance Agent',
  'Appraiser',
  'Lender Contact',
  'Attorney',
  'Real Estate Agent',
  'Property Manager',
  'Other',
];

export default function LoanContacts({ dealId }: LoanContactsProps) {
  const [contacts, setContacts] = useState<LoanContact[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContact, setNewContact] = useState<Partial<LoanContact>>({});

  useEffect(() => {
    loadContacts();
  }, [dealId]);

  const loadContacts = async () => {
    // TODO: Load from API
    setContacts([]);
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.role) {
      toast.error('Name and role are required');
      return;
    }

    const contact: LoanContact = {
      id: `contact-${Date.now()}`,
      name: newContact.name,
      role: newContact.role,
      company: newContact.company,
      phone: newContact.phone,
      email: newContact.email,
    };

    setContacts(prev => [...prev, contact]);
    setShowAddDialog(false);
    setNewContact({});
    toast.success('Contact added');
    // TODO: Save to API
  };

  const handleDeleteContact = (contactId: string) => {
    setContacts(prev => prev.filter(c => c.id !== contactId));
    toast.success('Contact removed');
    // TODO: Delete from API
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Loan Contacts</h2>
          <p className="text-sm text-muted-foreground">
            Manage contacts associated with this loan
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Contacts Grid */}
      {contacts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No contacts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add contacts like title company, escrow officer, or lender contacts
            </p>
            <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" />
              Add First Contact
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{contact.name}</h4>
                    <Badge variant="outline" className="mt-1">{contact.role}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteContact(contact.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                {contact.company && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {contact.company}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Phone className="h-3.5 w-3.5" />
                    {contact.phone}
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {contact.email}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Loan Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={newContact.name || ''} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Contact name" />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={newContact.role || ''} onValueChange={(val) => setNewContact({ ...newContact, role: val })}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((role) => (<SelectItem key={role} value={role}>{role}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Company</Label>
              <Input value={newContact.company || ''} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} placeholder="Company name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={newContact.phone || ''} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="Phone number" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={newContact.email || ''} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="Email address" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddContact}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

