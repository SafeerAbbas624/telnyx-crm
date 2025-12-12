import { prisma } from '@/lib/db';
import { formatPhoneNumberForTelnyx, isValidE164PhoneNumber, last10Digits } from '@/lib/phone-utils';
import { decrypt } from '@/lib/encryption';
import nodemailer from 'nodemailer';

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_API_URL = 'https://api.telnyx.com/v2/messages';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS message using Telnyx API
 */
export async function sendScheduledSms(
  fromNumber: string,
  toNumber: string,
  body: string,
  contactId: string
): Promise<SendResult> {
  try {
    if (!TELNYX_API_KEY) {
      return { success: false, error: 'Telnyx API key not configured' };
    }

    const formattedFromNumber = formatPhoneNumberForTelnyx(fromNumber);
    const formattedToNumber = formatPhoneNumberForTelnyx(toNumber);

    if (!formattedFromNumber || !isValidE164PhoneNumber(formattedFromNumber)) {
      return { success: false, error: `Invalid from number format: ${fromNumber}` };
    }

    if (!formattedToNumber || !isValidE164PhoneNumber(formattedToNumber)) {
      return { success: false, error: `Invalid to number format: ${toNumber}` };
    }

    // Verify the phone number exists in our system
    const phoneNumber = await prisma.telnyxPhoneNumber.findFirst({
      where: {
        OR: [
          { phoneNumber: fromNumber },
          { phoneNumber: formattedFromNumber }
        ]
      }
    });

    if (!phoneNumber) {
      return { success: false, error: `From number not found: ${formattedFromNumber}` };
    }

    // Build webhook URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const baseWebhook = appUrl && appUrl.startsWith('https')
      ? appUrl
      : (process.env.TELNYX_PROD_WEBHOOK_URL || 'https://adlercapitalcrm.com');

    // Send SMS via Telnyx API
    const telnyxResponse = await fetch(TELNYX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formattedFromNumber,
        to: formattedToNumber,
        text: body,
        webhook_url: `${baseWebhook}/api/telnyx/webhooks/sms`,
        webhook_failover_url: `${baseWebhook}/api/telnyx/webhooks/sms-failover`,
        use_profile_webhooks: false,
      }),
    });

    const telnyxData = await telnyxResponse.json();

    if (!telnyxResponse.ok) {
      console.error('[ScheduledSMS] Telnyx API error:', telnyxData);
      return { success: false, error: telnyxData.errors?.[0]?.detail || 'Failed to send SMS via Telnyx' };
    }

    // Save message to database
    const savedMessage = await prisma.telnyxMessage.create({
      data: {
        telnyxMessageId: telnyxData.data.id,
        contactId: contactId,
        fromNumber: formattedFromNumber,
        toNumber: formattedToNumber,
        direction: 'outbound',
        content: body,
        status: 'queued',
        segments: telnyxData.data.parts || 1,
        cost: telnyxData.data.cost?.amount ? parseFloat(telnyxData.data.cost.amount) : null,
      },
    });

    // Create billing record
    if (telnyxData.data.cost?.amount) {
      try {
        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: formattedFromNumber,
            recordType: 'sms',
            recordId: telnyxData.data.id,
            cost: parseFloat(telnyxData.data.cost.amount),
            currency: telnyxData.data.cost.currency || 'USD',
            billingDate: new Date(),
            description: `Scheduled SMS sent to ${formattedToNumber}`,
            metadata: telnyxData.data,
          },
        });
      } catch (error) {
        console.error('[ScheduledSMS] Error creating billing record:', error);
      }
    }

    // Update or create conversation
    await updateConversation(contactId, formattedFromNumber, formattedToNumber, body);

    // Update phone number stats
    await prisma.telnyxPhoneNumber.update({
      where: { phoneNumber: phoneNumber.phoneNumber },
      data: {
        totalSmsCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return { success: true, messageId: savedMessage.id };
  } catch (error: any) {
    console.error('[ScheduledSMS] Error:', error);
    return { success: false, error: error.message || 'Unknown error sending SMS' };
  }
}

async function updateConversation(
  contactId: string,
  fromNumber: string,
  toNumber: string,
  body: string
) {
  try {
    const normalizedTo = toNumber;
    const last10 = last10Digits(toNumber);

    const existing = await prisma.conversation.findFirst({
      where: {
        contact_id: contactId,
        OR: [
          { phone_number: normalizedTo },
          ...(last10 ? [{ phone_number: { endsWith: last10 } }] : [])
        ]
      },
      orderBy: { updated_at: 'desc' }
    });

    if (existing) {
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          phone_number: normalizedTo,
          our_number: fromNumber,
          last_message_content: body,
          last_message_at: new Date(),
          last_message_direction: 'outbound',
          last_sender_number: fromNumber,
          message_count: (existing.message_count ?? 0) + 1,
          updated_at: new Date(),
        }
      });
    } else {
      await prisma.conversation.create({
        data: {
          contact_id: contactId,
          phone_number: normalizedTo,
          our_number: fromNumber,
          channel: 'sms',
          last_message_content: body,
          last_message_at: new Date(),
          last_message_direction: 'outbound',
          last_sender_number: fromNumber,
          message_count: 1,
          unread_count: 0,
          status: 'active',
          priority: 'normal',
        }
      });
    }
  } catch (error) {
    console.error('[ScheduledSMS] Error updating conversation:', error);
  }
}

