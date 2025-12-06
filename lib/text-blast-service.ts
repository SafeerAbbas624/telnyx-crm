import { prisma } from '@/lib/db';
import { formatPhoneNumberForTelnyx, isValidE164PhoneNumber, last10Digits } from '@/lib/phone-utils';

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
    // Check for existing conversation with this contact
    const existing = await prisma.conversation.findFirst({
      where: { contact_id: contactId }
    });

    if (existing) {
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          last_message_at: new Date(),
          last_message: message.substring(0, 160),
        }
      });
    } else {
      await prisma.conversation.create({
        data: {
          contact_id: contactId,
          phone_number: last10Digits(toNumber),
          our_number: last10Digits(fromNumber),
          last_message_at: new Date(),
          last_message: message.substring(0, 160),
        }
      });
    }
  } catch (error) {
    console.error('[TextBlastSMS] Error updating conversation:', error);
  }
}

