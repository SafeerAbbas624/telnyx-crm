import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendScheduledSms, sendScheduledEmail } from '@/lib/scheduled-message-service';

export const dynamic = 'force-dynamic';

/**
 * Process scheduled messages that are due to be sent.
 * This endpoint should be called by a cron job or worker every minute.
 *
 * Security: Accepts either CRON_SECRET authorization header or INTERNAL_API_KEY
 */
async function processScheduledMessages(request: NextRequest) {
  try {
    // Verify the request is from a trusted cron service or internal worker
    const authHeader = request.headers.get('authorization');
    const internalKey = request.headers.get('x-internal-key');
    const cronSecret = process.env.CRON_SECRET;
    const internalApiKey = process.env.INTERNAL_API_KEY;

    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (internalApiKey && internalKey === internalApiKey) ||
      (!cronSecret && !internalApiKey); // Allow if no secrets configured (dev mode)

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    console.log(`[ScheduledMessages] Processing scheduled messages at ${now.toISOString()}`);

    // Find all PENDING messages where scheduledAt <= now
    const pendingMessages = await prisma.scheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            email1: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50, // Process up to 50 messages per run to avoid timeouts
    });

    console.log(`[ScheduledMessages] Found ${pendingMessages.length} pending messages to process`);

    if (pendingMessages.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        message: 'No scheduled messages to process',
      });
    }

    // Mark all as SENDING to prevent double-processing
    const messageIds = pendingMessages.map((m) => m.id);
    await prisma.scheduledMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { status: 'SENDING' },
    });

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; status: string; error?: string }> = [];

    // Process each message
    for (const message of pendingMessages) {
      try {
        let result;

        if (message.channel === 'SMS') {
          // Process SMS
          if (!message.fromNumber || !message.toNumber) {
            throw new Error('SMS requires fromNumber and toNumber');
          }

          result = await sendScheduledSms(
            message.fromNumber,
            message.toNumber,
            message.body,
            message.contactId
          );
        } else if (message.channel === 'EMAIL') {
          // Process Email
          if (!message.fromEmail || !message.toEmail || !message.subject) {
            throw new Error('Email requires fromEmail, toEmail, and subject');
          }

          result = await sendScheduledEmail(
            message.fromEmail,
            message.toEmail,
            message.subject,
            message.body,
            message.contactId
          );
        } else {
          throw new Error(`Unknown channel: ${message.channel}`);
        }

        if (result.success) {
          // Mark as SENT
          await prisma.scheduledMessage.update({
            where: { id: message.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              metadata: {
                ...(message.metadata as object || {}),
                resultMessageId: result.messageId,
              },
            },
          });
          sentCount++;
          results.push({ id: message.id, status: 'SENT' });
          console.log(`[ScheduledMessages] Successfully sent ${message.channel} message ${message.id}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error: any) {
        // Mark as FAILED
        await prisma.scheduledMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: error.message || 'Unknown error',
          },
        });
        failedCount++;
        results.push({ id: message.id, status: 'FAILED', error: error.message });
        console.error(`[ScheduledMessages] Failed to send message ${message.id}:`, error.message);
      }
    }

    console.log(`[ScheduledMessages] Completed: ${sentCount} sent, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      processed: pendingMessages.length,
      sent: sentCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error('[ScheduledMessages] Error processing scheduled messages:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled messages', details: error.message },
      { status: 500 }
    );
  }
}

// Support both GET (for external cron services) and POST (for internal worker)
export async function GET(request: NextRequest) {
  return processScheduledMessages(request);
}

export async function POST(request: NextRequest) {
  return processScheduledMessages(request);
}
