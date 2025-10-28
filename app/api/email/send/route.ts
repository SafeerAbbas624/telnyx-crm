import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import nodemailer from 'nodemailer';
import { emitToAccount } from '@/lib/socket-server';
import { validateEmails, getEmailValidationError } from '@/lib/email-validation';
import { saveAttachments } from '@/lib/attachment-storage';
import { extractThreadId, buildReferences } from '@/lib/email-threading';
import * as Imap from 'imap-simple';

// Helper function to save sent email to IMAP Sent folder
async function saveSentEmailToImap(
  emailAccount: any,
  mailOptions: any,
  messageId: string
) {
  try {
    console.log(`📤 Saving sent email to IMAP Sent folder for ${emailAccount.emailAddress}...`);

    // Decrypt IMAP password
    const imapPassword = decrypt(emailAccount.imapPassword, emailAccount.imapPasswordIv);

    // Create IMAP config
    const imapConfig = {
      imap: {
        user: emailAccount.imapUsername,
        password: imapPassword,
        host: emailAccount.imapHost,
        port: emailAccount.imapPort,
        tls: emailAccount.imapEncryption === 'TLS',
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
      }
    };

    // Connect to IMAP
    const connection = await Imap.connect(imapConfig);

    // Build email message in RFC 2822 format
    const emailContent = `From: ${mailOptions.from}
To: ${mailOptions.to}
${mailOptions.cc ? `Cc: ${mailOptions.cc}` : ''}
${mailOptions.bcc ? `Bcc: ${mailOptions.bcc}` : ''}
Subject: ${mailOptions.subject}
Message-ID: <${messageId}>
Date: ${new Date().toUTCString()}
Content-Type: text/html; charset=utf-8

${mailOptions.html || mailOptions.text}`;

    // Try common sent folder names
    const sentFolderNames = ['Sent', '[Gmail]/Sent Mail', 'Sent Items', 'Sent Messages'];
    let saved = false;

    for (const folderName of sentFolderNames) {
      try {
        await connection.openBox(folderName);
        await connection.append(Buffer.from(emailContent), { flags: ['\\Seen'] });
        console.log(`✅ Saved sent email to ${folderName}`);
        saved = true;
        break;
      } catch (error: any) {
        console.log(`⏭️ Could not save to ${folderName}, trying next...`);
      }
    }

    connection.end();

    if (!saved) {
      console.warn(`⚠️ Could not save sent email to any Sent folder`);
    }
  } catch (error: any) {
    console.error(`⚠️ Failed to save sent email to IMAP:`, error.message);
    // Don't fail the email send if IMAP save fails
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

    // Check if request is FormData (with attachments) or JSON
    const contentType = request.headers.get('content-type') || '';
    let emailAccountId, contactId, toEmails, ccEmails, bccEmails, subject, content, textContent, blastId;
    let inReplyTo, replyToMessageId;
    let attachments: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (with attachments)
      const formData = await request.formData();
      emailAccountId = formData.get('emailAccountId') as string;
      contactId = formData.get('contactId') as string;
      toEmails = JSON.parse(formData.get('toEmails') as string || '[]');
      ccEmails = JSON.parse(formData.get('ccEmails') as string || '[]');
      bccEmails = JSON.parse(formData.get('bccEmails') as string || '[]');
      subject = formData.get('subject') as string;
      content = formData.get('content') as string;
      textContent = formData.get('textContent') as string;
      blastId = formData.get('blastId') as string;
      inReplyTo = formData.get('inReplyTo') as string;
      replyToMessageId = formData.get('replyToMessageId') as string;

      // Get attachments
      const attachmentFiles = formData.getAll('attachments');
      attachments = attachmentFiles.filter(f => f instanceof File) as File[];
    } else {
      // Handle JSON (no attachments)
      const body = await request.json();
      emailAccountId = body.emailAccountId;
      contactId = body.contactId;
      toEmails = body.toEmails;
      ccEmails = body.ccEmails || [];
      bccEmails = body.bccEmails || [];
      subject = body.subject;
      content = body.content;
      textContent = body.textContent;
      blastId = body.blastId;
      inReplyTo = body.inReplyTo;
      replyToMessageId = body.replyToMessageId;
    }

    // Enforce team restriction: must send from assigned email account
    const session = await getServerSession(authOptions)
    if (session?.user?.role === 'TEAM_USER') {
      if (!session.user.assignedEmailId || session.user.assignedEmailId !== emailAccountId) {
        return NextResponse.json(
          { error: 'Forbidden: Team users must send from their assigned email account' },
          { status: 403 }
        )
      }
    }

    // Validate required fields
    if (!emailAccountId) {
      return NextResponse.json(
        { error: 'Missing emailAccountId' },
        { status: 400 }
      );
    }

    if (!toEmails || (Array.isArray(toEmails) && toEmails.length === 0)) {
      return NextResponse.json(
        { error: 'Missing toEmails - at least one recipient is required' },
        { status: 400 }
      );
    }

    // Validate email addresses
    const toValidation = validateEmails(Array.isArray(toEmails) ? toEmails : [toEmails])
    if (!toValidation.allValid) {
      return NextResponse.json(
        { error: `Invalid recipient email: ${getEmailValidationError(toValidation.invalid)}` },
        { status: 400 }
      );
    }

    // Validate CC emails if present
    if (ccEmails && ccEmails.length > 0) {
      const ccValidation = validateEmails(ccEmails)
      if (!ccValidation.allValid) {
        return NextResponse.json(
          { error: `Invalid CC email: ${getEmailValidationError(ccValidation.invalid)}` },
          { status: 400 }
        );
      }
    }

    // Validate BCC emails if present
    if (bccEmails && bccEmails.length > 0) {
      const bccValidation = validateEmails(bccEmails)
      if (!bccValidation.allValid) {
        return NextResponse.json(
          { error: `Invalid BCC email: ${getEmailValidationError(bccValidation.invalid)}` },
          { status: 400 }
        );
      }
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Missing subject' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'Missing content' },
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
    console.log('📧 Decrypting SMTP password for:', emailAccount.emailAddress);
    let smtpPassword: string;
    try {
      smtpPassword = decrypt(emailAccount.smtpPassword, emailAccount.smtpPasswordIv);
    } catch (decryptError) {
      console.error('❌ Failed to decrypt SMTP password:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt email credentials. Please update your email account settings.' },
        { status: 500 }
      );
    }

    // Configure SMTP transporter
    const smtpConfig: any = {
      host: emailAccount.smtpHost,
      port: emailAccount.smtpPort,
      auth: {
        user: emailAccount.smtpUsername,
        pass: smtpPassword,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
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

    console.log('📧 Creating SMTP transporter for:', emailAccount.emailAddress);
    const transporter = nodemailer.createTransport(smtpConfig);

    // Prepare email content
    let emailHtml = content;
    
    // Add signature if available
    if (emailAccount.signature) {
      emailHtml += `<br><br>---<br>${emailAccount.signature.replace(/\n/g, '<br>')}`;
    }

    // Prepare attachments for nodemailer
    const mailAttachments = await Promise.all(
      attachments.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          filename: file.name,
          content: buffer,
          contentType: file.type,
        };
      })
    );

    // Prepare mail options
    const mailOptions: any = {
      from: `"${emailAccount.displayName}" <${emailAccount.emailAddress}>`,
      to: toEmails.join(', '),
      cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
      bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
      subject,
      html: emailHtml,
      text: textContent || content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    // Add attachments if any
    if (mailAttachments.length > 0) {
      mailOptions.attachments = mailAttachments;
    }

    // Send email
    console.log('📧 Sending email via SMTP...');
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
    } catch (sendError: any) {
      console.error('❌ Failed to send email:', sendError);
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: sendError.message,
          code: sendError.code
        },
        { status: 500 }
      );
    }

    // Save sent email to IMAP Sent folder (async, don't wait)
    saveSentEmailToImap(emailAccount, mailOptions, info.messageId).catch(err => {
      console.error('Error in saveSentEmailToImap:', err);
    });

    // Build threading information
    let threadId = null
    let references: string[] = []

    if (replyToMessageId) {
      // This is a reply - fetch the original message to get threading info
      try {
        const originalMessage = await prisma.emailMessage.findUnique({
          where: { id: replyToMessageId }
        })

        if (originalMessage) {
          // Build references array
          const originalRefs = (originalMessage.references as string[]) || []
          references = buildReferences(originalRefs, originalMessage.messageId || '')

          // Use the original message's thread ID or message ID
          threadId = originalMessage.threadId || originalMessage.messageId
        }
      } catch (err) {
        console.error('Failed to fetch original message for threading:', err)
      }
    }

    // Auto-create contact for recipient if not provided and contact doesn't exist
    let finalContactId = contactId
    if (!finalContactId && toEmails.length > 0) {
      try {
        const recipientEmail = toEmails[0]
        console.log(`🔍 Looking for contact with email: ${recipientEmail}`)

        // Try to find existing contact
        let contact = await prisma.contact.findFirst({
          where: {
            OR: [
              { email1: recipientEmail },
              { email2: recipientEmail },
              { email3: recipientEmail },
            ]
          }
        })

        // If not found, create new contact
        if (!contact) {
          console.log(`👤 Auto-creating contact for recipient: ${recipientEmail}`)
          const nameParts = recipientEmail.split('@')[0].split('.')
          contact = await prisma.contact.create({
            data: {
              firstName: nameParts[0] || 'Unknown',
              lastName: nameParts.slice(1).join(' ') || '',
              email1: recipientEmail,
            }
          })
          console.log(`✅ Created contact ${contact.id} for ${recipientEmail}`)
        }

        finalContactId = contact.id
      } catch (err: any) {
        console.error(`⚠️ Failed to auto-create contact for recipient:`, err.message)
        // Don't fail the email send if contact creation fails
      }
    }

    // Save to database first to get message ID
    let emailMessage: any = null
    try {
      emailMessage = await prisma.emailMessage.create({
        data: {
          messageId: info.messageId,
          contactId: finalContactId || null,
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
          deliveredAt: new Date(),
          blastId: blastId || null,
          threadId: threadId || info.messageId, // Use thread ID or this message's ID
          inReplyTo: inReplyTo || null,
          references,
          attachments: null, // Will update after saving files
        },
      })
      console.log('✅ Email saved to database:', emailMessage.id);

      // Save attachments to disk and update database
      if (attachments.length > 0) {
        console.log(`💾 Saving ${attachments.length} attachments to disk...`)
        const savedAttachments = await saveAttachments(attachments, emailMessage.id)

        // Update email message with attachment URLs
        await prisma.emailMessage.update({
          where: { id: emailMessage.id },
          data: {
            attachments: savedAttachments
          }
        })
        console.log(`✅ Saved ${savedAttachments.length} attachments`)
      }
    } catch (err) {
      console.error('⚠️ Warning: email sent but failed to persist emailMessage:', err)
      // Do not fail the request; email was sent successfully
    }

    // Emit Socket.IO event for real-time update
    try {
      emitToAccount(emailAccountId, 'email:sent', {
        accountId: emailAccountId,
        emailAddress: emailAccount.emailAddress,
        messageId: info.messageId,
        subject,
        to: toEmails,
        timestamp: new Date().toISOString(),
      });
    } catch (socketError) {
      console.error('⚠️ Failed to emit Socket.IO event:', socketError);
    }

    // Update or create conversation if finalContactId is provided
    if (finalContactId && prisma.emailConversation) {
      try {
        const primaryEmail = toEmails[0];
        await prisma.emailConversation.upsert({
          where: {
            contactId_emailAddress: {
              contactId: finalContactId,
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
            contactId: finalContactId,
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
    console.error('❌ Error sending email:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

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
