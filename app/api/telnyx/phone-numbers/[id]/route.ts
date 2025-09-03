import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check if phone number exists
    const phoneNumber = await prisma.telnyxPhoneNumber.findUnique({
      where: { id },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    await prisma.telnyxPhoneNumber.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Phone number deleted successfully' });
  } catch (error) {
    console.error('Error deleting Telnyx phone number:', error);
    return NextResponse.json(
      { error: 'Failed to delete phone number' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updatedPhoneNumber = await prisma.telnyxPhoneNumber.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedPhoneNumber);
  } catch (error) {
    console.error('Error updating Telnyx phone number:', error);
    return NextResponse.json(
      { error: 'Failed to update phone number' },
      { status: 500 }
    );
  }
}
