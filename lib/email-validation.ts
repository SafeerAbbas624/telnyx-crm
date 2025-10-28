/**
 * Email validation utilities
 */

/**
 * Validates a single email address
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Trim whitespace
  email = email.trim()

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return false
  }

  // Additional checks
  const parts = email.split('@')
  if (parts.length !== 2) {
    return false
  }

  const [localPart, domain] = parts

  // Local part checks
  if (localPart.length === 0 || localPart.length > 64) {
    return false
  }

  // Domain checks
  if (domain.length === 0 || domain.length > 255) {
    return false
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return false
  }

  // Domain parts check
  const domainParts = domain.split('.')
  for (const part of domainParts) {
    if (part.length === 0) {
      return false
    }
  }

  return true
}

/**
 * Validates an array of email addresses
 * @param emails - Array of email addresses to validate
 * @returns Object with valid emails and invalid emails
 */
export function validateEmails(emails: string[]): {
  valid: string[]
  invalid: string[]
  allValid: boolean
} {
  const valid: string[] = []
  const invalid: string[] = []

  for (const email of emails) {
    const trimmed = email.trim()
    if (isValidEmail(trimmed)) {
      valid.push(trimmed)
    } else {
      invalid.push(trimmed)
    }
  }

  return {
    valid,
    invalid,
    allValid: invalid.length === 0
  }
}

/**
 * Parses a comma-separated string of emails
 * @param emailString - Comma-separated email addresses
 * @returns Array of trimmed email addresses
 */
export function parseEmailString(emailString: string): string[] {
  if (!emailString || typeof emailString !== 'string') {
    return []
  }

  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0)
}

/**
 * Validates and parses a comma-separated string of emails
 * @param emailString - Comma-separated email addresses
 * @returns Object with valid emails, invalid emails, and validation status
 */
export function validateEmailString(emailString: string): {
  valid: string[]
  invalid: string[]
  allValid: boolean
  isEmpty: boolean
} {
  const emails = parseEmailString(emailString)
  
  if (emails.length === 0) {
    return {
      valid: [],
      invalid: [],
      allValid: true,
      isEmpty: true
    }
  }

  const result = validateEmails(emails)
  
  return {
    ...result,
    isEmpty: false
  }
}

/**
 * Gets a user-friendly error message for invalid emails
 * @param invalidEmails - Array of invalid email addresses
 * @returns Error message string
 */
export function getEmailValidationError(invalidEmails: string[]): string {
  if (invalidEmails.length === 0) {
    return ''
  }

  if (invalidEmails.length === 1) {
    return `Invalid email address: ${invalidEmails[0]}`
  }

  if (invalidEmails.length <= 3) {
    return `Invalid email addresses: ${invalidEmails.join(', ')}`
  }

  return `${invalidEmails.length} invalid email addresses: ${invalidEmails.slice(0, 3).join(', ')}...`
}

