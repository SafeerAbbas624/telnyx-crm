import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Telnyx sends event_type inside body.data.event_type for v2 webhooks.
    // Fall back to root-level fields just in case.
    const data = body?.data ?? body;
    const event_type = data?.event_type ?? body?.event_type;
    const occurred_at = data?.occurred_at ?? body?.occurred_at;
    const webhookId = data?.id ?? body?.id;

    const callControlId = data?.payload?.call_control_id || data?.call_control_id
    const direction = data?.payload?.call_direction || data?.call_direction
    const from = data?.payload?.from || data?.from || data?.payload?.sip_from
    const to = data?.payload?.to || data?.to || data?.payload?.sip_to
    const legId = data?.payload?.leg_id || data?.leg_id
    const sessionId = data?.payload?.call_session_id || data?.call_session_id
    const sipCode = data?.payload?.sip_response_code || data?.sip_response_code

    console.log('[TELNYX WEBHOOK][CALL]', {
      event_type,
      webhookId,
      occurred_at,
      callControlId,
      direction,
      from,
      to,
      legId,
      sessionId,
      sipCode,
    })

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
      case 'call.cost':
        await handleCallCost(payload);
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

// Healthcheck endpoints so Telnyx can validate the webhook URL when toggling features like call cost
export async function GET() {
  return NextResponse.json({ ok: true, service: 'telnyx-calls-webhook', ts: new Date().toISOString() })
}

export async function HEAD() {
  return new NextResponse(null, { status: 204 })
}

}

