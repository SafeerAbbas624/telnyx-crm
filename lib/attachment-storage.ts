/**
 * Attachment storage utilities
 * Handles saving and retrieving email attachments from the file system
 */

import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import crypto from 'crypto'

const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)
const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)
const stat = promisify(fs.stat)

// Base directory for attachments (relative to project root)
const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || 'public/uploads/attachments'

// Ensure attachments directory exists
export async function ensureAttachmentsDir(): Promise<string> {
  const fullPath = path.join(process.cwd(), ATTACHMENTS_DIR)
  
  try {
    await stat(fullPath)
  } catch (error) {
    // Directory doesn't exist, create it
    await mkdir(fullPath, { recursive: true })
    console.log(`📁 Created attachments directory: ${fullPath}`)
  }
  
  return fullPath
}

/**
 * Generate a unique filename for an attachment
 * @param originalFilename - Original filename
 * @returns Unique filename with timestamp and random hash
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now()
  const randomHash = crypto.randomBytes(8).toString('hex')
  const ext = path.extname(originalFilename)
  const nameWithoutExt = path.basename(originalFilename, ext)
  
  // Sanitize filename (remove special characters)
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_')
  
  return `${timestamp}-${randomHash}-${sanitized}${ext}`
}

/**
 * Save an attachment to disk
 * @param file - File object from FormData
 * @param messageId - Email message ID (for organization)
 * @returns Object with file path and URL
 */
export async function saveAttachment(
  file: File,
  messageId: string
): Promise<{
  filename: string
  originalFilename: string
  path: string
  url: string
  size: number
  contentType: string
}> {
  const attachmentsDir = await ensureAttachmentsDir()
  
  // Generate unique filename
  const uniqueFilename = generateUniqueFilename(file.name)
  
  // Create subdirectory by date (YYYY-MM)
  const date = new Date()
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const subDir = path.join(attachmentsDir, yearMonth)
  
  try {
    await stat(subDir)
  } catch (error) {
    await mkdir(subDir, { recursive: true })
  }
  
  // Full file path
  const filePath = path.join(subDir, uniqueFilename)
  
  // Convert File to Buffer
  const buffer = Buffer.from(await file.arrayBuffer())
  
  // Write file to disk
  await writeFile(filePath, buffer)
  
  // Generate public URL
  const relativePath = path.join(yearMonth, uniqueFilename)
  const publicUrl = `/uploads/attachments/${relativePath.replace(/\\/g, '/')}`
  
  console.log(`💾 Saved attachment: ${file.name} -> ${publicUrl}`)
  
  return {
    filename: uniqueFilename,
    originalFilename: file.name,
    path: filePath,
    url: publicUrl,
    size: file.size,
    contentType: file.type
  }
}

/**
 * Save multiple attachments
 * @param files - Array of File objects
 * @param messageId - Email message ID
 * @returns Array of saved attachment metadata
 */
export async function saveAttachments(
  files: File[],
  messageId: string
): Promise<Array<{
  filename: string
  originalFilename: string
  url: string
  size: number
  contentType: string
}>> {
  const results = []
  
  for (const file of files) {
    try {
      const saved = await saveAttachment(file, messageId)
      results.push({
        filename: saved.originalFilename,
        originalFilename: saved.originalFilename,
        url: saved.url,
        size: saved.size,
        contentType: saved.contentType
      })
    } catch (error) {
      console.error(`Failed to save attachment ${file.name}:`, error)
      // Continue with other files
    }
  }
  
  return results
}

/**
 * Save attachment from Buffer (for incoming emails)
 * @param buffer - File buffer
 * @param filename - Original filename
 * @param contentType - MIME type
 * @param messageId - Email message ID
 * @returns Saved attachment metadata
 */
export async function saveAttachmentFromBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
  messageId: string
): Promise<{
  filename: string
  originalFilename: string
  url: string
  size: number
  contentType: string
}> {
  const attachmentsDir = await ensureAttachmentsDir()
  
  // Generate unique filename
  const uniqueFilename = generateUniqueFilename(filename)
  
  // Create subdirectory by date (YYYY-MM)
  const date = new Date()
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const subDir = path.join(attachmentsDir, yearMonth)
  
  try {
    await stat(subDir)
  } catch (error) {
    await mkdir(subDir, { recursive: true })
  }
  
  // Full file path
  const filePath = path.join(subDir, uniqueFilename)
  
  // Write file to disk
  await writeFile(filePath, buffer)
  
  // Generate public URL
  const relativePath = path.join(yearMonth, uniqueFilename)
  const publicUrl = `/uploads/attachments/${relativePath.replace(/\\/g, '/')}`
  
  console.log(`💾 Saved attachment from buffer: ${filename} -> ${publicUrl}`)
  
  return {
    filename: uniqueFilename,
    originalFilename: filename,
    url: publicUrl,
    size: buffer.length,
    contentType
  }
}

/**
 * Delete an attachment file
 * @param url - Public URL of the attachment
 * @returns true if deleted, false if not found
 */
export async function deleteAttachment(url: string): Promise<boolean> {
  try {
    // Convert URL to file path
    const relativePath = url.replace('/uploads/attachments/', '')
    const attachmentsDir = await ensureAttachmentsDir()
    const filePath = path.join(attachmentsDir, relativePath)
    
    await unlink(filePath)
    console.log(`🗑️ Deleted attachment: ${url}`)
    return true
  } catch (error) {
    console.error(`Failed to delete attachment ${url}:`, error)
    return false
  }
}

/**
 * Get attachment file path from URL
 * @param url - Public URL of the attachment
 * @returns Full file path
 */
export function getAttachmentPath(url: string): string {
  const relativePath = url.replace('/uploads/attachments/', '')
  const attachmentsDir = path.join(process.cwd(), ATTACHMENTS_DIR)
  return path.join(attachmentsDir, relativePath)
}

/**
 * Check if attachment exists
 * @param url - Public URL of the attachment
 * @returns true if exists, false otherwise
 */
export async function attachmentExists(url: string): Promise<boolean> {
  try {
    const filePath = getAttachmentPath(url)
    await stat(filePath)
    return true
  } catch (error) {
    return false
  }
}

