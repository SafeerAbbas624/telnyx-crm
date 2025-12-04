/**
 * Format phone number to pretty display format: +1 (305) 333-3344
 * Handles various input formats and normalizes them
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If empty after cleaning, return empty
  if (!cleaned) return '';
  
  // Extract digits only (remove +)
  const digits = cleaned.replace(/\+/g, '');
  
  // Handle different lengths
  if (digits.length === 10) {
    // US number without country code: 3055551234 -> +1 (305) 555-1234
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    // US number with country code: 13055551234 -> +1 (305) 555-1234
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 11) {
    // International number: 44XXXXXXXXXX -> +44 XXXXXXXXXX
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  } else if (digits.length > 11) {
    // Long international number
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  } else if (digits.length === 7) {
    // Local number: 5551234 -> 555-1234
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  
  // Return as-is if we can't format it
  return phone;
}

/**
 * Format phone number for display in compact spaces
 * Returns shorter format without country code if US number
 */
export function formatPhoneNumberCompact(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\+/g, '');
  
  if (digits.length === 10) {
    // 3055551234 -> (305) 555-1234
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    // 13055551234 -> (305) 555-1234
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // For non-US numbers, use full format
  return formatPhoneNumber(phone);
}

