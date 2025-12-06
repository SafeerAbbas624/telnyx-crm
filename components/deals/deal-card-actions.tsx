'use client';

import { Button } from '@/components/ui/button';
import { Deal } from '@/types/deals';
import { Phone, MessageSquare, Mail, CheckSquare, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCallUI } from '@/lib/context/call-ui-context';
import { useSmsUI } from '@/lib/context/sms-ui-context';
import { useEmailUI } from '@/lib/context/email-ui-context';
import { useTaskUI } from '@/lib/context/task-ui-context';

interface DealCardActionsProps {
  deal: Deal;
  onDealUpdated: () => void;
  onEdit?: () => void;
  showEditDelete?: boolean;
}

export default function DealCardActions({
  deal,
  onDealUpdated,
  onEdit,
  showEditDelete = false,
}: DealCardActionsProps) {
  const { openCall } = useCallUI();
  const { openSms } = useSmsUI();
  const { openEmail } = useEmailUI();
  const { openTask } = useTaskUI();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (deal as any).contactPhone;
    if (phone) {
      openCall({
        phoneNumber: phone,
        contact: { id: deal.contactId, fullName: deal.contactName }
      });
    } else {
      toast.error('No phone number available');
    }
  };

  const handleSms = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (deal as any).contactPhone;
    if (phone) {
      openSms({
        phoneNumber: phone,
        contact: { id: deal.contactId, fullName: deal.contactName }
      });
    } else {
      toast.error('No phone number available');
    }
  };

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    const email = (deal as any).contactEmail;
    if (email) {
      openEmail({
        email,
        contact: { id: deal.contactId, fullName: deal.contactName }
      });
    } else {
      toast.error('No email address available');
    }
  };

  const handleTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTask({
      contactId: deal.contactId,
      contact: { id: deal.contactId, fullName: deal.contactName },
      title: `Follow up: ${deal.title}`,
      description: `Task for deal: ${deal.title}\nValue: ${formatCurrency(deal.value)}`,
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this deal?')) return;
    
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Deal deleted');
        onDealUpdated();
      } else {
        toast.error('Failed to delete deal');
      }
    } catch (error) {
      toast.error('Failed to delete deal');
    }
  };

  return (
    <div className="flex items-center gap-1 pt-2 mt-2 border-t">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-blue-50"
        onClick={handleCall}
        title="Call"
      >
        <Phone className="h-3.5 w-3.5 text-blue-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-green-50"
        onClick={handleSms}
        title="Text"
      >
        <MessageSquare className="h-3.5 w-3.5 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-purple-50"
        onClick={handleEmail}
        title="Email"
      >
        <Mail className="h-3.5 w-3.5 text-purple-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-orange-50"
        onClick={handleTask}
        title="Create Task"
      >
        <CheckSquare className="h-3.5 w-3.5 text-orange-600" />
      </Button>
      
      <div className="flex-1" />
      
      {showEditDelete && (
        <>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Edit"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-red-50"
            onClick={handleDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </>
      )}
    </div>
  );
}