async function handleCallInitiated(data: any) {
  try {
    if (!prisma.telnyxCall) return;

    console.log('[TELNYX WEBHOOK][CALL] -> initiated', { callControlId: data.call_control_id })

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
    console.log('[TELNYX WEBHOOK][CALL] -> ringing', { callControlId: data.call_control_id })
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
    console.log('[TELNYX WEBHOOK][CALL] -> answered', { callControlId: data.call_control_id })

    // Prefer occurred_at (moment of answer) for talk time; fall back to start_time
    const answeredAtStr = data?.occurred_at || data?.answered_at || data?.start_time
    const answeredAt = answeredAtStr ? new Date(answeredAtStr) : new Date()

    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'answered',
        answeredAt,
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
    console.log('[TELNYX WEBHOOK][CALL] -> bridged', { callControlId: data.call_control_id })
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

    // Prefer Telnyx-provided values; fall back to computing from timestamps
    const endStr = data?.end_time || data?.occurred_at
    const endedAt = endStr ? new Date(endStr) : new Date()

    let duration = (typeof data?.call_duration_secs === 'number') ? data.call_duration_secs : 0

    // If Telnyx didn't provide duration, compute from answered/start to end
    if (!duration || duration <= 0) {
      const call = await prisma.telnyxCall.findFirst({ where: { telnyxCallId: data.call_control_id } })
      const startStr = call?.answeredAt?.toISOString() || data?.start_time || call?.createdAt?.toISOString()
      if (startStr && endedAt) {
        const start = new Date(startStr)
        const seconds = Math.max(0, Math.round((endedAt.getTime() - start.getTime()) / 1000))
        duration = seconds
      }
    }

    console.log('[TELNYX WEBHOOK][CALL] -> hangup', {
      callControlId: data.call_control_id,
      duration,
      cause: data.hangup_cause,
    })

    await prisma.telnyxCall.updateMany({
      where: { telnyxCallId: data.call_control_id },
      data: {
        status: 'hangup',
        duration,
        endedAt,
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
        const amt = parseFloat(data.cost.amount)
        const currency = data.cost.currency || 'USD'
        await prisma.telnyxBilling.create({
          data: {
            phoneNumber: call.fromNumber,
            recordType: 'call',
            recordId: data.call_control_id,
            cost: amt,
            currency,
            billingDate: new Date(),
            description: `Call to ${call.toNumber} (${duration}s)`,
            metadata: data,
          },
        });

        // Update phone number total cost
        if (prisma.telnyxPhoneNumber) {
          await prisma.telnyxPhoneNumber.updateMany({
            where: { phoneNumber: call.fromNumber },
            data: { totalCost: { increment: amt } },
          });
        }

        // Update call record with cost
        await prisma.telnyxCall.updateMany({
          where: { telnyxCallId: data.call_control_id },
          data: { cost: amt },
        });
      }
    } else if (prisma.telnyxBilling) {
      // Fallback: estimate cost if TELNYX_VOICE_RATE_PER_MIN is set
      const rateStr = process.env.TELNYX_VOICE_RATE_PER_MIN
      const rate = rateStr ? parseFloat(rateStr) : undefined
      if (rate && duration > 0) {
        const call = await prisma.telnyxCall.findFirst({
          where: { telnyxCallId: data.call_control_id },
        })
        if (call) {
          const billedMinutes = Math.max(1, Math.ceil(duration / 60))
          const amt = billedMinutes * rate
          const currency = 'USD'
          await prisma.telnyxBilling.create({
            data: {
              phoneNumber: call.fromNumber,
              recordType: 'call',
              recordId: data.call_control_id,
              cost: amt,
              currency,
              billingDate: new Date(),
              description: `Call to ${call.toNumber} (${duration}s) [estimated @ ${rate}/min]`,
              metadata: { estimated: true, ratePerMin: rate, source: 'fallback' },
            },
          })
          // Update phone number total cost incrementally
          if (prisma.telnyxPhoneNumber) {
            await prisma.telnyxPhoneNumber.updateMany({
              where: { phoneNumber: call.fromNumber },
              data: { totalCost: { increment: amt } },
            })
          }
          await prisma.telnyxCall.updateMany({
            where: { telnyxCallId: data.call_control_id },
            data: { cost: amt },
          })
        }
      }
    }
  } catch (error) {
    console.error('Error handling call hangup:', error);
  }
}


async function handleCallCost(data: any) {
  try {
    const amount = (data?.cost?.amount != null)
      ? parseFloat(data.cost.amount)
      : (typeof data?.amount === 'number' ? data.amount : undefined)
    if (amount == null) {
      console.log('call.cost without amount payload')
      return
    }
    const currency = data?.cost?.currency || data?.currency || 'USD'

    const call = await prisma.telnyxCall?.findFirst({
      where: { telnyxCallId: data.call_control_id },
    })

    if (call) {
      const existing = call.cost ? parseFloat(call.cost.toString()) : 0
      const diff = amount - existing

      await prisma.telnyxCall.updateMany({
        where: { telnyxCallId: data.call_control_id },
        data: {
          cost: amount,
          webhookData: data,
          updatedAt: new Date(),
        },
      })

      if (prisma.telnyxBilling) {
        const existingBilling = await prisma.telnyxBilling.findFirst({
          where: { recordId: data.call_control_id, recordType: 'call' },
        })
        if (existingBilling) {
          await prisma.telnyxBilling.update({
            where: { id: existingBilling.id },
            data: {
              cost: amount,
              currency,
              description: `Call cost updated (${amount} ${currency})`,
              metadata: data,
            },
          })
        } else {
          await prisma.telnyxBilling.create({
            data: {
              phoneNumber: call.fromNumber,
              recordType: 'call',
              recordId: data.call_control_id,
              cost: amount,
              currency,
              billingDate: new Date(),
              description: `Call to ${call.toNumber} (${call.duration ?? 0}s)`,
              metadata: data,
            },
          })
        }
      }

      if (diff !== 0 && prisma.telnyxPhoneNumber) {
        await prisma.telnyxPhoneNumber.updateMany({
          where: { phoneNumber: call.fromNumber },
          data: { totalCost: { increment: diff } },
        })
      }
    }
  } catch (error) {
    console.error('Error handling call cost:', error)
  }
}

async function handleRecordingSaved(data: any) {
  try {
    if (!prisma.telnyxCall) return;

    console.log('[TELNYX WEBHOOK][CALL] -> recording.saved', { callControlId: data.call_control_id, mp3: data.recording_urls?.mp3 || data.recording_url })

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
