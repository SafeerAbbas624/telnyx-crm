import { prisma } from '@/lib/db';
import { formatPhoneNumberForTelnyx, isValidE164PhoneNumber } from '@/lib/phone-utils';

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_API_URL = 'https://api.telnyx.com/v2/messages';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS message for a text blast using Telnyx API directly (no session required)
 */
export async function sendTextBlastSms(
  fromNumber: string,
  toNumber: string,
  body: string,
  contactId: string,
  blastId: string
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
      console.error('[TextBlastSMS] Telnyx API error:', telnyxData);
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
        blastId: blastId,
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
            description: `Text blast SMS to ${formattedToNumber}`,
            metadata: telnyxData.data,
          },
        });
      } catch (error) {
        console.error('[TextBlastSMS] Error creating billing record:', error);
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
    console.error('[TextBlastSMS] Error:', error);
    return { success: false, error: error.message || 'Unknown error sending SMS' };
  }
}

async function updateConversation(
  contactId: string,
  fromNumber: string,
  toNumber: string,
  message: string
) {
  try {
    // Use E.164 format for phone numbers (consistent with conversations table)
    // toNumber should already be in E.164 format from formatPhoneNumberForTelnyx
    console.log(`[TextBlastSMS] Updating conversation for contactId=${contactId}, from=${fromNumber}, to=${toNumber}`);

    // Check for existing conversation with this contact
    const existing = await prisma.conversation.findFirst({
      where: { contact_id: contactId }
    });

    if (existing) {
      console.log(`[TextBlastSMS] Updating existing conversation ${existing.id}`);
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          phone_number: toNumber, // Keep E.164 format
          our_number: fromNumber,
          last_message_content: message,
          last_message_at: new Date(),
          last_message_direction: 'outbound',
          last_sender_number: fromNumber,
          message_count: (existing.message_count ?? 0) + 1,
          updated_at: new Date(),
        }
      });
    } else {
      console.log(`[TextBlastSMS] Creating new conversation for contact ${contactId}`);
      await prisma.conversation.create({
        data: {
          contact_id: contactId,
          phone_number: toNumber, // Keep E.164 format
          our_number: fromNumber,
          channel: 'sms',
          last_message_content: message,
          last_message_at: new Date(),
          last_message_direction: 'outbound',
          last_sender_number: fromNumber,
          message_count: 1,
          unread_count: 0,
          status: 'active',
          priority: 'normal',
        }
      });
      console.log(`[TextBlastSMS] Created new conversation for contact ${contactId}`);
    }
  } catch (error) {
    console.error('[TextBlastSMS] Error updating conversation:', error);
  }
}

