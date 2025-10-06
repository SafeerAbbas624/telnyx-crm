import { Job } from 'bull'
import { emailSyncQueue, EmailSyncJob } from '@/lib/queues/email-sync-queue'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import * as Imap from 'imap-simple'
import { simpleParser } from 'mailparser'
import { redisPublisher } from '@/lib/redis'

// IMAP configuration helper
function getImapConfig(account: any, password: string) {
  return {
    imap: {
      user: account.imapUsername,
      password: password,
      host: account.imapHost,
      port: parseInt(account.imapPort),
      tls: account.imapEncryption === 'SSL',
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

    // Open INBOX
    await connection.openBox('INBOX')

    // Search for unseen messages (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const searchCriteria = [
      ['SINCE', thirtyDaysAgo],
    ]

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false,
      struct: true
    }

    const messages = await connection.search(searchCriteria, fetchOptions)
    console.log(`📬 Found ${messages.length} messages for ${account.emailAddress}`)

    const emails: any[] = []

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

        // Find contact by email
        const contact = await prisma.contact.findFirst({
          where: {
            OR: [
              { email1: fromEmail },
              { email2: fromEmail },
              { email3: fromEmail },
            ]
          }
        })

        emails.push({
          messageId: parsed.messageId || `${Date.now()}-${Math.random()}`,
          fromEmail,
          fromName: parsed.from?.value?.[0]?.name || fromEmail,
          toEmails,
          ccEmails,
          bccEmails,
          subject: parsed.subject || 'No Subject',
          content: parsed.html || parsed.textAsHtml || '',
          textContent: parsed.text || '',
          deliveredAt: parsed.date || new Date(),
          contactId: contact?.id || null,
          emailAccountId: account.id,
          direction: 'inbound' as const,
          status: 'delivered' as const,
        })
      } catch (parseError) {
        console.error('Error parsing email:', parseError)
      }
    }

    connection.end()
    return emails

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
              await prisma.emailMessage.create({
                data: email
              })
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down email sync worker...')
  await emailSyncQueue.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('📴 Shutting down email sync worker...')
  await emailSyncQueue.close()
  process.exit(0)
})

