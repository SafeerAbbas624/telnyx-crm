import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db';
import { formatPhoneNumberForTelnyx, isValidE164PhoneNumber } from '@/lib/phone-utils';

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_CALLS_API_URL = 'https://api.telnyx.com/v2/calls';

export async function GET() {
  try {
    // Temporary workaround: Check if the telnyxCall model exists
    if (!prisma.telnyxCall) {
      console.warn('TelnyxCall model not available in Prisma client. Returning empty array.');
      return NextResponse.json([]);
    }

    const calls = await prisma.telnyxCall.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to last 100 calls
    });

    return NextResponse.json(calls);
  } catch (error) {
    console.error('Error fetching Telnyx calls:', error);
    // Return empty array instead of error to prevent UI crashes
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json();
    const { fromNumber, toNumber, contactId } = body;

    // Team restriction: team users must call from their assigned number
    if (session?.user?.role === 'TEAM_USER') {
      const assigned = session.user.assignedPhoneNumber || ''
      const formattedAssigned = formatPhoneNumberForTelnyx(assigned)
      const formattedFromCandidate = formatPhoneNumberForTelnyx(fromNumber)
      if (!formattedAssigned || !formattedFromCandidate || formattedFromCandidate !== formattedAssigned) {
        return NextResponse.json(
          { error: 'Forbidden: Team users must call from their assigned phone number' },
          { status: 403 }
        )
      }
    }

    if (!TELNYX_API_KEY) {
      return NextResponse.json(
        { error: 'Telnyx API key not configured' },
        { status: 500 }
      );
    }

    if (!process.env.TELNYX_CONNECTION_ID) {
      return NextResponse.json(
        { error: 'Telnyx Connection ID not configured. Please set up a SIP Connection in Telnyx Mission Control.' },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!fromNumber || !toNumber) {
      return NextResponse.json(
        { error: 'From number and to number are required' },
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

    console.log('Call formatting:', {
      originalFrom: fromNumber,
      formattedFrom: formattedFromNumber,
      originalTo: toNumber,
      formattedTo: formattedToNumber,
      connectionId: process.env.TELNYX_CONNECTION_ID
    });

    // Check if the from number exists in our database (skip if models not available)
    if (prisma.telnyxPhoneNumber) {
      const phoneNumber = await prisma.telnyxPhoneNumber.findUnique({
        where: { phoneNumber: formattedFromNumber },
      });

      if (!phoneNumber) {
        return NextResponse.json(
          { error: 'From number not found in your phone numbers' },
          { status: 404 }
        );
      }
    }

    // Build webhook URL: require https. If local (http), fall back to production webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const webhookUrl = appUrl && appUrl.startsWith('https')
      ? `${appUrl}/api/telnyx/webhooks/calls`
      : (process.env.TELNYX_PROD_WEBHOOK_URL || 'https://adlercapitalcrm.com/api/telnyx/webhooks/calls')

    // Initiate call via Telnyx Call Control API
    const telnyxResponse = await fetch(TELNYX_CALLS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID,
        to: formattedToNumber,
        from: formattedFromNumber,
        webhook_url: webhookUrl,
        webhook_url_method: 'POST',
        record: 'record-from-answer',
        record_format: 'mp3',
        record_channels: 'dual',
        timeout_secs: 30,
      }),
    });

    const telnyxData = await telnyxResponse.json();

    if (!telnyxResponse.ok) {
      const pretty = (() => { try { return JSON.stringify(telnyxData, null, 2) } catch { return String(telnyxData) } })()
      console.error('Telnyx API error:', {
        status: telnyxResponse.status,
        statusText: telnyxResponse.statusText,
        data: telnyxData,
        connectionId: process.env.TELNYX_CONNECTION_ID
      })
      console.error('Telnyx API error details:', pretty)

      const firstError = Array.isArray(telnyxData?.errors) ? telnyxData.errors[0] : undefined
      let errorMessage = firstError?.detail || firstError?.title || 'Failed to initiate call via Telnyx'
      if (telnyxResponse.status === 404) {
        errorMessage = 'Connection not found. Please check TELNYX_CONNECTION_ID and ensure the Connection exists and is Call Control enabled.'
      } else if (telnyxResponse.status === 401) {
        errorMessage = 'Unauthorized. Please check TELNYX_API_KEY.'
      } else if (firstError?.code === 'caller-id-not-owned' || /caller.?id/i.test(firstError?.title || '')) {
        errorMessage = 'The From number is not owned or not allowed on the selected Connection. Assign the number to the Connection or set a valid caller ID.'
      }

      return NextResponse.json(
        { error: errorMessage, telnyx: telnyxData, status: telnyxResponse.status },
        { status: telnyxResponse.status }
      );
    }

    // Save call to database (skip if models not available)
    let savedCall = null;
    if (prisma.telnyxCall) {
      savedCall = await prisma.telnyxCall.create({
        data: {
          telnyxCallId: telnyxData.data.call_control_id,
          contactId: contactId || null,
          fromNumber: formattedFromNumber,
          toNumber: formattedToNumber,
          direction: 'outbound',
          status: 'initiated',
        },
      });

      // Update phone number usage stats
      if (prisma.telnyxPhoneNumber) {
        await prisma.telnyxPhoneNumber.update({
          where: { phoneNumber: formattedFromNumber },
          data: {
            totalCallCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      callId: savedCall?.id || 'temp-id',
      telnyxCallId: telnyxData.data.call_control_id,
      status: 'initiated',
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
