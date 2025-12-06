'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertTriangle } from 'lucide-react';
import { calculateSmsSegments, type SmsSegmentInfo as SegmentInfo } from '@/lib/sms/segments';
import { formatCostShort, estimateTextBlastCost, type SmsRegion } from '@/lib/sms/pricing';
import { cn } from '@/lib/utils';

interface SmsSegmentInfoProps {
  message: string;
  recipientCount?: number;
  region?: SmsRegion;
  showCost?: boolean;
  className?: string;
  compact?: boolean;
}

export function SmsSegmentInfo({
  message,
  recipientCount = 1,
  region = 'us',
  showCost = true,
  className,
  compact = false,
}: SmsSegmentInfoProps) {
  const segmentInfo = useMemo(() => calculateSmsSegments(message), [message]);
  const costEstimate = useMemo(
    () => showCost ? estimateTextBlastCost(message, recipientCount, region) : null,
    [message, recipientCount, region, showCost]
  );

  const isUnicode = segmentInfo.encoding === 'Unicode';
  const isMultiSegment = segmentInfo.segmentCount > 1;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
        <span>{segmentInfo.characterCount} chars</span>
        <span>•</span>
        <span className={cn(isMultiSegment && 'text-amber-600 font-medium')}>
          {segmentInfo.segmentCount} {segmentInfo.segmentCount === 1 ? 'segment' : 'segments'}
        </span>
        {isUnicode && (
          <>
            <span>•</span>
            <Badge variant="outline" className="text-xs py-0 h-5">Unicode</Badge>
          </>
        )}
        {showCost && costEstimate && (
          <>
            <span>•</span>
            <span className="font-medium">{formatCostShort(costEstimate.totalCost)}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
        {/* Character count */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Characters:</span>
          <span className="font-medium">{segmentInfo.characterCount}</span>
          {segmentInfo.encoding === 'GSM-7' && segmentInfo.gsm7CharCount !== segmentInfo.characterCount && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>GSM-7 count: {segmentInfo.gsm7CharCount} (some chars count as 2)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <span className="text-muted-foreground">•</span>

        {/* Segment count */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Segments:</span>
          <span className={cn('font-medium', isMultiSegment && 'text-amber-600')}>
            {segmentInfo.segmentCount}
          </span>
          {isMultiSegment && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Long messages are split into multiple segments.</p>
                <p>Each segment is billed separately.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <span className="text-muted-foreground">•</span>

        {/* Encoding */}
        <div className="flex items-center gap-1">
          <Badge 
            variant={isUnicode ? 'secondary' : 'outline'} 
            className={cn('text-xs', isUnicode && 'bg-amber-100 text-amber-800 border-amber-200')}
          >
            {segmentInfo.encoding}
          </Badge>
          {isUnicode && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Unicode encoding detected (emojis or special characters).</p>
                <p>Max {segmentInfo.maxPerSegment} chars per segment instead of 160.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Remaining characters */}
        {segmentInfo.segmentCount > 0 && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground text-xs">
              {segmentInfo.remainingInSegment} chars left in segment
            </span>
          </>
        )}

        {/* Cost estimate */}
        {showCost && costEstimate && (
          <>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Est. cost:</span>
              <span className="font-medium text-green-600">
                {formatCostShort(costEstimate.totalCost)}
              </span>
              {recipientCount > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({formatCostShort(costEstimate.costPerRecipient)}/msg × {recipientCount})
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

