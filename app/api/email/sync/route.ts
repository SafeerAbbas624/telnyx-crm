import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { broadcast } from '@/lib/server-events';
import { queueEmailSync, getQueueStats } from '@/lib/queues/email-sync-queue';
import crypto from 'crypto';

// Dynamic import for imap-simple to avoid Next.js build issues
let imaps: any = null;

// Simple decryption for passwords (same as in other email files)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'your-32-char-secret-key-here-123456';
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
  return Buffer.from(key, 'utf8');
}

function decrypt(encryptedText: string): string {
  try {
    // Try new format first (with IV)
    const parts = encryptedText.split(':');
    if (parts.length === 2) {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  } catch (error) {
    console.warn('Failed to decrypt with new method, trying legacy method:', error);
  }

  // Fallback to legacy method for backward compatibility
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt with both methods:', error);
    return encryptedText;
  }
}

// Manual header parsing fallback
function parseHeaderManually(headerString: string): any {
  const headers: any = {};

  try {
    console.log('📧 Raw header string preview:', headerString.substring(0, 500));

    const lines = headerString.split(/\r?\n/);
    let currentHeader = '';
    let currentValue = '';

    for (const line of lines) {
      if (line.match(/^[a-zA-Z-]+:\s*/)) {
        // Save previous header
        if (currentHeader && currentValue) {
          headers[currentHeader.toLowerCase()] = currentValue.trim();
        }

        // Start new header
        const colonIndex = line.indexOf(':');
        currentHeader = line.substring(0, colonIndex).trim();
        currentValue = line.substring(colonIndex + 1).trim();
      } else if ((line.startsWith(' ') || line.startsWith('\t')) && currentHeader) {
        // Continuation of previous header
        currentValue += ' ' + line.trim();
      }
    }

    // Save last header
    if (currentHeader && currentValue) {
      headers[currentHeader.toLowerCase()] = currentValue.trim();
    }

    console.log('📧 Manually parsed headers:', {
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      'message-id': headers['message-id'],
      date: headers.date
    });

    return headers;
  } catch (error) {
    console.error('Manual header parsing failed:', error);
    return {
      'message-id': `<fallback-${Date.now()}@unknown>`,
      'from': 'unknown@example.com',
      'to': 'unknown@example.com',
      'subject': 'Email parsing failed',
      'date': new Date().toISOString()
    };
  }
}

// Extract readable content from MIME email
function extractReadableContent(mimeContent: string): string {
  try {
    // Handle quoted-printable encoding
    let decodedContent = mimeContent;
    if (mimeContent.includes('Content-Transfer-Encoding: quoted-printable')) {
      decodedContent = decodeQuotedPrintable(mimeContent);
    }

    // Split by content boundaries
    const parts = decodedContent.split(/--[a-zA-Z0-9_-]+/);

    let textContent = '';
    let htmlContent = '';

    for (const part of parts) {
      // Look for text/plain content
      if (part.includes('Content-Type: text/plain')) {
        const lines = part.split('\n');
        let inContent = false;
        let content = '';

        for (const line of lines) {
          if (inContent) {
            content += line + '\n';
          } else if (line.trim() === '' && content === '') {
            inContent = true; // Empty line after headers means content starts
          }
        }

        if (content.trim()) {
          textContent = content.trim();
          break; // Prefer text/plain
        }
      }

      // Look for text/html content as fallback
      if (part.includes('Content-Type: text/html') && !textContent) {
        const lines = part.split('\n');
        let inContent = false;
        let content = '';

        for (const line of lines) {
          if (inContent) {
            content += line + '\n';
          } else if (line.trim() === '' && content === '') {
            inContent = true;
          }
        }

        if (content.trim()) {
          htmlContent = content.trim();
        }
      }
    }

    // Return text content if available, otherwise HTML content
    if (textContent) {
      return textContent;
    } else if (htmlContent) {
      return htmlContent;
    } else {
      // Fallback: try to extract any readable text
      const lines = decodedContent.split('\n');
      const readableLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 &&
               !trimmed.startsWith('Content-') &&
               !trimmed.startsWith('MIME-') &&
               !trimmed.startsWith('--') &&
               !trimmed.match(/^[a-zA-Z0-9+/=]{20,}$/); // Skip base64 encoded lines
      });

      return readableLines.join('\n').trim() || 'Email content could not be parsed';
    }
  } catch (error) {
    console.error('Error extracting readable content:', error);
    return 'Email content could not be parsed';
  }
}

