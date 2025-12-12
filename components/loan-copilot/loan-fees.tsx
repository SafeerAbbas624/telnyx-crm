'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface LoanFeesProps {
  deal: any;
  onDealUpdated: () => void;
}

interface FeeItem {
  id: string;
  name: string;
  amount: string;
}

const DEFAULT_DSCR_FEES: FeeItem[] = [
  { id: 'underwriting', name: 'Underwriting Fee', amount: '2000' },
  { id: 'processing', name: 'Processing Fee', amount: '1000' },
];

const DEFAULT_BRIDGE_FEES: FeeItem[] = [
  { id: 'underwriting', name: 'Underwriting Fee', amount: '1500' },
  { id: 'processing', name: 'Processing Fee', amount: '1000' },
];

export default function LoanFees({ deal, onDealUpdated }: LoanFeesProps) {
  const [saving, setSaving] = useState(false);
  const isBridge = deal.loanType?.includes('Bridge');
  
  // Initialize fees from deal.loanCopilotData or defaults
  const [fees, setFees] = useState<FeeItem[]>(() => {
    if (deal.loanCopilotData?.fees) {
      return deal.loanCopilotData.fees;
    }
    return isBridge ? DEFAULT_BRIDGE_FEES : DEFAULT_DSCR_FEES;
  });

  const totalFees = useMemo(() => {
    return fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
  }, [fees]);

  const handleFeeChange = (id: string, field: 'name' | 'amount', value: string) => {
    setFees(fees.map(fee => 
      fee.id === id ? { ...fee, [field]: field === 'amount' ? value.replace(/[^0-9.]/g, '') : value } : fee
    ));
  };

  const addFee = () => {
    setFees([...fees, { id: `custom-${Date.now()}`, name: '', amount: '' }]);
  };

  const removeFee = (id: string) => {
    setFees(fees.filter(fee => fee.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save fees to loanCopilotData JSON field
      const loanCopilotData = {
        ...(deal.loanCopilotData || {}),
        fees,
      };
      
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanCopilotData }),
      });
      
      if (res.ok) {
        toast.success('Fees saved');
        onDealUpdated();
      } else {
        toast.error('Failed to save fees');
      }
    } catch (error) {
      console.error('Error saving fees:', error);
      toast.error('Failed to save fees');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Loan Fees
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-lg font-semibold">
              Total: {formatCurrency(totalFees)}
            </Badge>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fee Items */}
        {fees.map((fee, index) => (
          <div key={fee.id} className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                value={fee.name}
                onChange={(e) => handleFeeChange(fee.id, 'name', e.target.value)}
                placeholder="Fee name"
              />
            </div>
            <div className="w-32 relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                className="pl-7"
                value={fee.amount}
                onChange={(e) => handleFeeChange(fee.id, 'amount', e.target.value)}
                placeholder="0"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeFee(fee.id)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Add Fee Button */}
        <Button variant="outline" onClick={addFee} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Fee
        </Button>

        {/* Fee Summary */}
        <div className="pt-4 border-t">
          <div className="text-sm text-muted-foreground mb-2">Standard Fees:</div>
          <ul className="text-sm space-y-1">
            <li>• Underwriting: $2,000 (DSCR) / $1,500 (Bridge)</li>
            <li>• Processing: $1,000</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

