'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, DollarSign, User, MapPin, Building2, Calendar, Loader2, GripVertical, Edit, Trash2, Phone, MessageSquare, Mail, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ContactName from '@/components/contacts/contact-name';
import { useCallUI } from '@/lib/context/call-ui-context';
import { useSmsUI } from '@/lib/context/sms-ui-context';
import { useEmailUI } from '@/lib/context/email-ui-context';
import { useTaskUI } from '@/lib/context/task-ui-context';

interface Deal {
  id: string;
  title: string;
  value: number;
  contactId: string;
  contactName?: string;
  propertyAddress?: string;
  llcName?: string;
  stage: string;
  probability: number;
  expectedCloseDate?: string;
  notes?: string;
  createdAt: string;
}

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  propertyAddress?: string;
  llcName?: string;
}

const STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
  { id: 'contract', label: 'Contract', color: 'bg-yellow-500' },
  { id: 'closing', label: 'Closing', color: 'bg-teal-500' },
  { id: 'closed_won', label: 'Won', color: 'bg-green-500' },
  { id: 'closed_lost', label: 'Lost', color: 'bg-red-500' },
];

export default function DealsKanbanBoard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const { openCall } = useCallUI();
  const { openSms } = useSmsUI();
  const { openEmail } = useEmailUI();
  const { openTask } = useTaskUI();
  
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    contactId: '',
    stage: 'lead',
    probability: '0',
    expectedCloseDate: '',
    notes: ''
  });

  useEffect(() => {
    loadDeals();
    loadContacts();
  }, []);

  const loadDeals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/deals');
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
      }
    } catch (error) {
      console.error('Error loading deals:', error);
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await fetch('/api/contacts?limit=1000');
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const openCreateDialog = () => {
    setFormData({
      title: '',
      value: '',
      contactId: '',
      stage: 'lead',
      probability: '0',
      expectedCloseDate: '',
      notes: ''
    });
    setShowCreateDialog(true);
  };

  const openEditDialog = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      title: deal.title,
      value: deal.value.toString(),
      contactId: deal.contactId,
      stage: deal.stage,
      probability: deal.probability.toString(),
      expectedCloseDate: deal.expectedCloseDate || '',
      notes: deal.notes || ''
    });
    setShowEditDialog(true);
  };

  const saveDeal = async () => {
    if (!formData.title.trim() || !formData.contactId) {
      toast.error('Title and contact are required');
      return;
    }
    setSaving(true);
    try {
      const url = editingDeal ? `/api/deals/${editingDeal.id}` : '/api/deals';
      const method = editingDeal ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.title,
          value: parseFloat(formData.value) || 0,
          contact_id: formData.contactId,
          stage: formData.stage,
          probability: parseInt(formData.probability) || 0,
          expected_close_date: formData.expectedCloseDate || null,
          notes: formData.notes
        })
      });
      if (res.ok) {
        toast.success(editingDeal ? 'Deal updated' : 'Deal created');
        setShowCreateDialog(false);
        setShowEditDialog(false);
        loadDeals();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save deal');
      }
    } catch (error) {
      toast.error('Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Deal deleted');
        loadDeals();
      } else {
        toast.error('Failed to delete deal');
      }
    } catch (error) {
      toast.error('Failed to delete deal');
    }
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStage: string) => {
    if (!draggedDeal) return;

    try {
      const res = await fetch(`/api/deals/${draggedDeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draggedDeal.title,
          value: draggedDeal.value,
          contact_id: draggedDeal.contactId,
          stage: newStage,
          probability: draggedDeal.probability,
          expected_close_date: draggedDeal.expectedCloseDate || null,
          notes: draggedDeal.notes
        })
      });

      if (res.ok) {
        toast.success('Deal stage updated');
        loadDeals();
      } else {
        toast.error('Failed to update deal stage');
      }
    } catch (error) {
      toast.error('Failed to update deal stage');
    } finally {
      setDraggedDeal(null);
    }
  };

  const getDealsByStage = (stage: string) => {
    return deals.filter(d => d.stage === stage);
  };

  const getContactInfo = (contactId: string) => {
    return contacts.find(c => c.id === contactId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Deals Pipeline</h1>
          <p className="text-gray-500">Drag deals between stages to update their status</p>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Deal
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {STAGES.map((stage) => {
            const stageDeals = getDealsByStage(stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Stage Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                      <h3 className="font-semibold">{stage.label}</h3>
                      <Badge variant="secondary">{stageDeals.length}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{formatCurrency(stageValue)}</p>
                </div>

                {/* Deals List */}
                <div className="flex-1 overflow-y-auto space-y-3">
                  {stageDeals.map((deal) => {
                    const contact = getContactInfo(deal.contactId);
                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal)}
                        className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-move"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2 flex-1">
                            <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{deal.title}</h4>
                              <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(deal.value)}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openEditDialog(deal)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => deleteDeal(deal.id)}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        {/* Contact Info */}
                        {contact && (
                          <div className="space-y-2 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 flex-shrink-0" />
                              <div className="truncate">
                                <ContactName
                                  contactId={deal.contactId}
                                  contact={contact}
                                  clickMode="popup"
                                  className="text-xs"
                                />
                              </div>
                            </div>
                            {contact.propertyAddress && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{contact.propertyAddress}</span>
                              </div>
                            )}
                            {contact.llcName && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate">{contact.llcName}</span>
                              </div>
                            )}

                            {/* Communication & Task Buttons */}
                            <div className="flex items-center gap-1 pt-1 border-t mt-2 pt-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-blue-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const phone = (contact as any).phone1 || (contact as any).phone2;
                                  if (phone) {
                                    openCall({
                                      phoneNumber: phone,
                                      contact: { ...contact, id: deal.contactId }
                                    });
                                  } else {
                                    toast.error('No phone number available');
                                  }
                                }}
                                title="Call"
                              >
                                <Phone className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const phone = (contact as any).phone1 || (contact as any).phone2;
                                  if (phone) {
                                    openSms({
                                      phoneNumber: phone,
                                      contact: { ...contact, id: deal.contactId }
                                    });
                                  } else {
                                    toast.error('No phone number available');
                                  }
                                }}
                                title="Text"
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-purple-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const email = (contact as any).email1 || (contact as any).email2;
                                  if (email) {
                                    openEmail({
                                      email,
                                      contact: { ...contact, id: deal.contactId }
                                    });
                                  } else {
                                    toast.error('No email address available');
                                  }
                                }}
                                title="Email"
                              >
                                <Mail className="h-3.5 w-3.5 text-purple-600" />
                              </Button>
                              <div className="flex-1" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-orange-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTask({
                                    contactId: deal.contactId,
                                    contact: { ...contact, id: deal.contactId },
                                    title: `Follow up: ${deal.title}`,
                                    description: `Task for deal: ${deal.title}\nValue: ${formatCurrency(deal.value)}`,
                                  });
                                }}
                                title="Create Task"
                              >
                                <CheckSquare className="h-3.5 w-3.5 text-orange-600" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Expected Close Date */}
                        {deal.expectedCloseDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}

                        {/* Probability */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Probability</span>
                            <span>{deal.probability}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Deal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>Add a new deal to your pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Deal Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., 123 Main St Purchase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Value ($)</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div>
              <Label>Contact</Label>
              <Select value={formData.contactId} onValueChange={(val) => setFormData({ ...formData, contactId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.fullName || `${contact.firstName} ${contact.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stage</Label>
                <Select value={formData.stage} onValueChange={(val) => setFormData({ ...formData, stage: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Close Date</Label>
                <Input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={saveDeal} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Deal Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
            <DialogDescription>Update deal information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Deal Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., 123 Main St Purchase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Value ($)</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div>
              <Label>Contact</Label>
              <Select value={formData.contactId} onValueChange={(val) => setFormData({ ...formData, contactId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.fullName || `${contact.firstName} ${contact.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stage</Label>
                <Select value={formData.stage} onValueChange={(val) => setFormData({ ...formData, stage: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Close Date</Label>
                <Input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={saveDeal} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

