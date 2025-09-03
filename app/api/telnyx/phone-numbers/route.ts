import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('📞 Fetching Telnyx phone numbers...')

    // Temporary workaround: Check if the telnyxPhoneNumber model exists
    if (!prisma.telnyxPhoneNumber) {
      console.warn('TelnyxPhoneNumber model not available in Prisma client. Returning empty array.');
      return NextResponse.json([]);
    }

    const phoneNumbers = await prisma.telnyxPhoneNumber.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('📞 Found phone numbers:', phoneNumbers.length)
    console.log('📞 Phone numbers data:', phoneNumbers)

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
    const { phoneNumber, state, city, telnyxId, capabilities, monthlyPrice, setupPrice } = body;

    // Validate required fields
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Temporary workaround: Check if the telnyxPhoneNumber model exists
    if (!prisma.telnyxPhoneNumber) {
      console.warn('TelnyxPhoneNumber model not available in Prisma client. Cannot create phone number.');
      return NextResponse.json(
        { error: 'Phone number management not available. Please regenerate Prisma client.' },
        { status: 503 }
      );
    }

    // Check if phone number already exists
    const existingNumber = await prisma.telnyxPhoneNumber.findUnique({
      where: { phoneNumber },
    });

    if (existingNumber) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 409 }
      );
    }

    const newPhoneNumber = await prisma.telnyxPhoneNumber.create({
      data: {
        phoneNumber,
        state: state || null,
        city: city || null,
        telnyxId: telnyxId || null,
        capabilities: capabilities || ['SMS', 'VOICE'],
        monthlyPrice: monthlyPrice ? parseFloat(monthlyPrice) : null,
        setupPrice: setupPrice ? parseFloat(setupPrice) : null,
      },
    });

    return NextResponse.json(newPhoneNumber, { status: 201 });
  } catch (error) {
    console.error('Error creating Telnyx phone number:', error);
    return NextResponse.json(
      { error: 'Failed to create phone number' },
      { status: 500 }
    );
  }
}
