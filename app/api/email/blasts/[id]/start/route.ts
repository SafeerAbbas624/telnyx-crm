import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

// Variable replacement function (same as text blast)
function formatEmailContent(template: string, contact: any): string {
  return template
    .replace(/\{firstName\}/g, contact.firstName || '')
    .replace(/\{lastName\}/g, contact.lastName || '')
    .replace(/\{fullName\}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim())
    .replace(/\{llcName\}/g, contact.llcName || '')
    // Phone fields
    .replace(/\{phone1\}/g, contact.phone1 || '')
    .replace(/\{phone2\}/g, contact.phone2 || '')
    .replace(/\{phone3\}/g, contact.phone3 || '')
    .replace(/\{phone\}/g, contact.phone1 || contact.phone2 || contact.phone3 || '')
    // Email fields
    .replace(/\{email1\}/g, contact.email1 || '')
    .replace(/\{email2\}/g, contact.email2 || '')
    .replace(/\{email3\}/g, contact.email3 || '')
    .replace(/\{email\}/g, contact.email1 || contact.email2 || contact.email3 || '')
    // Address fields
    .replace(/\{propertyAddress\}/g, contact.propertyAddress || '')
    .replace(/\{contactAddress\}/g, contact.contactAddress || '')
    .replace(/\{city\}/g, contact.city || '')
    .replace(/\{state\}/g, contact.state || '')
    .replace(/\{zipCode\}/g, contact.zipCode || '')
    // Property fields
    .replace(/\{propertyType\}/g, contact.propertyType || '')
    .replace(/\{propertyCounty\}/g, contact.propertyCounty || '')
    .replace(/\{bedrooms\}/g, contact.bedrooms ? contact.bedrooms.toString() : '')
    .replace(/\{totalBathrooms\}/g, contact.totalBathrooms ? contact.totalBathrooms.toString() : '')
    .replace(/\{buildingSqft\}/g, contact.buildingSqft ? contact.buildingSqft.toString() : '')
    .replace(/\{effectiveYearBuilt\}/g, contact.effectiveYearBuilt ? contact.effectiveYearBuilt.toString() : '')
    // Financial fields
    .replace(/\{estValue\}/g, contact.estValue ? contact.estValue.toString() : '')
    .replace(/\{estEquity\}/g, contact.estEquity ? contact.estEquity.toString() : '')
}

// Email blast start endpoint

// Simple decryption for passwords (copied from email/send/route.ts)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'your-32-char-secret-key-here-123456';
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
  return Buffer.from(key, 'utf8');
}

function decrypt(encryptedText: string): string {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedData = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText; // Return as-is if decryption fails
  }
}

// Function to send a single email
async function sendSingleEmail(params: {
  emailAccountId: string
  contactId: string
  toEmails: string[]
  ccEmails: string[]
  bccEmails: string[]
  subject: string
  content: string
  textContent: string
  blastId: string
}) {
  try {
    const { emailAccountId, contactId, toEmails, ccEmails, bccEmails, subject, content, textContent, blastId } = params

    // Get email account
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
    })

    if (!emailAccount) {
      return { success: false, error: 'Email account not found' }
    }

    if (emailAccount.status !== 'active') {
      return { success: false, error: 'Email account is not active' }
    }

    // Decrypt password
    const smtpPassword = decrypt(emailAccount.smtpPassword)

    // Configure SMTP transporter
    const smtpConfig: any = {
      host: emailAccount.smtpHost,
      port: emailAccount.smtpPort,
      auth: {
        user: emailAccount.smtpUsername,
        pass: smtpPassword,
      },
    }

    // Set security options
    if (emailAccount.smtpEncryption === 'SSL') {
      smtpConfig.secure = true
    } else if (emailAccount.smtpEncryption === 'TLS') {
      smtpConfig.secure = false
      smtpConfig.requireTLS = true
    } else {
      smtpConfig.secure = false
    }

    const transporter = nodemailer.createTransport(smtpConfig)

    // Prepare email content
    let emailHtml = content

    // Add signature if available
    if (emailAccount.signature) {
      emailHtml += `<br><br>---<br>${emailAccount.signature.replace(/\n/g, '<br>')}`
    }

    // Prepare mail options
    const mailOptions = {
      from: `"${emailAccount.displayName}" <${emailAccount.emailAddress}>`,
      to: toEmails.join(', '),
      cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
      bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
      subject,
      html: emailHtml,
      text: textContent || content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)

    // Save to database
    const emailMessage = await prisma.emailMessage.create({
      data: {
        messageId: info.messageId,
        contactId: contactId || null,
        emailAccountId,
        fromEmail: emailAccount.emailAddress,
        fromName: emailAccount.displayName,
        toEmails,
        ccEmails,
        bccEmails,
        subject,
        content: emailHtml,
        textContent: textContent || null,
        direction: 'outbound',
        status: 'sent',
        sentAt: new Date(),
        blastId: blastId || null,
      },
    })

    // Update or create conversation if contactId is provided (same logic as regular email sending)
    if (contactId && prisma.emailConversation) {
      try {
        const primaryEmail = toEmails[0];
        await prisma.emailConversation.upsert({
          where: {
            contactId_emailAddress: {
              contactId,
              emailAddress: primaryEmail,
            }
          },
          update: {
            lastMessageId: emailMessage.id,
            lastMessageContent: subject,
            lastMessageAt: new Date(),
            lastMessageDirection: 'outbound',
            messageCount: { increment: 1 },
            updatedAt: new Date(),
            // Don't increment unread count for outbound messages
          },
          create: {
            contactId,
            emailAddress: primaryEmail,
            lastMessageId: emailMessage.id,
            lastMessageContent: subject,
            lastMessageAt: new Date(),
            lastMessageDirection: 'outbound',
            messageCount: 1,
            unreadCount: 0, // Outbound messages don't create unread count
          }
        });
        console.log(`Updated email conversation for contact ${contactId} and email ${primaryEmail}`)
      } catch (error) {
        console.error('Error updating email conversation:', error)
        // Don't fail the email send if conversation update fails
      }
    }

    return {
      success: true,
      messageId: info.messageId,
      emailMessageId: emailMessage.id
    }

  } catch (error: any) {
    console.error('Error sending single email:', error)

    let errorMessage = 'Failed to send email'
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check your email credentials.'
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your SMTP settings.'
    } else if (error.message) {
      errorMessage = error.message
    }

    return {
      success: false,
      error: errorMessage,
      code: error.code || 'UNKNOWN_ERROR'
    }
  }
}