// Decode quoted-printable content
function decodeQuotedPrintable(content: string): string {
  try {
    return content
      .replace(/=E2=80=AF/g, ' ') // Non-breaking space
      .replace(/=E2=80=93/g, '–') // En dash
      .replace(/=E2=80=94/g, '—') // Em dash
      .replace(/=([0-9A-F]{2})/g, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/=\r?\n/g, ''); // Soft line breaks
  } catch (error) {
    console.error('Error decoding quoted-printable:', error);
    return content;
  }
}



// IMAP email fetching using imap-simple
async function fetchEmailsFromIMAP(account: any) {
  try {
    console.log(`Fetching emails for account: ${account.emailAddress}`);

    // Try to import imap-simple dynamically
    let imapModule;
    try {
      imapModule = await import('imap-simple');
      imaps = imapModule.default || imapModule;
    } catch (importError) {
      console.error('imap-simple not available:', importError.message);
      throw new Error('IMAP library not available. Please install imap-simple package.');
    }

    // IMAP configuration with very aggressive timeout
    const config = {
      imap: {
        user: account.imapUsername,
        password: account.imapPassword,
        host: account.imapHost,
        port: parseInt(account.imapPort),
        tls: account.imapEncryption === 'SSL',
        tlsOptions: {
          rejectUnauthorized: false,
          servername: account.imapHost,
          secureProtocol: 'TLSv1_2_method'
        },
        authTimeout: 5000,  // 5 seconds
        connTimeout: 5000,  // 5 seconds
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: true
        },
        debug: false,
      }
    };

    console.log(`Connecting to IMAP server: ${account.imapHost}:${account.imapPort}`);

    // Test basic network connectivity first
    try {
      const net = await import('net');
      const testSocket = new net.Socket();

      const connectTest = new Promise((resolve, reject) => {
        testSocket.setTimeout(10000);
        testSocket.on('connect', () => {
          console.log(`Network connectivity to ${account.imapHost}:${account.imapPort} - SUCCESS`);
          testSocket.destroy();
          resolve(true);
        });
        testSocket.on('timeout', () => {
          console.log(`Network connectivity to ${account.imapHost}:${account.imapPort} - TIMEOUT`);
          testSocket.destroy();
          reject(new Error('Network connectivity test timeout'));
        });
        testSocket.on('error', (err) => {
          console.log(`Network connectivity to ${account.imapHost}:${account.imapPort} - ERROR:`, err.message);
          testSocket.destroy();
          reject(err);
        });
        testSocket.connect(parseInt(account.imapPort), account.imapHost);
      });

      await connectTest;
    } catch (netError) {
      console.error('Network connectivity test failed:', netError.message);
      throw new Error(`Network connectivity failed: ${netError.message}. This suggests a firewall or network restriction is blocking IMAP connections.`);
    }

    let connection = null;
    try {
      // Connect to IMAP server with timeout wrapper and retry logic
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const connectPromise = imaps.connect(config);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('IMAP connection timeout after 8 seconds')), 8000)
          );

          connection = await Promise.race([connectPromise, timeoutPromise]);
          console.log('IMAP connection established successfully');
          break; // Success, exit retry loop

        } catch (connectError) {
          retryCount++;
          console.error(`IMAP connection attempt ${retryCount} failed:`, connectError.message);

          if (retryCount > maxRetries) {
            throw connectError; // Re-throw if all retries exhausted
          }

          // Wait before retry (very short backoff)
          const waitTime = 300; // Fixed 0.3 second wait
          console.log(`Retrying IMAP connection in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Open INBOX
      await connection.openBox('INBOX');

    // Search for recent unread emails (last 7 days)
    const searchCriteria = [
      'UNSEEN',
      ['SINCE', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
    ];

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false,
      struct: true
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`Found ${messages.length} new emails`);

    const emails = [];

    for (const message of messages) {
      try {
        const header = message.parts.find(part => part.which === 'HEADER');
        const body = message.parts.find(part => part.which === 'TEXT');

        if (header && header.body) {
          // Ensure header.body is a string
          let headerString = header.body;
          if (typeof headerString !== 'string') {
            if (Buffer.isBuffer(headerString)) {
              headerString = headerString.toString('utf8');
            } else if (typeof headerString === 'object') {
              headerString = JSON.stringify(headerString);
            } else {
              headerString = String(headerString);
            }
          }

          console.log('Header type:', typeof headerString, 'Length:', headerString.length);
          console.log('📧 Raw header preview:', headerString.substring(0, 500));

          let parsedHeader;

          // Check if headerString is already JSON (pre-parsed by IMAP)
          if (headerString.startsWith('{')) {
            try {
              console.log('📧 Header is JSON format, parsing...');
              parsedHeader = JSON.parse(headerString);
              console.log('📧 JSON parsed header keys:', Object.keys(parsedHeader || {}));
            } catch (jsonError) {
              console.error('JSON parsing failed:', jsonError.message);
              parsedHeader = null;
            }
          } else {
            // Try IMAP parsing for raw headers
            try {
              parsedHeader = imaps.parseHeader(headerString);
              console.log('📧 IMAP parsed header keys:', Object.keys(parsedHeader || {}));
            } catch (parseError) {
              console.error('Header parsing failed:', parseError.message);
              parsedHeader = null;
            }
          }

          // If all parsing failed, use manual parsing as last resort
          if (!parsedHeader || !parsedHeader.from) {
            console.log('📧 All parsing failed, using manual parsing...');
            parsedHeader = parseHeaderManually(headerString);
          }

          // Safely extract header values
          const getHeaderValue = (header: any, key: string, defaultValue: any = null) => {
            if (!header || !header[key]) return defaultValue;
            if (Array.isArray(header[key])) return header[key][0];
            return header[key];
          };

          const fromHeader = getHeaderValue(parsedHeader, 'from', null);
          console.log('📧 Raw from header:', fromHeader);

          if (!fromHeader || fromHeader === 'unknown@example.com') {
            console.log('❌ No valid from header found, skipping email');
            continue; // Skip emails without proper from header
          }
          let fromName = '';
          let fromEmail = '';

          if (fromHeader.includes('<') && fromHeader.includes('>')) {
            // Format: "Name <email@domain.com>"
            const nameMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
            if (nameMatch) {
              fromName = nameMatch[1].trim().replace(/"/g, '');
              fromEmail = nameMatch[2].trim();
            } else {
              fromEmail = fromHeader;
              fromName = fromEmail.split('@')[0];
            }
          } else {
            // Just email address
            fromEmail = fromHeader;
            fromName = fromEmail.split('@')[0];
          }

          // Parse email content properly
          let emailContent = '';
          let emailTextContent = '';

          if (body && body.body) {
            const bodyContent = typeof body.body === 'string' ? body.body : String(body.body);

            // Check if it's MIME content
            if (bodyContent.includes('Content-Type:')) {
              // Extract readable content from MIME
              emailContent = extractReadableContent(bodyContent);
              emailTextContent = emailContent.replace(/<[^>]*>/g, '').trim();
            } else {
              // Plain text content
              emailContent = bodyContent;
              emailTextContent = bodyContent.replace(/<[^>]*>/g, '').trim();
            }

            // Clean up content - remove Content-Type lines and other MIME headers
            emailTextContent = emailTextContent
              .replace(/Content-Type:\s*[^\n\r]+/gi, '')
              .replace(/Content-Transfer-Encoding:\s*[^\n\r]+/gi, '')
              .replace(/Content-Disposition:\s*[^\n\r]+/gi, '')
              .replace(/MIME-Version:\s*[^\n\r]+/gi, '')
              .replace(/charset=["'][^"']*["']/gi, '')
              .replace(/boundary=["'][^"']*["']/gi, '')
              .replace(/^\s*\n/gm, '') // Remove empty lines at start
              .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple empty lines with double
              .trim();

            emailContent = emailTextContent; // Use cleaned text content
          }

          // Parse To header
          const toHeader = getHeaderValue(parsedHeader, 'to', account.emailAddress);
          const toEmails = Array.isArray(toHeader) ? toHeader : [toHeader];

          // Parse Subject header
          const subjectHeader = getHeaderValue(parsedHeader, 'subject', 'No Subject');

          // Parse Message-ID
          const messageIdHeader = getHeaderValue(parsedHeader, 'message-id', `<${Date.now()}-${Math.random()}@${account.imapHost}>`);

          console.log('📧 Parsed email headers:', {
            messageId: messageIdHeader,
            from: fromEmail,
            fromName: fromName,
            to: toEmails,
            subject: subjectHeader
          });

          const email = {
            messageId: messageIdHeader,
            from: fromEmail,
            fromName: fromName,
            to: toEmails,
            cc: parsedHeader.cc || [],
            bcc: parsedHeader.bcc || [],
            subject: subjectHeader,
            content: emailContent,
            textContent: emailTextContent,
            receivedAt: parsedHeader.date ? new Date(getHeaderValue(parsedHeader, 'date', new Date().toISOString())) : new Date(),
          };

          emails.push(email);
        }
      } catch (error) {
        console.error('Error parsing email message:', error);
      }
    }

    console.log(`Successfully fetched ${emails.length} emails from ${account.emailAddress}`);
    return emails;

    } finally {
      // Always close connection in finally block
      if (connection) {
        try {
          connection.end();
          console.log('IMAP connection closed successfully');
        } catch (closeError) {
          console.error('Error closing IMAP connection:', closeError);
        }
      }
    }

  } catch (error) {
    console.error(`Error fetching emails for ${account.emailAddress}:`, error);

    // Log detailed error information
    if (error.code) {
      console.error(`IMAP Error Code: ${error.code}`);
    }
    if (error.source) {
      console.error(`IMAP Error Source: ${error.source}`);
    }

    // Don't create fake test emails - just log the error and return empty array
    console.error(`IMAP connection failed for ${account.emailAddress}:`, error.message);
    return [];
  }
}

async function findOrCreateContact(emailAddress: string) {
  // Try to find existing contact by email
  let contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { email1: emailAddress },
        { email2: emailAddress },
        { email3: emailAddress },
      ]
    }
  });

  // If no contact found, create a new one
  if (!contact) {
    const emailParts = emailAddress.split('@');
    const name = emailParts[0].replace(/[._-]/g, ' ').split(' ');
    const firstName = name[0] || 'Unknown';
    const lastName = name.slice(1).join(' ') || 'Contact';

    contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email1: emailAddress,
      }
    });
  }

  return contact;
}

async function storeEmailInDatabase(email: any, accountId: string, contact: any) {
  try {
    // Check if EmailMessage model exists
    if (!prisma.emailMessage) {
      console.warn('EmailMessage model not available in Prisma client. Skipping email storage.');
      return null;
    }

    // Check if email already exists
    const existingEmail = await prisma.emailMessage.findUnique({
      where: { messageId: email.messageId }
    });

    if (existingEmail) {
      console.log(`🔄 DUPLICATE DETECTED: Email ${email.messageId} already exists, skipping`);
      console.log(`   Subject: ${email.subject}`);
      console.log(`   From: ${email.from}`);
      return existingEmail;
    }

    console.log(`✅ NEW EMAIL: Creating ${email.messageId}`);
    console.log(`   Subject: ${email.subject}`);
    console.log(`   From: ${email.from}`);

    // Create email message
    const emailMessage = await prisma.emailMessage.create({
      data: {
        messageId: email.messageId,
        emailAccountId: accountId,
        contactId: contact.id,
        fromEmail: email.from,
        fromName: email.fromName || email.from,
        toEmails: email.to,
        ccEmails: email.cc || [],
        bccEmails: email.bcc || [],
        subject: email.subject,
        content: email.content,
        textContent: email.textContent,
        direction: 'inbound',
        status: 'delivered',
        deliveredAt: email.receivedAt,
        openedAt: email.isRead ? null : undefined, // null means unread, undefined means don't set
      }
    });

    // Update or create email conversation
    if (prisma.emailConversation) {
      await prisma.emailConversation.upsert({
      where: {
        contactId_emailAddress: {
          contactId: contact.id,
          emailAddress: email.from,
        }
      },
      update: {
        lastMessageId: emailMessage?.id,
        lastMessageContent: email.subject,
        lastMessageAt: email.receivedAt,
        lastMessageDirection: 'inbound',
        messageCount: { increment: 1 },
        unreadCount: { increment: 1 }, // Always increment for new emails
      },
      create: {
        contactId: contact.id,
        emailAddress: email.from,
        lastMessageId: emailMessage?.id,
        lastMessageContent: email.subject,
        lastMessageAt: email.receivedAt,
        lastMessageDirection: 'inbound',
        messageCount: 1,
        unreadCount: 1, // New emails are always unread
      }
      });
    } else {
      console.warn('EmailConversation model not available in Prisma client. Skipping conversation creation.');
    }

    return emailMessage;
  } catch (error) {
    console.error('Error storing email in database:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📬 Queueing email sync job...');

    const body = await request.json().catch(() => ({}));
    const { accountId } = body;

    // Queue the sync job instead of doing it synchronously
    const job = await queueEmailSync({
      accountId: accountId || undefined,
      userId: undefined, // TODO: Get from session
      type: 'manual',
    });

    // Get queue stats
    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      message: 'Email sync queued successfully',
      jobId: job.id,
      queueStats: stats,
      note: 'Sync will complete in background. Emails will appear automatically.',
    });
  } catch (error) {
    console.error('Error queueing email sync:', error);
    return NextResponse.json(
      { error: 'Failed to queue email sync' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get queue stats
    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      queueStats: stats,
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
