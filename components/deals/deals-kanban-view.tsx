'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Deal, PipelineStage } from '@/types/deals';
import { GripVertical, User, MapPin, Building2, Calendar, DollarSign, Percent, FileText, ExternalLink } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import ContactName from '@/components/contacts/contact-name';
import DealCardActions from './deal-card-actions';
import Link from 'next/link';

interface DealsKanbanViewProps {
  deals: Deal[];
  stages: PipelineStage[];
  isLoanPipeline: boolean;
  onStageChange: (dealId: string, newStageId: string) => void;
  onDealUpdated: () => void;
  onRefresh: () => void;
}

export default function DealsKanbanView({
  deals,
  stages,
  isLoanPipeline,
  onStageChange,
  onDealUpdated,
  onRefresh,
}: DealsKanbanViewProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const getDealsByStage = (stageKey: string) => {
    return deals.filter(d => d.stage === stageKey || d.stageId === stageKey);
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (stage: PipelineStage) => {
    if (!draggedDeal) return;
    onStageChange(draggedDeal.id, stage.id);
    setDraggedDeal(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getUrgencyColor = (expectedCloseDate?: string) => {
    if (!expectedCloseDate) return '';
    const closeDate = new Date(expectedCloseDate);
    const daysUntilClose = differenceInDays(closeDate, new Date());
    
    if (isPast(closeDate)) return 'border-l-4 border-l-red-500 bg-red-50';
    if (daysUntilClose <= 3) return 'border-l-4 border-l-orange-500 bg-orange-50';
    if (daysUntilClose <= 7) return 'border-l-4 border-l-yellow-500 bg-yellow-50';
    return '';
  };

  return (
    <div className="h-full overflow-x-auto p-4">
      <div className="flex gap-4 h-full min-w-max">
        {stages.map((stage) => {
          const stageDeals = getDealsByStage(stage.key);
          const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80 bg-gray-50 rounded-lg flex flex-col"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage)}
            >
              {/* Stage Header */}
              <div className="p-3 border-b bg-white rounded-t-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.color || '#e5e7eb' }}
                    />
                    <h3 className="font-semibold text-sm">{stage.label || stage.name}</h3>
                    <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                  </div>
                  {stage.defaultProbability !== undefined && (
                    <span className="text-xs text-muted-foreground">{stage.defaultProbability}%</span>
                  )}
                </div>
                <p className="text-sm font-medium text-green-600">{formatCurrency(stageValue)}</p>
              </div>

              {/* Deals List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => handleDragStart(deal)}
                    className={`bg-white rounded-lg p-3 shadow-sm border hover:shadow-md transition-shadow cursor-move ${getUrgencyColor(deal.expectedCloseDate)}`}
                  >
                    {/* Deal Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{deal.title}</h4>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(deal.value)}</p>
                        </div>
                      </div>
                      {isLoanPipeline && deal.isLoanDeal && (
                        <Link href={`/loan-copilot/${deal.id}`}>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Open Loan Copilot">
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                        </Link>
                      )}
                    </div>

                    {/* Contact & Property Info */}
                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <ContactName
                          contactId={deal.contactId}
                          contact={{ id: deal.contactId, fullName: deal.contactName }}
                          clickMode="popup"
                          className="text-xs truncate"
                        />
                      </div>
                      {deal.propertyAddress && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{deal.propertyAddress}</span>
                        </div>
                      )}
                      {deal.llcName && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{deal.llcName}</span>
                        </div>
                      )}
                    </div>

                    {/* Loan-specific fields */}
                    {isLoanPipeline && deal.isLoanDeal && (
                      <div className="mt-2 pt-2 border-t space-y-1 text-xs">
                        {deal.lenderName && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Lender:</span>
                            <span className="font-medium">{deal.lenderName}</span>
                          </div>
                        )}
                        {deal.loanType && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <Badge variant="outline" className="text-xs">{deal.loanType}</Badge>
                          </div>
                        )}
                        {deal.ltv && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">LTV:</span>
                            <span className="font-medium">{deal.ltv}%</span>
                          </div>
                        )}
                        {deal.dscr && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">DSCR:</span>
                            <span className="font-medium">{deal.dscr.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expected Close Date */}
                    {deal.expectedCloseDate && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                        <Calendar className="h-3 w-3" />
                        <span>Close: {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}

                    {/* Probability Bar */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Probability</span>
                        <span>{deal.probability}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <DealCardActions
                      deal={deal}
                      onDealUpdated={onDealUpdated}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