// Background function to send emails for a blast
async function sendEmailBlast(blastId: string, blast: any) {
  try {
    console.log('Starting background email sending for blast:', blastId)

    // Get contacts for this blast
    const contacts = await prisma.contact.findMany({
      where: {
        id: {
          in: blast.contactIds || []
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email1: true,
      }
    })

    console.log(`Found ${contacts.length} contacts for blast ${blastId}`)

    let sentCount = 0
    let failedCount = 0

    // Send emails to each contact
    for (const contact of contacts) {
      try {
        const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown'
        const contactEmail = contact.email1

        if (!contactEmail) {
          console.log(`Skipping contact ${contactName} - no email address`)
          failedCount++
          continue
        }

        console.log(`Sending email to ${contactName} (${contactEmail})`)

        // Replace variables in subject and content for this specific contact
        const personalizedSubject = formatEmailContent(blast.subject, contact)
        const personalizedContent = formatEmailContent(blast.content, contact)
        const personalizedTextContent = blast.textContent ? formatEmailContent(blast.textContent, contact) : null

        // Send email directly using the email sending logic
        const result = await sendSingleEmail({
          emailAccountId: blast.emailAccountId,
          contactId: contact.id,
          toEmails: [contactEmail],
          ccEmails: blast.ccEmails || [],
          bccEmails: blast.bccEmails || [],
          subject: personalizedSubject,
          content: personalizedContent,
          textContent: personalizedTextContent,
          blastId: blastId,
        })

        if (result.success) {
          sentCount++
          console.log(`Email sent successfully to ${contactEmail}`)
        } else {
          failedCount++
          console.error(`Failed to send email to ${contactEmail}:`, result.error)
        }

        // Add delay between emails if specified
        if (blast.delayBetweenEmails && blast.delayBetweenEmails > 0) {
          await new Promise(resolve => setTimeout(resolve, blast.delayBetweenEmails * 1000))
        }

      } catch (error) {
        failedCount++
        console.error(`Error sending email to ${contactEmail}:`, error)
      }
    }

    // Update blast status and counts
    // Use valid TextBlastStatus values: draft, pending, running, paused, completed, failed, cancelled
    const finalStatus = failedCount === 0 ? 'completed' : sentCount > 0 ? 'completed' : 'failed'

    await prisma.emailBlast.update({
      where: { id: blastId },
      data: {
        status: finalStatus,
        sentCount,
        failedCount,
        completedAt: new Date(),
      }
    })

    console.log(`Email blast ${blastId} completed: ${sentCount} sent, ${failedCount} failed, status: ${finalStatus}`)

  } catch (error) {
    console.error('Error in sendEmailBlast:', error)

    // Update blast status to failed
    try {
      await prisma.emailBlast.update({
        where: { id: blastId },
        data: {
          status: 'failed',
          completedAt: new Date(),
        }
      })
    } catch (updateError) {
      console.error('Error updating blast status to failed:', updateError)
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Starting email blast via start endpoint:', id)

    // Check if EmailBlast model exists
    if (!prisma.emailBlast) {
      return NextResponse.json(
        { 
          success: false,
          message: 'EmailBlast model not available'
        },
        { status: 400 }
      )
    }

    // Get the blast
    const blast = await prisma.emailBlast.findUnique({
      where: { id },
      include: {
        emailAccount: true,
      }
    })

    if (!blast) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Email blast not found'
        },
        { status: 404 }
      )
    }

    // Check if blast can be started
    if (blast.status !== 'draft' && blast.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot start blast with status: ${blast.status}`
        },
        { status: 400 }
      )
    }

    // Update blast status to running
    const updatedBlast = await prisma.emailBlast.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: new Date(),
      }
    })

    console.log('Email blast started:', updatedBlast.id)

    // Start sending emails in the background
    sendEmailBlast(updatedBlast.id, blast)
      .catch(error => {
        console.error('Error in background email sending:', error)
      })

    return NextResponse.json({
      success: true,
      blast: {
        id: updatedBlast.id,
        name: updatedBlast.name,
        status: updatedBlast.status,
        startedAt: updatedBlast.startedAt?.toISOString(),
        recipientCount: updatedBlast.recipientCount,
      },
      message: 'Email blast started successfully'
    })
  } catch (error) {
    console.error('Error starting email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to start email blast'
      },
      { status: 500 }
    )
  }
}
