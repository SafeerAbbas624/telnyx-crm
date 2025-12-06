'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Deal, PipelineStage } from '@/types/deals';
import { format, differenceInDays, isPast } from 'date-fns';
import { FileText, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import ContactName from '@/components/contacts/contact-name';
import DealCardActions from './deal-card-actions';
import Link from 'next/link';
import { toast } from 'sonner';

interface DealsTableViewProps {
  deals: Deal[];
  stages: PipelineStage[];
  isLoanPipeline: boolean;
  onDealUpdated: () => void;
  onRefresh: () => void;
}

type SortField = 'title' | 'value' | 'contactName' | 'stage' | 'expectedCloseDate' | 'probability';
type SortDirection = 'asc' | 'desc';

export default function DealsTableView({
  deals,
  stages,
  isLoanPipeline,
  onDealUpdated,
  onRefresh,
}: DealsTableViewProps) {
  const [sortField, setSortField] = useState<SortField>('expectedCloseDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getUrgencyBadge = (expectedCloseDate?: string) => {
    if (!expectedCloseDate) return null;
    const closeDate = new Date(expectedCloseDate);
    const daysUntilClose = differenceInDays(closeDate, new Date());
    
    if (isPast(closeDate)) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    }
    if (daysUntilClose <= 3) {
      return <Badge className="bg-orange-500 text-xs">Due Soon</Badge>;
    }
    if (daysUntilClose <= 7) {
      return <Badge className="bg-yellow-500 text-xs">This Week</Badge>;
    }
    return null;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedDeals = [...deals].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'value':
        comparison = (a.value || 0) - (b.value || 0);
        break;
      case 'contactName':
        comparison = (a.contactName || '').localeCompare(b.contactName || '');
        break;
      case 'stage':
        comparison = (a.stage || '').localeCompare(b.stage || '');
        break;
      case 'expectedCloseDate':
        const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : Infinity;
        const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : Infinity;
        comparison = dateA - dateB;
        break;
      case 'probability':
        comparison = (a.probability || 0) - (b.probability || 0);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleStageChange = async (dealId: string, newStageKey: string) => {
    const deal = deals.find(d => d.id === dealId);
    const stage = stages.find(s => s.key === newStageKey);
    if (!deal || !stage) return;

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deal.title,
          contact_id: deal.contactId,
          stage_id: stage.id,
          value: deal.value,
          probability: stage.defaultProbability || deal.probability,
        })
      });

      if (res.ok) {
        toast.success('Deal stage updated');
        onRefresh();
      } else {
        toast.error('Failed to update stage');
      }
    } catch (error) {
      toast.error('Failed to update stage');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 inline ml-1" /> : 
      <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>
                Deal <SortIcon field="title" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('contactName')}>
                Contact <SortIcon field="contactName" />
              </TableHead>
              <TableHead>Property / LLC</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('stage')}>
                Stage <SortIcon field="stage" />
              </TableHead>
              {isLoanPipeline && <TableHead>Lender</TableHead>}
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('value')}>
                Value <SortIcon field="value" />
              </TableHead>
              {isLoanPipeline && <TableHead className="text-right">LTV</TableHead>}
              <TableHead className="cursor-pointer text-right" onClick={() => handleSort('probability')}>
                Prob <SortIcon field="probability" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('expectedCloseDate')}>
                Close Date <SortIcon field="expectedCloseDate" />
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDeals.map((deal) => (
              <TableRow key={deal.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{deal.title}</span>
                    {isLoanPipeline && deal.isLoanDeal && (
                      <Link href={`/loan-copilot/${deal.id}`}>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Open Loan Copilot">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ContactName
                    contactId={deal.contactId}
                    contact={{ id: deal.contactId, fullName: deal.contactName }}
                    clickMode="popup"
                    className="text-sm"
                  />
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {deal.propertyAddress && <div className="truncate max-w-[200px]">{deal.propertyAddress}</div>}
                    {deal.llcName && <div className="text-muted-foreground text-xs truncate">{deal.llcName}</div>}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={deal.stage}
                    onValueChange={(value) => handleStageChange(deal.id, value)}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.key}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: stage.color || '#e5e7eb' }}
                            />
                            {stage.label || stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {isLoanPipeline && (
                  <TableCell>
                    <div className="text-sm">
                      {deal.lenderName || '-'}
                      {deal.loanType && (
                        <Badge variant="outline" className="ml-2 text-xs">{deal.loanType}</Badge>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right font-medium text-green-600">
                  {formatCurrency(deal.value)}
                </TableCell>
                {isLoanPipeline && (
                  <TableCell className="text-right">
                    {deal.ltv ? `${deal.ltv}%` : '-'}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${deal.probability}%` }}
                      />
                    </div>
                    <span className="text-sm w-8">{deal.probability}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {deal.expectedCloseDate ? (
                      <span className="text-sm">
                        {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}
                      </span>
                    ) : '-'}
                    {getUrgencyBadge(deal.expectedCloseDate)}
                  </div>
                </TableCell>
                <TableCell>
                  <DealCardActions
                    deal={deal}
                    onDealUpdated={onDealUpdated}
                    showEditDelete={true}
                  />
                </TableCell>
              </TableRow>
            ))}
            {sortedDeals.length === 0 && (
              <TableRow>
                <TableCell colSpan={isLoanPipeline ? 10 : 8} className="text-center py-8 text-muted-foreground">
                  No deals found. Create your first deal to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

