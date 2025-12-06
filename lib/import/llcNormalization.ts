/**
 * Utility functions for LLC name normalization
 */

/**
 * Normalize an LLC name:
 * - Convert to title case for each word
 * - Force "LLC" to uppercase wherever it appears
 * - Handle common business suffixes properly
 * 
 * @example
 * normalizeLlcName("dorronsoro construction and re llc")
 * // Returns: "Dorronsoro Construction And Re LLC"
 * 
 * normalizeLlcName("JOHN SMITH PROPERTIES LLC")
 * // Returns: "John Smith Properties LLC"
 */
export function normalizeLlcName(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  
  const trimmed = raw.trim();
  if (!trimmed) return null;
  
  // Business suffixes that should be uppercase
  const uppercaseSuffixes = ['LLC', 'LP', 'LLP', 'INC', 'CORP', 'CO', 'LTD', 'PLLC', 'PC'];
  
  // Articles and prepositions that should stay lowercase (unless first word)
  const lowercaseWords = ['and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for'];
  
  // Split by spaces and process each word
  const words = trimmed.split(/\s+/);
  
  const normalized = words.map((word, index) => {
    const upperWord = word.toUpperCase();
    
    // Check if it's a business suffix that should be uppercase
    if (uppercaseSuffixes.includes(upperWord)) {
      return upperWord;
    }
    
    // Check if it's a lowercase word (except first word)
    if (index > 0 && lowercaseWords.includes(word.toLowerCase())) {
      return word.toLowerCase();
    }
    
    // Title case the word
    return toTitleCase(word);
  });
  
  return normalized.join(' ');
}

/**
 * Convert a word to title case (first letter uppercase, rest lowercase)
 */
function toTitleCase(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Normalize phone number for import - handles various CSV formats
 * including numbers stored as floats (e.g., "1234567890.0")
 */
export function normalizePhoneForImport(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  let cleaned = String(phone).trim();
  
  // Handle numbers stored as floats in CSV (e.g., "1234567890.0")
  if (cleaned.includes('.')) {
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      cleaned = Math.floor(parsed).toString();
    }
  }
  
  // Remove all non-digit characters except leading +
  const hasPlus = cleaned.startsWith('+');
  const digitsOnly = cleaned.replace(/\D/g, '');
  
  // Validate minimum length (7 digits is minimum for any phone)
  if (digitsOnly.length < 7) {
    return null;
  }
  
  // Return digits with + prefix if needed
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  } else if (digitsOnly.length > 11) {
    return `+${digitsOnly}`;
  } else if (hasPlus) {
    return `+${digitsOnly}`;
  }
  
  // Return null if can't form valid phone
  return null;
}

/**
 * Check if a phone value should be treated as "no phone"
 */
export function isNoPhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  
  const cleaned = String(phone).toLowerCase().trim();
  
  // Check for null-like values
  if (!cleaned || cleaned === 'none' || cleaned === 'nan' || 
      cleaned === 'null' || cleaned === 'n/a' || cleaned === 'na' ||
      cleaned === '-' || cleaned === '0') {
    return true;
  }
  
  // Check if normalized phone is valid
  const normalized = normalizePhoneForImport(phone);
  return normalized === null;
}

