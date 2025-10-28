/**
 * Format currency values with proper notation (M for millions, K for thousands)
 * and comma separators
 */

export function formatCurrency(value: number, options: {
  showCents?: boolean;
  notation?: 'standard' | 'compact';
} = {}): string {
  const { showCents = false, notation = 'standard' } = options;

  // For compact notation (M/K)
  if (notation === 'compact') {
    if (value >= 1000000) {
      const millions = value / 1000000;
      return `$${millions.toFixed(millions % 1 === 0 ? 0 : 1)}M`;
    }
    if (value >= 1000) {
      const thousands = value / 1000;
      return `$${thousands.toFixed(thousands % 1 === 0 ? 0 : 1)}K`;
    }
  }

  // Standard notation with commas
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

/**
 * Format large numbers with K/M notation
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    const millions = value / 1000000;
    return `${millions.toFixed(millions % 1 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands.toFixed(thousands % 1 === 0 ? 0 : 1)}K`;
  }
  return value.toString();
}

/**
 * Add commas to numbers
 */
export function addCommas(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
