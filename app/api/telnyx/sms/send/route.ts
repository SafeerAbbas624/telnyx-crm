import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPhoneNumberForTelnyx, isValidE164PhoneNumber, last10Digits } from '@/lib/phone-utils';

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_API_URL = 'https://api.telnyx.com/v2/messages';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromNumber, toNumber, message, contactId, blastId, automationId } = body;

    if (!TELNYX_API_KEY) {
      return NextResponse.json(
        { error: 'Telnyx API key not configured' },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!fromNumber || !toNumber || !message) {
      return NextResponse.json(
        { error: 'From number, to number, and message are required' },
        { status: 400 }
      );
    }

    // Format phone numbers to E.164 format
    const formattedFromNumber = formatPhoneNumberForTelnyx(fromNumber);
    const formattedToNumber = formatPhoneNumberForTelnyx(toNumber);

    if (!formattedFromNumber || !isValidE164PhoneNumber(formattedFromNumber)) {
      return NextResponse.json(
        { error: `Invalid from number format: ${fromNumber}. Expected E.164 format (e.g., +1234567890)` },
        { status: 400 }
      );
    }

    if (!formattedToNumber || !isValidE164PhoneNumber(formattedToNumber)) {
      return NextResponse.json(
        { error: `Invalid to number format: ${toNumber}. Expected E.164 format (e.g., +1234567890)` },
        { status: 400 }
      );
    }

    console.log(`Formatted phone numbers: ${fromNumber} -> ${formattedFromNumber}, ${toNumber} -> ${formattedToNumber}`);

    // Test mode - only if explicitly enabled or using test numbers
    const isTestMode = process.env.TELNYX_TEST_MODE === 'true' ||
                      formattedFromNumber.startsWith('+1234567');

    if (isTestMode) {
      console.log('TEST MODE: Simulating SMS send from', formattedFromNumber, 'to', formattedToNumber);
      const mockMessageId = `test_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save to database as if it was sent
      const savedMessage = await prisma.telnyxMessage.create({
        data: {
          telnyxMessageId: mockMessageId,
          contactId: contactId || null,
          fromNumber: formattedFromNumber,
          toNumber: formattedToNumber,
          direction: 'outbound',
          content: message,
          status: 'sent', // Simulate as sent in test mode
          segments: Math.ceil(message.length / 160),
          cost: 0.01, // Mock cost
          blastId: blastId || null,
          automationId: automationId || null,
        },
      });

      // Create billing record for test mode
      if (prisma.telnyxBilling) {
        try {
          await prisma.telnyxBilling.create({
            data: {
              phoneNumber: formattedFromNumber,
              recordType: 'sms',
              recordId: mockMessageId,
              cost: 0.01,
              currency: 'USD',
              billingDate: new Date(),
              description: `SMS sent to ${formattedToNumber} (TEST MODE)`,
              metadata: { testMode: true, message, contactId },
            },
          });
        } catch (error) {
          console.error('Error creating test billing record:', error);
        }
      }

      // Update or create conversation for test mode too (normalized + last-10 fallback)
      if (contactId && prisma.conversation) {
        try {
          const normalizedTo = formattedToNumber
          const last10 = last10Digits(formattedToNumber)

          const existing = await prisma.conversation.findFirst({
            where: {
              contact_id: contactId,
              OR: [
                { phone_number: normalizedTo },
                ...(last10 ? [{ phone_number: { endsWith: last10 } }] : [])
              ]
            },
            orderBy: { updated_at: 'desc' }
          })

          if (existing) {
            await prisma.conversation.update({
              where: { id: existing.id },
              data: {
                phone_number: normalizedTo,
                last_message_content: message,
                last_message_at: new Date(),
                last_message_direction: 'outbound',
                last_sender_number: formattedFromNumber,
                message_count: (existing.message_count ?? 0) + 1,
                updated_at: new Date(),
              }
            })
          } else {
            await prisma.conversation.create({
              data: {
                contact_id: contactId,
                phone_number: normalizedTo,
                channel: 'sms',
                last_message_content: message,
                last_message_at: new Date(),
                last_message_direction: 'outbound',
                last_sender_number: formattedFromNumber,
                message_count: 1,
                unread_count: 0,
                status: 'active',
                priority: 'normal',
              }
            })
          }
        } catch (error) {
          console.error('Error updating conversation in test mode:', error);
        }
      }

      return NextResponse.json({
        success: true,
        messageId: mockMessageId,
        status: 'sent',
        message: 'SMS simulated successfully (TEST MODE)',
        data: savedMessage
      });
    }

    // Check if the from number exists in our database (try both original and formatted)
    let phoneNumber = await prisma.telnyxPhoneNumber.findUnique({
      where: { phoneNumber: fromNumber },
    });

    if (!phoneNumber) {
      phoneNumber = await prisma.telnyxPhoneNumber.findUnique({
        where: { phoneNumber: formattedFromNumber },
      });
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: `From number not found in your phone numbers: ${formattedFromNumber}` },
        { status: 404 }
      );
    }

    // Build webhook URLs with HTTPS fallback for local/dev
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const baseWebhook = appUrl && appUrl.startsWith('https')
      ? appUrl
      : (process.env.TELNYX_PROD_WEBHOOK_URL || 'https://adlercapitalcrm.com')

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
        text: message,
        webhook_url: `${baseWebhook}/api/telnyx/webhooks/sms`,
        webhook_failover_url: `${baseWebhook}/api/telnyx/webhooks/sms-failover`,
        use_profile_webhooks: false,
      }),
    });

    const telnyxData = await telnyxResponse.json();

    if (!telnyxResponse.ok) {
      console.error('Telnyx API error:', telnyxData);
      return NextResponse.json(
        { error: 'Failed to send SMS via Telnyx', details: telnyxData },
        { status: 400 }
      );
    }

    // Save message to database (skip if models not available)
    let savedMessage = null;
    if (prisma.telnyxMessage) {
      savedMessage = await prisma.telnyxMessage.create({
        data: {
          telnyxMessageId: telnyxData.data.id,
          contactId: contactId || null,
          fromNumber: formattedFromNumber,
          toNumber: formattedToNumber,
          direction: 'outbound',
          content: message,
          status: 'queued',
          segments: telnyxData.data.parts || 1,
          cost: telnyxData.data.cost?.amount ? parseFloat(telnyxData.data.cost.amount) : null,
          blastId: blastId || null,
          automationId: automationId || null,
        },
      });
    }

    // Create billing record immediately (don't wait for webhook)
    if (telnyxData.data.cost?.amount && prisma.telnyxBilling) {
      try {
        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: formattedFromNumber,
            recordType: 'sms',
            recordId: telnyxData.data.id,
            cost: parseFloat(telnyxData.data.cost.amount),
            currency: telnyxData.data.cost.currency || 'USD',
            billingDate: new Date(),
            description: `SMS sent to ${formattedToNumber}`,
            metadata: telnyxData.data,
          },
        });
      } catch (error) {
        console.error('Error creating billing record:', error);
        // Don't fail the SMS send if billing fails
      }
    }

    // Update or create conversation for this message (normalized + last-10 fallback)
    // CRITICAL: Track our_number (the Telnyx line we're sending from) for multi-number routing
    if (contactId && prisma.conversation) {
      try {
        const normalizedTo = formattedToNumber
        const last10 = last10Digits(formattedToNumber)

        const existing = await prisma.conversation.findFirst({
          where: {
            contact_id: contactId,
            OR: [
              { phone_number: normalizedTo },
              ...(last10 ? [{ phone_number: { endsWith: last10 } }] : [])
            ]
          },
          orderBy: { updated_at: 'desc' }
        })

        if (existing) {
          await prisma.conversation.update({
            where: { id: existing.id },
            data: {
              phone_number: normalizedTo,
              our_number: formattedFromNumber, // Track which line we sent from
              last_message_content: message,
              last_message_at: new Date(),
              last_message_direction: 'outbound',
              last_sender_number: formattedFromNumber,
              message_count: (existing.message_count ?? 0) + 1,
              updated_at: new Date(),
            }
          })
        } else {
          await prisma.conversation.create({
            data: {
              contact_id: contactId,
              phone_number: normalizedTo,
              our_number: formattedFromNumber, // Track which line we sent from
              channel: 'sms',
              last_message_content: message,
              last_message_at: new Date(),
              last_message_direction: 'outbound',
              last_sender_number: formattedFromNumber,
              message_count: 1,
              unread_count: 0,
              status: 'active',
              priority: 'normal',
            }
          })
        }
      } catch (error) {
        console.error('Error updating conversation:', error);
        // Don't fail the SMS send if conversation update fails
      }
    }

    // Update phone number usage stats (skip if models not available)
    if (prisma.telnyxPhoneNumber) {
      await prisma.telnyxPhoneNumber.update({
        where: { phoneNumber: phoneNumber.phoneNumber }, // Use the actual phone number from DB
        data: {
          totalSmsCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      messageId: savedMessage?.id || 'temp-id',
      telnyxMessageId: telnyxData.data.id,
      status: telnyxData.data.to[0]?.status || 'queued',
      cost: telnyxData.data.cost?.amount || null,
      parts: telnyxData.data.parts || 1,
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    );
  }
}
