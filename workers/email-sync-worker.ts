import { Job } from 'bull'
import { emailSyncQueue, EmailSyncJob } from '@/lib/queues/email-sync-queue'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import * as Imap from 'imap-simple'
import { simpleParser } from 'mailparser'
import { redisPublisher } from '@/lib/redis'
import { saveAttachmentFromBuffer } from '@/lib/attachment-storage'
import { extractThreadId, parseReferences, parseInReplyTo } from '@/lib/email-threading'

// IMAP configuration helper
function getImapConfig(account: any, password: string) {
  // Port 993 requires TLS, port 143 uses STARTTLS
  const useTLS = parseInt(account.imapPort) === 993 || account.imapEncryption === 'SSL' || account.imapEncryption === 'TLS'

  return {
    imap: {
      user: account.imapUsername,
      password: password,
      host: account.imapHost,
      port: parseInt(account.imapPort),
      tls: useTLS,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: account.imapHost,
        secureProtocol: 'TLSv1_2_method'
      },
      authTimeout: 10000,  // 10 seconds
      connTimeout: 10000,  // 10 seconds
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true
      },
      debug: false,
    }
  }
}

// Fetch emails from IMAP for a single account and folder
async function fetchEmailsFromFolder(connection: any, account: any, folderName: string, direction: 'inbound' | 'outbound'): Promise<any[]> {
  const emails: any[] = []

  try {
    // Open folder
    await connection.openBox(folderName)
    console.log(`📂 Opened folder: ${folderName}`)

    // Search for ALL messages (no date restriction)
    // This ensures we fetch the entire inbox history
    const searchCriteria = [
      'ALL'
    ]

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false,
      struct: true
    }

    const messages = await connection.search(searchCriteria, fetchOptions)
    console.log(`📬 Found ${messages.length} messages in ${folderName}`)

    for (const item of messages) {
      try {
        const all = item.parts.find((part: any) => part.which === '')
        if (!all || !all.body) continue

        const parsed = await simpleParser(all.body)

        // Extract email addresses
        const fromEmail = parsed.from?.value?.[0]?.address || ''
        const toEmails = parsed.to?.value?.map((addr: any) => addr.address) || []
        const ccEmails = parsed.cc?.value?.map((addr: any) => addr.address) || []
        const bccEmails = parsed.bcc?.value?.map((addr: any) => addr.address) || []

        // Find contact by email (for sent emails, look in toEmails)
        const emailToMatch = direction === 'inbound' ? fromEmail : toEmails[0]
        let contact = await prisma.contact.findFirst({
          where: {
            OR: [
              { email1: emailToMatch },
              { email2: emailToMatch },
              { email3: emailToMatch },
            ]
          }
        })

        // If contact not found and it's an inbound email, auto-create contact
        if (!contact && direction === 'inbound' && emailToMatch) {
          try {
            console.log(`👤 Auto-creating contact for ${emailToMatch}`)
            const nameParts = (parsed.from?.value?.[0]?.name || emailToMatch).split(' ')
            contact = await prisma.contact.create({
              data: {
                firstName: nameParts[0] || 'Unknown',
                lastName: nameParts.slice(1).join(' ') || '',
                email1: emailToMatch,
              }
            })
            console.log(`✅ Created contact ${contact.id} for ${emailToMatch}`)
          } catch (createError: any) {
            console.error(`Error creating contact for ${emailToMatch}:`, createError.message)
          }
        }

        // Process attachments if any
        let attachmentMetadata: any[] = []
        if (parsed.attachments && parsed.attachments.length > 0) {
          console.log(`📎 Found ${parsed.attachments.length} attachments in email`)

          attachmentMetadata = parsed.attachments.map((att: any) => ({
            buffer: att.content,
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            size: att.size || att.content?.length || 0
          }))
        }

        // Extract threading information
        const messageId = parsed.messageId || `${Date.now()}-${Math.random()}`
        const inReplyTo = parseInReplyTo(parsed.inReplyTo || null)
        const references = parseReferences(parsed.references || null)
        const threadId = extractThreadId(messageId, inReplyTo, references, parsed.subject || 'No Subject')

        const emailDate = parsed.date || new Date()

        emails.push({
          messageId,
          fromEmail,
          fromName: parsed.from?.value?.[0]?.name || fromEmail,
          toEmails,
          ccEmails,
          bccEmails,
          subject: parsed.subject || 'No Subject',
          content: parsed.html || parsed.textAsHtml || '',
          textContent: parsed.text || '',
          deliveredAt: emailDate,
          sentAt: emailDate,
          contactId: contact?.id || null,
          emailAccountId: account.id,
          direction,
          status: 'delivered' as const,
          threadId,
          inReplyTo,
          references,
          attachmentData: attachmentMetadata,
        })
      } catch (parseError) {
        console.error('Error parsing email:', parseError)
      }
    }
  } catch (error: any) {
    console.error(`Error fetching from ${folderName}:`, error.message)
  }

  return emails
}

