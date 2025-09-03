import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const count = await prisma.contact.count();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching contacts count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts count' },
      { status: 500 }
    );
  }
}
