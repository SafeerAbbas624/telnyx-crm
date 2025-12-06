'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Pipeline, PipelineStage, Lender } from '@/types/deals';

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  propertyAddress?: string;
  llcName?: string;
}

interface NewDealDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: Pipeline;
  lenders: Lender[];
  isLoanPipeline: boolean;
  onSuccess: () => void;
}

export default function NewDealDialogV2({
  open,
  onOpenChange,
  pipeline,
  lenders,
  isLoanPipeline,
  onSuccess,
}: NewDealDialogV2Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    contactId: '',
    stageId: '',
    expectedCloseDate: '',
    notes: '',
    // Loan-specific fields
    isLoanDeal: isLoanPipeline,
    lenderId: '',
    llcName: '',
    propertyAddress: '',
    loanAmount: '',
    propertyValue: '',
    loanType: '',
    interestRate: '',
  });

  useEffect(() => {
    if (open) {
      loadContacts();
      // Set default stage
      if (pipeline?.stages?.length) {
        setFormData(prev => ({ ...prev, stageId: pipeline.stages[0].id }));
      }
    }
  }, [open, pipeline]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, isLoanDeal: isLoanPipeline }));
  }, [isLoanPipeline]);

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

  const handleContactChange = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    setFormData(prev => ({
      ...prev,
      contactId,
      propertyAddress: contact?.propertyAddress || prev.propertyAddress,
      llcName: contact?.llcName || prev.llcName,
    }));
  };

  const calculateLTV = () => {
    const loanAmount = parseFloat(formData.loanAmount) || 0;
    const propertyValue = parseFloat(formData.propertyValue) || 0;
    if (propertyValue > 0) {
      return ((loanAmount / propertyValue) * 100).toFixed(1);
    }
    return '0';
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.contactId) {
      toast.error('Title and contact are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.title,
          value: parseFloat(formData.value) || 0,
          contact_id: formData.contactId,
          stage_id: formData.stageId || null,
          expected_close_date: formData.expectedCloseDate || null,
          notes: formData.notes,
          pipeline: pipeline?.id || 'default',
          // Loan-specific fields
          is_loan_deal: formData.isLoanDeal,
          lender_id: formData.lenderId || null,
          llc_name: formData.llcName || null,
          property_address: formData.propertyAddress || null,
          loan_amount: formData.loanAmount ? parseFloat(formData.loanAmount) : null,
          property_value: formData.propertyValue ? parseFloat(formData.propertyValue) : null,
          ltv: formData.propertyValue ? parseFloat(calculateLTV()) : null,
          loan_type: formData.loanType || null,
          interest_rate: formData.interestRate ? parseFloat(formData.interestRate) : null,
        })
      });

      if (res.ok) {
        onSuccess();
        resetForm();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create deal');
      }
    } catch (error) {
      toast.error('Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', value: '', contactId: '', stageId: pipeline?.stages?.[0]?.id || '',
      expectedCloseDate: '', notes: '', isLoanDeal: isLoanPipeline, lenderId: '',
      llcName: '', propertyAddress: '', loanAmount: '', propertyValue: '',
      loanType: '', interestRate: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New {isLoanPipeline ? 'Loan' : 'Deal'}</DialogTitle>
          <DialogDescription>
            Add a new {isLoanPipeline ? 'loan' : 'deal'} to {pipeline?.name || 'the pipeline'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Deal Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={isLoanPipeline ? "e.g., 123 Main St - DSCR Loan" : "e.g., Property Purchase"}
              />
            </div>
            <div>
              <Label>Contact *</Label>
              <Select value={formData.contactId} onValueChange={handleContactChange}>
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
            <div>
              <Label>Stage</Label>
              <Select value={formData.stageId} onValueChange={(val) => setFormData({ ...formData, stageId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {pipeline?.stages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color || '#e5e7eb' }} />
                        {stage.label || stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Value & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Deal Value ($)</Label>
              <Input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="0"
              />
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

          {/* Property Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Property Address</Label>
              <Input
                value={formData.propertyAddress}
                onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>
            <div>
              <Label>LLC Name</Label>
              <Input
                value={formData.llcName}
                onChange={(e) => setFormData({ ...formData, llcName: e.target.value })}
                placeholder="Borrowing Entity LLC"
              />
            </div>
          </div>

          {/* Loan-specific fields */}
          {isLoanPipeline && (
            <>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Loan Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lender</Label>
                    <Select value={formData.lenderId} onValueChange={(val) => setFormData({ ...formData, lenderId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lender" />
                      </SelectTrigger>
                      <SelectContent>
                        {lenders.map((lender) => (
                          <SelectItem key={lender.id} value={lender.id}>
                            {lender.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Loan Type</Label>
                    <Select value={formData.loanType} onValueChange={(val) => setFormData({ ...formData, loanType: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Purchase">Purchase</SelectItem>
                        <SelectItem value="Refinance">Refinance</SelectItem>
                        <SelectItem value="Cash Out">Cash Out</SelectItem>
                        <SelectItem value="DSCR">DSCR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Loan Amount ($)</Label>
                    <Input
                      type="number"
                      value={formData.loanAmount}
                      onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Property Value ($)</Label>
                    <Input
                      type="number"
                      value={formData.propertyValue}
                      onChange={(e) => setFormData({ ...formData, propertyValue: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>LTV (%)</Label>
                    <Input value={calculateLTV()} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.125"
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create {isLoanPipeline ? 'Loan' : 'Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

