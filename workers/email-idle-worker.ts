/**
 * Email IDLE Worker
 * Uses IMAP IDLE to listen for new emails in real-time
 * This provides instant email delivery instead of polling every 30 seconds
 */

import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import * as Imap from 'imap-simple'
import { simpleParser } from 'mailparser'
import { redisPublisher } from '@/lib/redis'
import { saveAttachmentFromBuffer } from '@/lib/attachment-storage'
import { extractThreadId, parseReferences, parseInReplyTo } from '@/lib/email-threading'

interface IdleConnection {
  accountId: string
  connection: any
  isIdle: boolean
}

const activeConnections: Map<string, IdleConnection> = new Map()

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
      authTimeout: 10000,
      connTimeout: 10000,
      keepalive: {
        interval: 10000,
        idleInterval: 300000, // 5 minutes
        forceNoop: true
      },
      debug: false,
    }
  }
}

// Process a single email
async function processEmail(parsed: any, account: any): Promise<void> {
  try {
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

    const messageId = parsed.messageId || `${Date.now()}-${Math.random()}`

    // Check if message already exists
    const existing = await prisma.emailMessage.findFirst({
      where: { messageId }
    })

    if (existing) {
      console.log(`⏭️ Email already exists: ${messageId}`)
      return
    }

    // Process attachments if any
    let savedAttachments: any[] = []
    if (parsed.attachments && parsed.attachments.length > 0) {
      console.log(`📎 Processing ${parsed.attachments.length} attachments`)
      
      for (const att of parsed.attachments) {
        try {
          const saved = await saveAttachmentFromBuffer(
            att.content,
            att.filename || 'attachment',
            att.contentType || 'application/octet-stream',
            messageId
          )
          savedAttachments.push({
            filename: saved.originalFilename,
            originalFilename: saved.originalFilename,
            url: saved.url,
            size: saved.size,
            contentType: saved.contentType
          })
        } catch (attError) {
          console.error(`Failed to save attachment:`, attError)
        }
      }
    }

    // Extract threading information
    const inReplyTo = parseInReplyTo(parsed.inReplyTo || null)
    const references = parseReferences(parsed.references || null)
    const threadId = extractThreadId(messageId, inReplyTo, references, parsed.subject || 'No Subject')

    // Create email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        messageId,
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
        direction: 'inbound',
        status: 'delivered',
        threadId,
        inReplyTo,
        references,
        attachments: savedAttachments.length > 0 ? savedAttachments : null,
      }
    })

    console.log(`✅ Saved new email: ${emailMessage.subject}`)

    // Update or create email conversation
    if (contact && prisma.emailConversation) {
      await prisma.emailConversation.upsert({
        where: {
          contactId_emailAddress: {
            contactId: contact.id,
            emailAddress: fromEmail,
          }
        },
        update: {
          lastMessageId: emailMessage.id,
          lastMessageContent: emailMessage.subject,
          lastMessageAt: emailMessage.deliveredAt,
          lastMessageDirection: 'inbound',
          messageCount: { increment: 1 },
          unreadCount: { increment: 1 },
        },
        create: {
          contactId: contact.id,
          emailAddress: fromEmail,
          lastMessageId: emailMessage.id,
          lastMessageContent: emailMessage.subject,
          lastMessageAt: emailMessage.deliveredAt,
          lastMessageDirection: 'inbound',
          messageCount: 1,
          unreadCount: 1,
        }
      })
    }

    // Publish real-time update via Redis
    if (redisPublisher) {
      await redisPublisher.publish('email:sync', JSON.stringify({
        accountId: account.id,
        emailAddress: account.emailAddress,
        count: 1,
        timestamp: new Date().toISOString(),
        type: 'idle'
      }))
    }

  } catch (error) {
    console.error('Error processing email:', error)
  }
}

