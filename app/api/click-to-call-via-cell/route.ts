import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatPhoneNumberForTelnyx, isValidE164PhoneNumber } from '@/lib/phone-utils'

const TELNYX_API_KEY = process.env.TELNYX_API_KEY
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID
const TELNYX_CALLS_API_URL = 'https://api.telnyx.com/v2/calls'

/**
 * POST /api/click-to-call-via-cell
 * Initiates a click-to-call flow:
 * 1. Calls the user's cell phone (Leg A)
 * 2. When user answers, webhook handler dials the prospect (Leg B)
 * 3. Both legs are bridged for conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { leadPhone, fromTelnyxNumber, contactId } = body

    if (!leadPhone || !fromTelnyxNumber) {
      return NextResponse.json(
        { error: 'leadPhone and fromTelnyxNumber are required' },
        { status: 400 }
      )
    }

    if (!TELNYX_API_KEY || !TELNYX_CONNECTION_ID) {
      return NextResponse.json(
        { error: 'Telnyx configuration missing' },
        { status: 500 }
      )
    }

    // Get user's cell phone number from their profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cellPhoneNumber: true, firstName: true, lastName: true }
    })

    if (!user?.cellPhoneNumber) {
      return NextResponse.json(
        { error: 'No cell phone number configured in your profile. Please add your cell number in settings.' },
        { status: 400 }
      )
    }

    // Format phone numbers
    const formattedCellNumber = formatPhoneNumberForTelnyx(user.cellPhoneNumber)
    const formattedLeadPhone = formatPhoneNumberForTelnyx(leadPhone)
    const formattedFromNumber = formatPhoneNumberForTelnyx(fromTelnyxNumber)

    if (!formattedCellNumber || !isValidE164PhoneNumber(formattedCellNumber)) {
      return NextResponse.json(
        { error: 'Invalid cell phone number in profile' },
        { status: 400 }
      )
    }

    if (!formattedLeadPhone || !isValidE164PhoneNumber(formattedLeadPhone)) {
      return NextResponse.json(
        { error: 'Invalid lead phone number' },
        { status: 400 }
      )
    }

    console.log('[CLICK-TO-CALL-VIA-CELL][INIT]', {
      userId: session.user.id,
      userCell: formattedCellNumber,
      leadPhone: formattedLeadPhone,
      fromNumber: formattedFromNumber,
      contactId,
      ts: new Date().toISOString()
    })

    // Build webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const baseWebhook = appUrl && appUrl.startsWith('https')
      ? appUrl
      : (process.env.TELNYX_PROD_WEBHOOK_URL || 'https://adlercapitalcrm.com')
    const webhookUrl = `${baseWebhook}/api/telnyx/webhooks/calls`

    // Create Leg A: Telnyx -> User's Cell
    const telnyxResponse = await fetch(TELNYX_CALLS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: TELNYX_CONNECTION_ID,
        to: formattedCellNumber, // User's cell phone
        from: formattedFromNumber, // Telnyx number (caller ID)
        webhook_url: webhookUrl,
        webhook_url_method: 'POST',
        record: 'record-from-answer',
        record_format: 'mp3',
        record_channels: 'dual',
        timeout_secs: 30,
        // Client state to identify this as click-to-call-via-cell Leg A
        client_state: Buffer.from(JSON.stringify({
          type: 'click_to_call_via_cell_leg_a',
          userId: session.user.id,
          leadPhone: formattedLeadPhone,
          fromTelnyxNumber: formattedFromNumber,
          contactId: contactId || null,
          userCellNumber: formattedCellNumber
        })).toString('base64')
      }),
    })

    if (!telnyxResponse.ok) {
      const errorData = await telnyxResponse.json().catch(() => ({}))
      console.error('[CLICK-TO-CALL-VIA-CELL][ERROR] Telnyx API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to initiate call to your cell phone' },
        { status: 500 }
      )
    }

    const telnyxData = await telnyxResponse.json()
    const callControlId = telnyxData.data?.call_control_id

    console.log('[CLICK-TO-CALL-VIA-CELL][LEG-A-CREATED]', {
      callControlId,
      sessionId: telnyxData.data?.call_session_id
    })

    // Store pending call in database for webhook to reference
    await prisma.clickToCallPending.create({
      data: {
        userId: session.user.id,
        callControlId,
        legASessionId: telnyxData.data?.call_session_id,
        leadPhone: formattedLeadPhone,
        fromTelnyxNumber: formattedFromNumber,
        contactId: contactId || null,
        userCellNumber: formattedCellNumber,
        status: 'pending'
      }
    })

    return NextResponse.json({
      success: true,
      callControlId,
      message: 'Calling your cell phone...'
    })

  } catch (error) {
    console.error('[CLICK-TO-CALL-VIA-CELL][ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to initiate click-to-call' },
      { status: 500 }
    )
  }
}

