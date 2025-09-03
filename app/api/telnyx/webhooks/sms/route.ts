import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, event_type, occurred_at, id: webhookId } = body;

    console.log('Telnyx SMS webhook received:', {
      event_type,
      webhookId,
      occurred_at,
      messageId: data?.payload?.id
    });

    // Verify webhook signature (optional but recommended)
    // const signature = request.headers.get('telnyx-signature-ed25519');
    // const timestamp = request.headers.get('telnyx-timestamp');
    // if (!verifyWebhookSignature(body, signature, timestamp)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const payload = data?.payload || data;

    switch (event_type) {
      case 'message.sent':
        await handleMessageSent(payload);
        break;
      case 'message.delivered':
        await handleMessageDelivered(payload);
        break;
      case 'message.delivery_failed':
        await handleMessageDeliveryFailed(payload);
        break;
      case 'message.received':
        await handleMessageReceived(payload);
        break;
      case 'message.finalized':
        await handleMessageFinalized(payload);
        break;
      default:
        console.log('Unhandled webhook event type:', event_type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Telnyx SMS webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function handleMessageSent(data: any) {
  try {
    if (!prisma.telnyxMessage) return;

    await prisma.telnyxMessage.updateMany({
      where: { telnyxMessageId: data.id },
      data: {
        status: 'sent',
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling message sent:', error);
  }
}

async function handleMessageDelivered(data: any) {
  try {
    if (!prisma.telnyxMessage) return;

    await prisma.telnyxMessage.updateMany({
      where: { telnyxMessageId: data.id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        webhookData: data,
        updatedAt: new Date(),
      },
    });

    // Update billing with final delivery cost
    if (data.cost && data.cost.amount && prisma.telnyxBilling) {
      const finalCost = parseFloat(data.cost.amount);

      // Check if billing record already exists
      const existingBilling = await prisma.telnyxBilling.findFirst({
        where: {
          recordId: data.id,
          recordType: 'sms',
        },
      });

      if (existingBilling) {
        // Record exists - check if cost changed and update if needed
        const existingCost = parseFloat(existingBilling.cost.toString());

        if (existingCost !== finalCost) {
          console.log(`SMS ${data.id}: Cost changed from $${existingCost} to $${finalCost}`);

          // Calculate the difference for phone number total cost adjustment
          const costDifference = finalCost - existingCost;

          // Update billing record with final cost
          await prisma.telnyxBilling.update({
            where: { id: existingBilling.id },
            data: {
              cost: finalCost,
              description: `SMS delivered to ${data.to?.[0]?.phone_number || data.to} (Final cost)`,
              metadata: data,
            },
          });

          // Adjust phone number total cost by the difference
          if (prisma.telnyxPhoneNumber) {
            await prisma.telnyxPhoneNumber.updateMany({
              where: { phoneNumber: data.from?.phone_number || data.from },
              data: {
                totalCost: { increment: costDifference },
              },
            });
          }
        } else {
          console.log(`SMS ${data.id}: Cost unchanged at $${finalCost}`);
        }
      } else {
        // No existing record - create new one (fallback case)
        console.log(`SMS ${data.id}: Creating new billing record with cost $${finalCost}`);

        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: data.from?.phone_number || data.from,
            recordType: 'sms',
            recordId: data.id,
            cost: finalCost,
            currency: data.cost.currency || 'USD',
            billingDate: new Date(),
            description: `SMS delivered to ${data.to?.[0]?.phone_number || data.to}`,
            metadata: data,
          },
        });

        // Update phone number total cost
        if (prisma.telnyxPhoneNumber) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: data.from?.phone_number || data.from },
            data: {
              totalCost: { increment: finalCost },
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error handling message delivered:', error);
  }
}

async function handleMessageDeliveryFailed(data: any) {
  try {
    if (!prisma.telnyxMessage) return;

    await prisma.telnyxMessage.updateMany({
      where: { telnyxMessageId: data.id },
      data: {
        status: 'delivery_failed',
        failedAt: new Date(),
        errorCode: data.errors?.[0]?.code,
        errorMessage: data.errors?.[0]?.title || data.errors?.[0]?.detail,
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling message delivery failed:', error);
  }
}

async function handleMessageReceived(data: any) {
  try {
    // Find contact by phone number
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { phone1: data.from?.phone_number || data.from },
          { phone2: data.from?.phone_number || data.from },
          { phone3: data.from?.phone_number || data.from },
        ],
      },
    });

    // Save received message (skip if models not available)
    if (prisma.telnyxMessage) {
      await prisma.telnyxMessage.create({
        data: {
          telnyxMessageId: data.id,
          contactId: contact?.id || null,
          fromNumber: data.from?.phone_number || data.from,
          toNumber: data.to?.[0]?.phone_number || data.to,
          direction: 'inbound',
          content: data.text,
          status: 'received',
          segments: data.parts || 1,
          webhookData: data,
        },
      });
    }

    // Update phone number usage stats (skip if models not available)
    if (prisma.telnyxPhoneNumber) {
      await prisma.telnyxPhoneNumber.updateMany({
        where: { phoneNumber: data.to?.[0]?.phone_number || data.to },
        data: {
          totalSmsCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    }

    // Update or create conversation
    if (contact && prisma.conversation) {
      await prisma.conversation.upsert({
        where: {
          contact_id_phone_number: {
            contact_id: contact.id,
            phone_number: data.from?.phone_number || data.from,
          }
        },
        update: {
          last_message_content: data.text,
          last_message_at: new Date(),
          last_message_direction: 'inbound',
          message_count: { increment: 1 },
          unread_count: { increment: 1 },
          updated_at: new Date(),
        },
        create: {
          contact_id: contact.id,
          phone_number: data.from?.phone_number || data.from,
          channel: 'sms',
          last_message_content: data.text,
          last_message_at: new Date(),
          last_message_direction: 'inbound',
          message_count: 1,
          unread_count: 1,
          status: 'active',
          priority: 'normal',
        }
      });
    }

    // TODO: Emit real-time event via WebSocket for live updates
    console.log('New SMS received:', {
      from: data.from?.phone_number || data.from,
      to: data.to?.[0]?.phone_number || data.to,
      text: data.text,
      contactId: contact?.id,
    });
  } catch (error) {
    console.error('Error handling message received:', error);
  }
}

async function handleMessageFinalized(data: any) {
  try {
    if (!prisma.telnyxMessage) return;

    await prisma.telnyxMessage.updateMany({
      where: { telnyxMessageId: data.id },
      data: {
        status: data.to?.[0]?.status || 'finalized',
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling message finalized:', error);
  }
}
