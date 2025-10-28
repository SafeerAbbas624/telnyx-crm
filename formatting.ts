/**
 * Format phone number as (XXX) XXX-XXXX
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  } else {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
}

/**
 * Format number with commas (e.g., 1000000 -> 1,000,000)
 */
export function formatNumberWithCommas(value: string | number): string {
  const numStr = typeof value === 'number' ? value.toString() : value;
  const cleaned = numStr.replace(/\D/g, '');
  
  if (!cleaned) return '';
  
  return parseInt(cleaned, 10).toLocaleString('en-US');
}

/**
 * Parse formatted number to raw number (remove commas)
 */
export function parseFormattedNumber(value: string): number {
  const cleaned = value.replace(/,/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Format currency (e.g., 1000000 -> $1,000,000)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