// Fetch emails from IMAP for a single account
async function fetchEmailsFromIMAP(account: any, password: string): Promise<any[]> {
  const config = getImapConfig(account, password)
  let connection: any = null

  try {
    console.log(`📧 Connecting to IMAP for ${account.emailAddress}...`)

    // Connect with timeout
    const connectPromise = Imap.connect(config)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('IMAP connection timeout')), 15000)
    )

    connection = await Promise.race([connectPromise, timeoutPromise])
    console.log(`✅ IMAP connected for ${account.emailAddress}`)

    let allEmails: any[] = []

    // Fetch from INBOX (inbound emails)
    const inboxEmails = await fetchEmailsFromFolder(connection, account, 'INBOX', 'inbound')
    allEmails = allEmails.concat(inboxEmails)

    // Fetch from Sent folder (outbound emails)
    // Try common sent folder names (Hostinger uses INBOX.Sent)
    const sentFolderNames = ['INBOX.Sent', 'Sent', '[Gmail]/Sent Mail', 'Sent Items', 'Sent Messages']

    for (const folderName of sentFolderNames) {
      try {
        const sentEmails = await fetchEmailsFromFolder(connection, account, folderName, 'outbound')
        if (sentEmails.length > 0) {
          allEmails = allEmails.concat(sentEmails)
          console.log(`✅ Synced ${sentEmails.length} sent emails from ${folderName}`)
          break // Found the sent folder, no need to try others
        }
      } catch (error: any) {
        // Folder might not exist, try next one
        console.log(`⏭️ Folder ${folderName} not found, trying next...`)
      }
    }

    connection.end()
    return allEmails

  } catch (error: any) {
    console.error(`❌ IMAP error for ${account.emailAddress}:`, error.message)
    if (connection) {
      try {
        connection.end()
      } catch (e) {
        // Ignore
      }
    }
    return []
  }
}

