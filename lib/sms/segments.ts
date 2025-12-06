/**
 * SMS Segment Counting Utility
 * 
 * SMS messages are split into segments based on character encoding:
 * - GSM-7: 160 chars for single segment, 153 chars per segment for concatenated
 * - Unicode (UCS-2): 70 chars for single segment, 67 chars per segment for concatenated
 */

// GSM-7 basic character set (standard SMS characters)
const GSM_7_BASIC_CHARS = new Set([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à',
]);

// GSM-7 extended characters (count as 2 characters)
const GSM_7_EXTENDED_CHARS = new Set([
  '|', '^', '€', '{', '}', '[', ']', '~', '\\'
]);

export type SmsEncoding = 'GSM-7' | 'Unicode';

export interface SmsSegmentInfo {
  /** Total character count */
  characterCount: number;
  /** Number of SMS segments */
  segmentCount: number;
  /** Encoding type used */
  encoding: SmsEncoding;
  /** Characters remaining in current segment */
  remainingInSegment: number;
  /** Maximum characters per segment for this encoding */
  maxPerSegment: number;
  /** Whether the message uses concatenated segments */
  isConcatenated: boolean;
  /** GSM-7 character count (accounting for extended chars counting as 2) */
  gsm7CharCount: number;
}

/**
 * Check if a character is in the GSM-7 basic character set
 */
function isGsm7BasicChar(char: string): boolean {
  return GSM_7_BASIC_CHARS.has(char);
}

/**
 * Check if a character is in the GSM-7 extended character set
 */
function isGsm7ExtendedChar(char: string): boolean {
  return GSM_7_EXTENDED_CHARS.has(char);
}

/**
 * Determine if a message can be encoded using GSM-7
 */
export function isGsm7Compatible(message: string): boolean {
  for (const char of message) {
    if (!isGsm7BasicChar(char) && !isGsm7ExtendedChar(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Count GSM-7 characters (extended chars count as 2)
 */
export function countGsm7Characters(message: string): number {
  let count = 0;
  for (const char of message) {
    if (isGsm7ExtendedChar(char)) {
      count += 2; // Extended chars use escape sequence
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * Calculate SMS segment information for a message
 */
export function calculateSmsSegments(message: string): SmsSegmentInfo {
  if (!message || message.length === 0) {
    return {
      characterCount: 0,
      segmentCount: 0,
      encoding: 'GSM-7',
      remainingInSegment: 160,
      maxPerSegment: 160,
      isConcatenated: false,
      gsm7CharCount: 0,
    };
  }

  const isGsm7 = isGsm7Compatible(message);
  const encoding: SmsEncoding = isGsm7 ? 'GSM-7' : 'Unicode';
  
  // Character limits
  const singleSegmentLimit = isGsm7 ? 160 : 70;
  const concatenatedSegmentLimit = isGsm7 ? 153 : 67;
  
  // Calculate effective character count
  const effectiveCharCount = isGsm7 ? countGsm7Characters(message) : message.length;
  
  // Determine segment count
  let segmentCount: number;
  let isConcatenated: boolean;
  let maxPerSegment: number;
  
  if (effectiveCharCount <= singleSegmentLimit) {
    segmentCount = effectiveCharCount > 0 ? 1 : 0;
    isConcatenated = false;
    maxPerSegment = singleSegmentLimit;
  } else {
    segmentCount = Math.ceil(effectiveCharCount / concatenatedSegmentLimit);
    isConcatenated = true;
    maxPerSegment = concatenatedSegmentLimit;
  }
  
  // Calculate remaining characters in current segment
  const usedInCurrentSegment = isConcatenated
    ? effectiveCharCount % concatenatedSegmentLimit || concatenatedSegmentLimit
    : effectiveCharCount;
  const remainingInSegment = maxPerSegment - usedInCurrentSegment;
  
  return {
    characterCount: message.length,
    segmentCount,
    encoding,
    remainingInSegment: Math.max(0, remainingInSegment),
    maxPerSegment,
    isConcatenated,
    gsm7CharCount: isGsm7 ? effectiveCharCount : message.length,
  };
}

/**
 * Get a human-readable description of the segment info
 */
export function getSegmentDescription(info: SmsSegmentInfo): string {
  if (info.segmentCount === 0) return 'Empty message';
  if (info.segmentCount === 1) return `1 segment (${info.encoding})`;
  return `${info.segmentCount} segments (${info.encoding})`;
}

