import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('📞 Fetching Telnyx phone numbers...')

    // Use raw SQL to include friendlyName field
    const phoneNumbers = await prisma.$queryRaw`
      SELECT
        id,
        phone_number as "phoneNumber",
        friendly_name as "friendlyName",
        telnyx_id as "telnyxId",
        state,
        city,
        country,
        is_active as "isActive",
        capabilities,
        monthly_price as "monthlyPrice",
        setup_price as "setupPrice",
        purchased_at as "purchasedAt",
        last_used_at as "lastUsedAt",
        total_sms_count as "totalSmsCount",
        total_call_count as "totalCallCount",
        total_cost as "totalCost",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM telnyx_phone_numbers
      ORDER BY created_at DESC
    `;

    console.log('📞 Found phone numbers:', (phoneNumbers as any[]).length)

    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error fetching Telnyx phone numbers:', error);
    // Return empty array instead of error to prevent UI crashes
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, friendlyName, state, city, telnyxId, capabilities, monthlyPrice, setupPrice } = body;

    // Validate required fields
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Check if phone number already exists using raw SQL
    const existing = await prisma.$queryRaw`
      SELECT id FROM telnyx_phone_numbers WHERE phone_number = ${phoneNumber}
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 409 }
      );
    }

    // Create using raw SQL to include friendlyName
    const caps = capabilities || ['SMS', 'VOICE'];
    const result = await prisma.$queryRaw`
      INSERT INTO telnyx_phone_numbers (
        id, phone_number, friendly_name, telnyx_id, state, city, capabilities,
        monthly_price, setup_price, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${phoneNumber},
        ${friendlyName || null},
        ${telnyxId || null},
        ${state || null},
        ${city || null},
        ${caps}::text[],
        ${monthlyPrice ? parseFloat(monthlyPrice) : null},
        ${setupPrice ? parseFloat(setupPrice) : null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        phone_number as "phoneNumber",
        friendly_name as "friendlyName",
        telnyx_id as "telnyxId",
        state,
        city,
        capabilities,
        is_active as "isActive",
        created_at as "createdAt"
    `;

    const newPhoneNumber = Array.isArray(result) ? result[0] : result;
    return NextResponse.json(newPhoneNumber, { status: 201 });
  } catch (error) {
    console.error('Error creating Telnyx phone number:', error);
    return NextResponse.json(
      { error: 'Failed to create phone number' },
      { status: 500 }
    );
  }
}