// Start IDLE for a single account
async function startIdleForAccount(account: any): Promise<void> {
  try {
    console.log(`🔌 Starting IDLE for ${account.emailAddress}...`)

    // Decrypt password
    const password = decrypt(account.imapPassword, account.imapPasswordIv)
    const config = getImapConfig(account, password)

    // Connect to IMAP
    const connection = await Imap.connect(config)
    console.log(`✅ Connected to IMAP for ${account.emailAddress}`)

    // Open INBOX
    await connection.openBox('INBOX')

    // Store connection
    activeConnections.set(account.id, {
      accountId: account.id,
      connection,
      isIdle: false
    })

    // Start IDLE
    const startIdle = async () => {
      const connInfo = activeConnections.get(account.id)
      if (!connInfo) return

      try {
        console.log(`⏸️ Starting IDLE for ${account.emailAddress}`)
        connInfo.isIdle = true
        
        await connection.imap.idle()
        
        // IDLE will be interrupted when new mail arrives
        console.log(`📬 IDLE interrupted for ${account.emailAddress} - new mail arrived!`)
        connInfo.isIdle = false

        // Fetch new messages
        const searchCriteria = ['UNSEEN']
        const fetchOptions = {
          bodies: ['HEADER', 'TEXT', ''],
          markSeen: false,
          struct: true
        }

        const messages = await connection.search(searchCriteria, fetchOptions)
        console.log(`📧 Found ${messages.length} new messages`)

        // Process each message
        for (const item of messages) {
          try {
            const all = item.parts.find((part: any) => part.which === '')
            if (!all || !all.body) continue

            const parsed = await simpleParser(all.body)
            await processEmail(parsed, account)
          } catch (parseError) {
            console.error('Error parsing email:', parseError)
          }
        }

        // Restart IDLE
        setTimeout(() => startIdle(), 100)

      } catch (error: any) {
        console.error(`IDLE error for ${account.emailAddress}:`, error.message)
        connInfo.isIdle = false
        
        // Restart IDLE after a delay
        setTimeout(() => startIdle(), 5000)
      }
    }

    // Start IDLE loop
    startIdle()

    // Handle connection errors
    connection.on('error', (err: Error) => {
      console.error(`Connection error for ${account.emailAddress}:`, err)
      activeConnections.delete(account.id)
      
      // Reconnect after delay
      setTimeout(() => startIdleForAccount(account), 10000)
    })

    connection.on('end', () => {
      console.log(`Connection ended for ${account.emailAddress}`)
      activeConnections.delete(account.id)
      
      // Reconnect after delay
      setTimeout(() => startIdleForAccount(account), 10000)
    })

  } catch (error: any) {
    console.error(`Failed to start IDLE for ${account.emailAddress}:`, error.message)
    
    // Retry after delay
    setTimeout(() => startIdleForAccount(account), 30000)
  }
}

// Start IDLE worker
async function startIdleWorker() {
  console.log('🚀 Starting Email IDLE Worker...')

  try {
    // Get all active email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: {
        status: 'active'
      }
    })

    console.log(`📧 Found ${accounts.length} active email accounts`)

    // Start IDLE for each account
    for (const account of accounts) {
      await startIdleForAccount(account)
      // Stagger connections to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('✅ Email IDLE Worker started successfully')

  } catch (error) {
    console.error('Failed to start IDLE worker:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down Email IDLE Worker...')
  
  for (const [accountId, connInfo] of activeConnections) {
    try {
      if (connInfo.connection) {
        connInfo.connection.end()
      }
    } catch (error) {
      console.error(`Error closing connection for ${accountId}:`, error)
    }
  }
  
  activeConnections.clear()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('📴 Shutting down Email IDLE Worker...')
  
  for (const [accountId, connInfo] of activeConnections) {
    try {
      if (connInfo.connection) {
        connInfo.connection.end()
      }
    } catch (error) {
      console.error(`Error closing connection for ${accountId}:`, error)
    }
  }
  
  activeConnections.clear()
  process.exit(0)
})

// Start the worker
startIdleWorker()

