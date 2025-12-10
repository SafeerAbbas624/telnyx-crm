/**
 * SMS Pricing Configuration
 * 
 * Telnyx pricing is per-segment, not per-message.
 * Prices vary by destination country and message type.
 */

import { calculateSmsSegments, type SmsSegmentInfo } from './segments';

// Default pricing (USD) - can be overridden by environment variables
// Includes Telnyx platform fee + carrier fees (10DLC registered)
// Telnyx ~$0.004 + Carrier fees ~$0.003 = ~$0.007 total per segment
export const SMS_PRICING = {
  // Outbound SMS pricing per segment (platform + carrier fees)
  outbound: {
    us: parseFloat(process.env.SMS_PRICE_OUTBOUND_US || '0.007'),
    ca: parseFloat(process.env.SMS_PRICE_OUTBOUND_CA || '0.009'),
    international: parseFloat(process.env.SMS_PRICE_OUTBOUND_INTL || '0.020'),
  },
  // Inbound SMS pricing per segment
  inbound: {
    us: parseFloat(process.env.SMS_PRICE_INBOUND_US || '0.004'),
    ca: parseFloat(process.env.SMS_PRICE_INBOUND_CA || '0.006'),
    international: parseFloat(process.env.SMS_PRICE_INBOUND_INTL || '0.012'),
  },
  // MMS pricing (flat rate per message, not per segment)
  mms: {
    outbound: parseFloat(process.env.MMS_PRICE_OUTBOUND || '0.020'),
    inbound: parseFloat(process.env.MMS_PRICE_INBOUND || '0.012'),
  },
};

export type SmsDirection = 'outbound' | 'inbound';
export type SmsRegion = 'us' | 'ca' | 'international';

/**
 * Determine the region based on phone number
 */
export function getRegionFromPhoneNumber(phoneNumber: string): SmsRegion {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // US numbers: +1 followed by 10 digits, area codes 2xx-9xx
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    const areaCode = cleaned.substring(1, 4);
    // Canadian area codes
    const canadianAreaCodes = [
      '204', '226', '236', '249', '250', '289', '306', '343', '365', '367',
      '403', '416', '418', '431', '437', '438', '450', '506', '514', '519',
      '548', '579', '581', '587', '604', '613', '639', '647', '672', '705',
      '709', '778', '780', '782', '807', '819', '825', '867', '873', '902',
      '905', '506', '709', '867'
    ];
    if (canadianAreaCodes.includes(areaCode)) {
      return 'ca';
    }
    return 'us';
  }
  
  // Default to international for other formats
  return 'international';
}

/**
 * Get the price per segment for a given direction and region
 */
export function getPricePerSegment(direction: SmsDirection, region: SmsRegion): number {
  return SMS_PRICING[direction][region];
}

/**
 * Calculate the total cost for an SMS message
 */
export function calculateSmsCost(
  message: string,
  direction: SmsDirection,
  destinationNumber: string
): SmsCostInfo {
  const segmentInfo = calculateSmsSegments(message);
  const region = getRegionFromPhoneNumber(destinationNumber);
  const pricePerSegment = getPricePerSegment(direction, region);
  const totalCost = segmentInfo.segmentCount * pricePerSegment;
  
  return {
    ...segmentInfo,
    region,
    direction,
    pricePerSegment,
    totalCost,
  };
}

export interface SmsCostInfo extends SmsSegmentInfo {
  region: SmsRegion;
  direction: SmsDirection;
  pricePerSegment: number;
  totalCost: number;
}

/**
 * Format cost as currency string
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

/**
 * Format cost for display (shorter format)
 */
export function formatCostShort(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost);
}

/**
 * Estimate total cost for a text blast campaign
 */
export function estimateTextBlastCost(
  message: string,
  recipientCount: number,
  region: SmsRegion = 'us'
): TextBlastCostEstimate {
  const segmentInfo = calculateSmsSegments(message);
  const pricePerSegment = getPricePerSegment('outbound', region);
  const costPerRecipient = segmentInfo.segmentCount * pricePerSegment;
  const totalCost = costPerRecipient * recipientCount;
  
  return {
    ...segmentInfo,
    recipientCount,
    costPerRecipient,
    totalCost,
    pricePerSegment,
    region,
  };
}

export interface TextBlastCostEstimate extends SmsSegmentInfo {
  recipientCount: number;
  costPerRecipient: number;
  totalCost: number;
  pricePerSegment: number;
  region: SmsRegion;
}

