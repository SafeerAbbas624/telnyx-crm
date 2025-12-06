import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const lenders = await prisma.lender.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      lenders: lenders.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        isActive: l.isActive,
      }))
    });

  } catch (error) {
    console.error('Error fetching lenders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lenders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Lender name is required' },
        { status: 400 }
      );
    }

    const lender = await prisma.lender.create({
      data: {
        name,
        type: type || null,
      }
    });

    return NextResponse.json({
      success: true,
      lender: {
        id: lender.id,
        name: lender.name,
        type: lender.type,
        isActive: lender.isActive,
      }
    });

  } catch (error) {
    console.error('Error creating lender:', error);
    return NextResponse.json(
      { error: 'Failed to create lender', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

