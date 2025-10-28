/**
 * Email threading utilities
 * Handles email thread identification and grouping
 */

/**
 * Generate a thread ID from subject
 * Removes Re:, Fwd:, etc. and normalizes the subject
 */
export function generateThreadIdFromSubject(subject: string): string {
  if (!subject) return ''
  
  // Remove common prefixes (case insensitive)
  let normalized = subject
    .replace(/^(re|fw|fwd|aw):\s*/gi, '')
    .trim()
    .toLowerCase()
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ')
  
  // Create a simple hash
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return `thread-${Math.abs(hash)}`
}

/**
 * Extract thread ID from email headers
 * Uses In-Reply-To and References headers for accurate threading
 */
export function extractThreadId(
  messageId: string | null,
  inReplyTo: string | null,
  references: string[] | null,
  subject: string
): string {
  // If this is a reply, use the In-Reply-To or first Reference as thread ID
  if (inReplyTo) {
    return inReplyTo
  }
  
  if (references && references.length > 0) {
    return references[0]
  }
  
  // If no reply headers, use the message ID as the thread starter
  if (messageId) {
    return messageId
  }
  
  // Fallback to subject-based threading
  return generateThreadIdFromSubject(subject)
}

/**
 * Parse References header from email
 * References header contains all Message-IDs in the thread
 */
export function parseReferences(referencesHeader: string | null | any): string[] {
  if (!referencesHeader) return []

  // Convert to string if it's not already
  const refString = typeof referencesHeader === 'string' ? referencesHeader : String(referencesHeader)

  // References are space-separated Message-IDs in angle brackets
  // Example: <msg1@example.com> <msg2@example.com>
  const matches = refString.match(/<[^>]+>/g)
  if (!matches) return []

  return matches.map(ref => ref.replace(/[<>]/g, ''))
}

/**
 * Parse In-Reply-To header from email
 */
export function parseInReplyTo(inReplyToHeader: string | null | any): string | null {
  if (!inReplyToHeader) return null

  // Convert to string if it's not already
  const replyString = typeof inReplyToHeader === 'string' ? inReplyToHeader : String(inReplyToHeader)

  // In-Reply-To is a single Message-ID in angle brackets
  const match = replyString.match(/<([^>]+)>/)
  return match ? match[1] : replyString.trim()
}

/**
 * Build References header for a reply
 * Includes all previous references plus the message being replied to
 */
export function buildReferences(
  originalReferences: string[],
  originalMessageId: string
): string[] {
  const references = [...originalReferences]
  
  // Add the original message ID if not already in references
  if (originalMessageId && !references.includes(originalMessageId)) {
    references.push(originalMessageId)
  }
  
  return references
}

/**
 * Check if an email is part of a thread
 */
export function isThreadedEmail(
  inReplyTo: string | null,
  references: string[] | null
): boolean {
  return !!(inReplyTo || (references && references.length > 0))
}

/**
 * Get thread subject (removes Re:, Fwd:, etc.)
 */
export function getThreadSubject(subject: string): string {
  if (!subject) return ''
  
  return subject
    .replace(/^(re|fw|fwd|aw):\s*/gi, '')
    .trim()
}

/**
 * Check if subject indicates a reply
 */
export function isReplySubject(subject: string): boolean {
  if (!subject) return false
  return /^re:\s*/i.test(subject)
}

/**
 * Check if subject indicates a forward
 */
export function isForwardSubject(subject: string): boolean {
  if (!subject) return false
  return /^(fw|fwd):\s*/i.test(subject)
}

/**
 * Format subject for reply
 */
export function formatReplySubject(subject: string): string {
  if (!subject) return 'Re: '
  
  // Don't add Re: if already present
  if (isReplySubject(subject)) {
    return subject
  }
  
  return `Re: ${subject}`
}

/**
 * Format subject for forward
 */
export function formatForwardSubject(subject: string): string {
  if (!subject) return 'Fwd: '
  
  // Don't add Fwd: if already present
  if (isForwardSubject(subject)) {
    return subject
  }
  
  return `Fwd: ${subject}`
}

