import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'your-32-char-secret-key-here-123456'
const ALGORITHM = 'aes-256-cbc'

function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)
  return Buffer.from(key, 'utf8')
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string, iv?: string): string {
  try {
    // If IV is provided separately (new format)
    if (iv) {
      const ivBuffer = Buffer.from(iv, 'hex')
      const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), ivBuffer)
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }

    // Try new format first (with IV embedded)
    const parts = encryptedText.split(':')
    if (parts.length === 2) {
      const ivBuffer = Buffer.from(parts[0], 'hex')
      const encrypted = parts[1]
      const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), ivBuffer)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }
  } catch (error) {
    console.warn('Failed to decrypt with new method, trying legacy method:', error)
  }

  // Fallback to legacy method for backward compatibility
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Failed to decrypt with both methods:', error)
    return encryptedText
  }
}

