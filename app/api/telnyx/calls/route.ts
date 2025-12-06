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

    // Fetch contact names for calls that have contactId
    const contactIds = calls
      .filter(call => call.contactId)
      .map(call => call.contactId as string);

    const contacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true, phone1: true }
        })
      : [];

    const contactMap = new Map(contacts.map(c => [c.id, c]));

    // Collect phone numbers from calls without contactId for lookup
    const phoneNumbersToLookup = new Set<string>();
    calls.forEach(call => {
      if (!call.contactId) {
        // Extract last 10 digits for matching
        const fromDigits = (call.fromNumber || '').replace(/\D/g, '').slice(-10);
        const toDigits = (call.toNumber || '').replace(/\D/g, '').slice(-10);
        if (fromDigits) phoneNumbersToLookup.add(fromDigits);
        if (toDigits) phoneNumbersToLookup.add(toDigits);
      }
    });

    // Lookup contacts by phone number for calls without contactId
    let phoneContactMap = new Map<string, { firstName: string | null; lastName: string | null }>();
    if (phoneNumbersToLookup.size > 0) {
      const phonePatterns = Array.from(phoneNumbersToLookup).map(digits => `%${digits}`);
      const contactsByPhone = await prisma.contact.findMany({
        where: {
          OR: [
            { phone1: { in: phonePatterns.map(p => p.replace('%', '')) } },
            ...phonePatterns.map(pattern => ({ phone1: { endsWith: pattern.replace('%', '') } }))
          ]
        },
        select: { firstName: true, lastName: true, phone1: true }
      });

      // Build map of last 10 digits -> contact
      contactsByPhone.forEach(c => {
        if (c.phone1) {
          const digits = c.phone1.replace(/\D/g, '').slice(-10);
          if (digits) {
            phoneContactMap.set(digits, { firstName: c.firstName, lastName: c.lastName });
          }
        }
      });
    }

    // Transform to include contactName
    const transformedCalls = calls.map(call => {
      // First try by contactId
      let contact = call.contactId ? contactMap.get(call.contactId) : null;

      // If no contact found by ID, try by phone number
      if (!contact) {
        const fromDigits = (call.fromNumber || '').replace(/\D/g, '').slice(-10);
        const toDigits = (call.toNumber || '').replace(/\D/g, '').slice(-10);

        // For outbound calls, match toNumber; for inbound, match fromNumber
        if (call.direction === 'outbound' && toDigits) {
          contact = phoneContactMap.get(toDigits) || null;
        } else if (call.direction === 'inbound' && fromDigits) {
          contact = phoneContactMap.get(fromDigits) || null;
        }

        // Fallback: try both numbers
        if (!contact) {
          contact = phoneContactMap.get(toDigits) || phoneContactMap.get(fromDigits) || null;
        }
      }

      return {
        ...call,
        contactName: contact
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null
          : null,
      };
    });

    return NextResponse.json(transformedCalls);
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

    console.log('[TELNYX CALLS][INIT] Outbound call request', {
      userId: session?.user?.id,
      role: session?.user?.role,
      fromNumber,
      toNumber,
      contactId,
      ts: new Date().toISOString(),
    })

    // Check if user has permission to use this phone number
    if (session?.user?.role !== 'ADMIN') {
      // Non-admin users must have explicit permission for the phone number
      const formattedFromCandidate = formatPhoneNumberForTelnyx(fromNumber)
      const allowedNumber = await prisma.userAllowedPhoneNumber.findFirst({
        where: {
          userId: session?.user?.id,
          phoneNumber: {
            OR: [
              { phoneNumber: fromNumber },
              { phoneNumber: formattedFromCandidate || '' }
            ]
          }
        }
      });

      if (!allowedNumber) {
        console.warn('[TELNYX CALLS][GUARD] User attempted call from non-allowed number', {
          userId: session?.user?.id,
          fromNumber,
          formattedFromCandidate,
        })
        return NextResponse.json(
          { error: 'You do not have permission to call from this phone number' },
          { status: 403 }
        )
      }
      console.log('[TELNYX CALLS][GUARD] User from-number validated', { userId: session?.user?.id, fromNumber })
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

    console.log('[TELNYX CALLS][CONFIG] Using webhook URL', { appUrl, webhookUrl })

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

    console.log('[TELNYX CALLS][RESPONSE] Telnyx dial response', {
      status: telnyxResponse.status,
      telnyxRequestId: telnyxResponse.headers.get('x-telnyx-request-id') || undefined,
      callControlId: telnyxData?.data?.call_control_id,
    })

    // Note on audio path
    console.warn('[TELNYX CALLS][AUDIO] No agent/browser media leg is configured by this endpoint. To talk, you must bridge to an agent phone or use WebRTC.')

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
      try {
        savedCall = await prisma.telnyxCall.create({
          data: {
            telnyxCallId: telnyxData.data.call_control_id,
            contactId: contactId || null,
            initiatedBy: session?.user?.id || null,
            fromNumber: formattedFromNumber,
            toNumber: formattedToNumber,
            direction: 'outbound',
            status: 'initiated',
          },
        });
        console.log('[TELNYX CALLS][DB] ✅ Saved telnyxCall', {
          id: savedCall?.id,
          telnyxCallId: savedCall?.telnyxCallId,
          contactId: savedCall?.contactId,
          fromNumber: savedCall?.fromNumber,
          toNumber: savedCall?.toNumber
        })

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
      } catch (dbError) {
        console.error('[TELNYX CALLS][DB] ❌ Failed to save telnyxCall:', dbError);
        // Continue anyway - the call was initiated successfully via Telnyx
        // The webhook handler will create the record if needed
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