/**
 * Send a scheduled email using the email account associated with fromEmail
 */
export async function sendScheduledEmail(
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string,
  contactId: string
): Promise<SendResult> {
  try {
    // Find the email account for this fromEmail
    const emailAccount = await prisma.emailAccount.findFirst({
      where: { emailAddress: fromEmail },
    });

    if (!emailAccount) {
      return { success: false, error: `Email account not found for: ${fromEmail}` };
    }

    // Decrypt SMTP password
    const smtpPassword = decrypt(emailAccount.smtpPassword, emailAccount.smtpPasswordIv);

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: emailAccount.smtpHost,
      port: emailAccount.smtpPort,
      secure: emailAccount.smtpEncryption === 'SSL',
      auth: {
        user: emailAccount.smtpUsername,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Build mail options
    const mailOptions: any = {
      from: emailAccount.displayName
        ? `"${emailAccount.displayName}" <${emailAccount.emailAddress}>`
        : emailAccount.emailAddress,
      to: toEmail,
      subject: subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''), // Strip HTML for plain text version
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('[ScheduledEmail] Email sent:', info.messageId);

    // Save email to database
    const savedEmail = await prisma.emailMessage.create({
      data: {
        messageId: info.messageId,
        contactId: contactId,
        emailAccountId: emailAccount.id,
        fromEmail: emailAccount.emailAddress,
        fromName: emailAccount.displayName,
        toEmails: [toEmail],
        ccEmails: [],
        bccEmails: [],
        subject: subject,
        content: body,
        textContent: body.replace(/<[^>]*>/g, ''),
        direction: 'outbound',
        status: 'sent',
        sentAt: new Date(),
      },
    });

    // Update or create email conversation
    await updateEmailConversation(contactId, toEmail, subject, body);

    // Create activity record
    await prisma.activity.create({
      data: {
        contact_id: contactId,
        type: 'email',
        title: `Scheduled Email: ${subject}`,
        description: `Scheduled email sent to ${toEmail}`,
        status: 'completed',
        completed_at: new Date(),
      },
    });

    return { success: true, messageId: savedEmail.id };
  } catch (error: any) {
    console.error('[ScheduledEmail] Error:', error);
    return { success: false, error: error.message || 'Unknown error sending email' };
  }
}

async function updateEmailConversation(
  contactId: string,
  toEmail: string,
  subject: string,
  body: string
) {
  try {
    const existing = await prisma.emailConversation.findFirst({
      where: {
        contactId: contactId,
        emailAddress: toEmail,
      },
    });

    const preview = body.replace(/<[^>]*>/g, '').substring(0, 100);

    if (existing) {
      await prisma.emailConversation.update({
        where: { id: existing.id },
        data: {
          lastMessageContent: preview,
          lastMessageAt: new Date(),
          lastMessageDirection: 'outbound',
          messageCount: { increment: 1 },
        },
      });
    } else {
      await prisma.emailConversation.create({
        data: {
          contactId: contactId,
          emailAddress: toEmail,
          lastMessageContent: preview,
          lastMessageAt: new Date(),
          lastMessageDirection: 'outbound',
          messageCount: 1,
          unreadCount: 0,
        },
      });
    }
  } catch (error) {
    console.error('[ScheduledEmail] Error updating email conversation:', error);
  }
}

