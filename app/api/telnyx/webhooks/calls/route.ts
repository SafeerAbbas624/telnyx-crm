import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, event_type, occurred_at, id: webhookId } = body;

    console.log('Telnyx Call webhook received:', {
      event_type,
      webhookId,
      occurred_at,
      callControlId: data?.payload?.call_control_id
    });

    const payload = data?.payload || data;

    switch (event_type) {
      case 'call.initiated':
        await handleCallInitiated(payload);
        break;
      case 'call.ringing':
        await handleCallRinging(payload);
        break;
      case 'call.answered':
        await handleCallAnswered(payload);
        break;
      case 'call.bridged':
        await handleCallBridged(payload);
        break;
      case 'call.hangup':
        await handleCallHangup(payload);
        break;
      case 'call.recording.saved':
        await handleRecordingSaved(payload);
        break;
      case 'call.machine.detection.ended':
        await handleMachineDetectionEnded(payload);
        break;
      default:
        console.log('Unhandled call webhook event type:', event_type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Telnyx call webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function handleCallInitiated(data: any) {
  try {
    if (!prisma.telnyxCall) return;

    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'initiated',
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling call initiated:', error);
  }
}

async function handleCallRinging(data: any) {
  try {
    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'ringing',
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling call ringing:', error);
  }
}

async function handleCallAnswered(data: any) {
  try {
    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'answered',
        answeredAt: new Date(),
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling call answered:', error);
  }
}

async function handleCallBridged(data: any) {
  try {
    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'bridged',
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling call bridged:', error);
  }
}

async function handleCallHangup(data: any) {
  try {
    if (!prisma.telnyxCall) return;

    const duration = data.call_duration_secs || 0;

    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'hangup',
        duration,
        endedAt: new Date(),
        hangupCause: data.hangup_cause,
        webhookData: data,
        updatedAt: new Date(),
      },
    });

    // Update billing if cost is available
    if (data.cost && data.cost.amount && prisma.telnyxBilling) {
      const call = await prisma.telnyxCall.findFirst({
        where: { telnyxCallId: data.call_control_id },
      });

      if (call) {
        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: call.fromNumber,
            recordType: 'call',
            recordId: data.call_control_id,
            cost: parseFloat(data.cost.amount),
            currency: data.cost.currency || 'USD',
            billingDate: new Date(),
            description: `Call to ${call.toNumber} (${duration}s)`,
            metadata: data,
          },
        });

        // Update phone number total cost
        if (prisma.telnyxPhoneNumber) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: call.fromNumber },
            data: {
              totalCost: { increment: parseFloat(data.cost.amount) },
            },
          });
        }

        // Update call record with cost
        await prisma.telnyxCall.updateMany({
          where: { telnyxCallId: data.call_control_id },
          data: {
            cost: parseFloat(data.cost.amount),
          },
        });
      }
    }
  } catch (error) {
    console.error('Error handling call hangup:', error);
  }
}

async function handleRecordingSaved(data: any) {
  try {
    if (!prisma.telnyxCall) return;

    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        recordingUrl: data.recording_urls?.mp3 || data.recording_url,
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling recording saved:', error);
  }
}

async function handleMachineDetectionEnded(data: any) {
  try {
    if (!prisma.telnyxCall) return;

    console.log('Machine detection result:', {
      callControlId: data.call_control_id,
      result: data.result,
      confidence: data.confidence
    });

    // Update call record with machine detection result
    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        webhookData: data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error handling machine detection ended:', error);
  }
}
