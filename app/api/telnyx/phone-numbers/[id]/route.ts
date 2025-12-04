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
    const { friendlyName, state, city, isActive } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (friendlyName !== undefined) {
      updates.push(`friendly_name = $${paramIndex++}`);
      values.push(friendlyName);
    }
    if (state !== undefined) {
      updates.push(`state = $${paramIndex++}`);
      values.push(state);
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(city);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE telnyx_phone_numbers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING *
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);
    const updatedPhoneNumber = Array.isArray(result) ? result[0] : result;

    return NextResponse.json(updatedPhoneNumber);
  } catch (error) {
    console.error('Error updating Telnyx phone number:', error);
    return NextResponse.json(
      { error: 'Failed to update phone number' },
      { status: 500 }
    );
  }
}