// Process email sync job
async function processEmailSync(job: Job<EmailSyncJob>) {
  const { accountId, userId, type } = job.data
  
  console.log(`🔄 Processing email sync job ${job.id}`, { accountId, userId, type })

  try {
    // Get email accounts to sync
    const accounts = accountId
      ? await prisma.emailAccount.findMany({ where: { id: accountId } })
      : await prisma.emailAccount.findMany()

    if (accounts.length === 0) {
      console.log('No email accounts to sync')
      return { synced: 0, accounts: 0 }
    }

    let totalSynced = 0

    for (const account of accounts) {
      try {
        // Decrypt password
        const password = decrypt(account.imapPassword, account.imapPasswordIv)

        // Fetch emails
        const emails = await fetchEmailsFromIMAP(account, password)

        // Save emails to database
        for (const email of emails) {
          try {
            // Check if message already exists
            const existing = await prisma.emailMessage.findFirst({
              where: { messageId: email.messageId }
            })

            if (!existing) {
              // Extract attachment data before saving
              const attachmentData = email.attachmentData || []
              const emailDataWithoutAttachments = { ...email }
              delete emailDataWithoutAttachments.attachmentData

              // Create email message first
              const emailMessage = await prisma.emailMessage.create({
                data: {
                  ...emailDataWithoutAttachments,
                  attachments: null // Will update after saving files
                }
              })

              // Save attachments to disk if any
              if (attachmentData.length > 0) {
                console.log(`💾 Saving ${attachmentData.length} attachments for email ${emailMessage.id}`)
                const savedAttachments = []

                for (const att of attachmentData) {
                  try {
                    const saved = await saveAttachmentFromBuffer(
                      att.buffer,
                      att.filename,
                      att.contentType,
                      emailMessage.id
                    )
                    savedAttachments.push({
                      filename: saved.originalFilename,
                      originalFilename: saved.originalFilename,
                      url: saved.url,
                      size: saved.size,
                      contentType: saved.contentType
                    })
                  } catch (attError) {
                    console.error(`Failed to save attachment ${att.filename}:`, attError)
                  }
                }

                // Update email message with attachment URLs
                if (savedAttachments.length > 0) {
                  await prisma.emailMessage.update({
                    where: { id: emailMessage.id },
                    data: { attachments: savedAttachments }
                  })
                  console.log(`✅ Saved ${savedAttachments.length} attachments`)
                }
              }

              totalSynced++
            }
          } catch (dbError) {
            console.error('Error saving email:', dbError)
          }
        }

        console.log(`✅ Synced ${emails.length} emails for ${account.emailAddress}`)

        // Publish real-time update via Redis
        if (redisPublisher) {
          await redisPublisher.publish('email:sync', JSON.stringify({
            accountId: account.id,
            emailAddress: account.emailAddress,
            count: emails.length,
            timestamp: new Date().toISOString(),
          }))
        }

      } catch (accountError: any) {
        console.error(`Error syncing account ${account.emailAddress}:`, accountError.message)
      }
    }

    console.log(`✅ Email sync completed: ${totalSynced} new emails from ${accounts.length} accounts`)

    return {
      synced: totalSynced,
      accounts: accounts.length,
      timestamp: new Date().toISOString(),
    }

  } catch (error: any) {
    console.error('Email sync job failed:', error)
    throw error
  }
}

// Start the worker
console.log('🚀 Starting email sync worker...')

emailSyncQueue.process(2, processEmailSync) // Process 2 jobs concurrently

console.log('✅ Email sync worker started and listening for jobs')

// Automatic sync scheduling - every 30 seconds
const SYNC_INTERVAL = 30000 // 30 seconds
let syncIntervalId: NodeJS.Timeout

async function scheduleAutoSync() {
  console.log(`⏰ Scheduling automatic email sync every ${SYNC_INTERVAL / 1000} seconds`)

  // Queue initial sync
  try {
    const { queueEmailSync } = await import('@/lib/queues/email-sync-queue')
    await queueEmailSync({ type: 'auto' })
    console.log('📬 Queued initial auto-sync')
  } catch (error) {
    console.error('Failed to queue initial sync:', error)
  }

  // Schedule recurring syncs
  syncIntervalId = setInterval(async () => {
    try {
      const { queueEmailSync } = await import('@/lib/queues/email-sync-queue')
      await queueEmailSync({ type: 'auto' })
      console.log('📬 Queued scheduled auto-sync')
    } catch (error) {
      console.error('Failed to queue scheduled sync:', error)
    }
  }, SYNC_INTERVAL)
}

// Start automatic sync scheduling
scheduleAutoSync()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down email sync worker...')
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    console.log('⏰ Stopped automatic sync scheduling')
  }
  await emailSyncQueue.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('📴 Shutting down email sync worker...')
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    console.log('⏰ Stopped automatic sync scheduling')
  }
  await emailSyncQueue.close()
  process.exit(0)
})

