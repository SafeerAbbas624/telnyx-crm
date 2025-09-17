import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPhoneNumberForTelnyx } from '@/lib/phone-utils';
import { broadcast } from '@/lib/server-events';
import crypto from 'crypto'

function rawToPemEd25519PublicKey(rawBase64: string): string {
  const raw = Buffer.from(rawBase64, 'base64')
  if (raw.length !== 32) throw new Error('Invalid Telnyx public key length')
  // ASN.1 DER prefix for Ed25519 public key (RFC 8410)
  const derPrefix = Buffer.from('302a300506032b6570032100', 'hex')
  const der = Buffer.concat([derPrefix, raw])
  const b64 = der.toString('base64')
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----\n`
  return pem
}

function verifyTelnyxSignature(timestamp: string | null, signature: string | null, body: string): boolean {
  try {
    if (!timestamp || !signature) return false
    const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY
    if (!publicKeyB64) return false
    const pem = rawToPemEd25519PublicKey(publicKeyB64)
    const payload = Buffer.from(`${timestamp}|${body}`)
    const sig = Buffer.from(signature, 'base64')
    const keyObject = crypto.createPublicKey(pem)
    return crypto.verify(null, payload, keyObject, sig)
  } catch (e) {
    console.error('Telnyx signature verification error:', e)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text()
    const json = JSON.parse(rawBody)

    // Telnyx v2 webhooks place event fields under data.*; support both shapes
    const dataContainer = json?.data ?? json
    const event_type = dataContainer?.event_type ?? json?.event_type
    const occurred_at = dataContainer?.occurred_at ?? json?.occurred_at
    const webhookId = dataContainer?.id ?? json?.id

    // Verify webhook signature (Ed25519)
    const signature = request.headers.get('telnyx-signature-ed25519')
    const timestamp = request.headers.get('telnyx-timestamp')
    const valid = verifyTelnyxSignature(timestamp, signature, rawBody)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    console.log('Telnyx SMS webhook received:', {
      event_type,
      webhookId,
      occurred_at,
      messageId: dataContainer?.payload?.id || dataContainer?.id
    });

    const payload = dataContainer?.payload || dataContainer;

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
    const fromRaw: string = data.from?.phone_number || data.from
    const toRaw: string = data.to?.[0]?.phone_number || data.to

    // Normalize numbers
    const fromFormatted = formatPhoneNumberForTelnyx(fromRaw) || fromRaw
    const fromDigits = (fromRaw || '').replace(/\D/g, '')
    const last10 = fromDigits.length >= 10 ? fromDigits.slice(-10) : fromDigits

    // Robust contact lookup: try exacts and last-10 match
    const orClauses: any[] = []
    const candidates = Array.from(new Set([fromRaw, fromFormatted].filter(Boolean))) as string[]
    for (const c of candidates) {
      orClauses.push({ phone1: c }, { phone2: c }, { phone3: c })
    }
    if (last10) {
      orClauses.push(
        { phone1: { endsWith: last10 } },
        { phone2: { endsWith: last10 } },
        { phone3: { endsWith: last10 } },
      )
    }

    let contact = await prisma.contact.findFirst({ where: { OR: orClauses } })

    // Auto-create contact for unknown inbound
    let createdNewContact = false
    if (!contact) {
      const last4 = last10 ? last10.slice(-4) : (fromDigits || '0000').slice(-4)
      contact = await prisma.contact.create({
        data: {
          firstName: 'Unknown',
          lastName: last4 || (fromFormatted || fromRaw),
          phone1: fromFormatted,
          dealStatus: 'lead',
        }
      })
      createdNewContact = true

      // Tag as inbound (optional)
      try {
        const inboundTag = await prisma.tag.upsert({
          where: { name: 'inbound' },
          update: {},
          create: { name: 'inbound' },
        })
        await prisma.contactTag.create({
          data: { contact_id: contact.id, tag_id: inboundTag.id }
        })
      } catch (e) {
        console.warn('Failed to tag inbound contact:', e)
      }
    }

    // Save received message (skip if models not available)
    if (prisma.telnyxMessage) {
      await prisma.telnyxMessage.create({
        data: {
          telnyxMessageId: data.id,
          contactId: contact?.id || null,
          fromNumber: fromFormatted,
          toNumber: toRaw,
          direction: 'inbound',
          content: data.text,
          status: 'received',
          segments: data.parts || 1,
          webhookData: data,
          cost: data.cost?.amount ? parseFloat(data.cost.amount) : undefined,
        },
      })
    }

    // Record inbound SMS cost if present
    if (data.cost?.amount && prisma.telnyxBilling) {
      const inboundCost = parseFloat(data.cost.amount)
      await prisma.telnyxBilling.create({
        data: {
          phoneNumber: toRaw,
          recordType: 'sms',
          recordId: data.id,
          cost: inboundCost,
          currency: data.cost.currency || 'USD',
          billingDate: new Date(),
          description: `Inbound SMS from ${fromFormatted}`,
          metadata: data,
        },
      })
      if (prisma.telnyxPhoneNumber) {
        await prisma.telnyxPhoneNumber.updateMany({
          where: { phoneNumber: toRaw },
          data: { totalCost: { increment: inboundCost } }
        })
      }
    }

    // Update phone number usage stats (skip if models not available)
    if (prisma.telnyxPhoneNumber) {
      await prisma.telnyxPhoneNumber.updateMany({
        where: { phoneNumber: toRaw },
        data: {
          totalSmsCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      })
    }

    // Upsert conversation for this contact (now we always have one)
    if (contact && prisma.conversation) {
      const convPhone = fromFormatted || fromRaw
      await prisma.conversation.upsert({
        where: {
          contact_id_phone_number: {
            contact_id: contact.id,
            phone_number: convPhone,
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
          phone_number: convPhone,
          channel: 'sms',
          last_message_content: data.text,
          last_message_at: new Date(),
          last_message_direction: 'inbound',
          message_count: 1,
          unread_count: 1,
          status: 'active',
          priority: 'normal',
        }
      })
    }

    // Emit real-time event via SSE for live updates
    try {
      broadcast('inbound_sms', {
        from: fromFormatted,
        to: toRaw,
        text: data.text,
        contactId: contact?.id,
        contactName: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || fromFormatted : undefined,
        createdNewContact,
        occurredAt: new Date().toISOString(),
      })
      // Also emit a conversation-level update signal
      if (contact?.id) {
        broadcast('conversation_updated', {
          contactId: contact.id,
          phoneNumber: fromFormatted,
          direction: 'inbound',
        })
      }
    } catch (e) {
      console.warn('Failed to broadcast inbound event:', e)
    }
  } catch (error) {
    console.error('Error handling message received:', error)
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

    // Optional cost reconciliation at finalization
    if (data.cost?.amount && prisma.telnyxBilling) {
      const finalCost = parseFloat(data.cost.amount)
      const existingBilling = await prisma.telnyxBilling.findFirst({
        where: { recordId: data.id, recordType: 'sms' }
      })
      if (existingBilling) {
        const existingCost = parseFloat(existingBilling.cost.toString())
        if (existingCost !== finalCost) {
          const diff = finalCost - existingCost
          await prisma.telnyxBilling.update({
            where: { id: existingBilling.id },
            data: { cost: finalCost, description: `SMS finalized (${data.to?.[0]?.status || 'final'})`, metadata: data }
          })
          if (prisma.telnyxPhoneNumber) {
            await prisma.telnyxPhoneNumber.updateMany({
              where: { phoneNumber: data.from?.phone_number || data.from },
              data: { totalCost: { increment: diff } }
            })
          }
        }
      } else {
        // Create if missing (rare)
        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: data.from?.phone_number || data.from,
            recordType: 'sms',
            recordId: data.id,
            cost: finalCost,
            currency: data.cost.currency || 'USD',
            billingDate: new Date(),
            description: `SMS finalized to ${data.to?.[0]?.phone_number || data.to}`,
            metadata: data,
          },
        })
        if (prisma.telnyxPhoneNumber) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: data.from?.phone_number || data.from },
            data: { totalCost: { increment: finalCost } }
          })
        }
      }
    }
  } catch (error) {
    console.error('Error handling message finalized:', error);
  }
}
