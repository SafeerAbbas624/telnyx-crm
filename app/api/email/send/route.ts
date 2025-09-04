import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Simple decryption for passwords
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'your-32-char-secret-key-here-123456';
const ALGORITHM = 'aes-256-cbc';

// Ensure the key is exactly 32 bytes for AES-256
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
    return encryptedText; // Return as-is if decryption fails
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if models exist
    if (!prisma.emailAccount || !prisma.emailMessage) {
      return NextResponse.json(
        { error: 'Email functionality not supported yet' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const {
      emailAccountId,
      contactId,
      toEmails,
      ccEmails = [],
      bccEmails = [],
      subject,
      content,
      textContent,
      blastId,
    } = body;

    // Validate required fields
    if (!emailAccountId || !toEmails || !toEmails.length || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: emailAccountId, toEmails, subject, content' },
        { status: 400 }
      );
    }

    // Get email account
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
    });

    if (!emailAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      );
    }

    if (emailAccount.status !== 'active') {
      return NextResponse.json(
        { error: 'Email account is not active' },
        { status: 400 }
      );
    }

    // Decrypt password
    const smtpPassword = decrypt(emailAccount.smtpPassword);

    // Configure SMTP transporter
    const smtpConfig: any = {
      host: emailAccount.smtpHost,
      port: emailAccount.smtpPort,
      auth: {
        user: emailAccount.smtpUsername,
        pass: smtpPassword,
      },
    };

    // Set security options
    if (emailAccount.smtpEncryption === 'SSL') {
      smtpConfig.secure = true;
    } else if (emailAccount.smtpEncryption === 'TLS') {
      smtpConfig.secure = false;
      smtpConfig.requireTLS = true;
    } else {
      smtpConfig.secure = false;
    }

    const transporter = nodemailer.createTransport(smtpConfig);

    // Prepare email content
    let emailHtml = content;
    
    // Add signature if available
    if (emailAccount.signature) {
      emailHtml += `<br><br>---<br>${emailAccount.signature.replace(/\n/g, '<br>')}`;
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
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Save to database
    let emailMessage: any = null
    try {
      emailMessage = await prisma.emailMessage.create({
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
    } catch (err) {
      console.error('Warning: email sent but failed to persist emailMessage:', err)
      // Do not fail the request; email was sent successfully
    }

    // Update or create conversation if contactId is provided
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
      } catch (error) {
        console.error('Error updating email conversation:', error);
        // Don't fail the email send if conversation update fails
      }
    }

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      status: 'sent',
      message: 'Email sent successfully',
      data: {
        id: emailMessage?.id ?? null,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      }
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    
    // Handle specific SMTP errors
    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your SMTP settings.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        code: error.code || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}
