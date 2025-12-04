import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: params.id }
    });

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deal: {
        id: deal.id,
        title: deal.name,
        value: Number(deal.value),
        contactId: deal.contact_id,
        stage: deal.stage,
        probability: deal.probability || 0,
        expectedCloseDate: deal.expected_close_date?.toISOString().split('T')[0] || '',
        notes: deal.notes || '',
        createdAt: deal.created_at.toISOString(),
        updatedAt: deal.updated_at?.toISOString() || ''
      }
    });
  } catch (error) {
    console.error('Error fetching deal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deal' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      stage,
      value,
      probability,
      contact_id,
      expected_close_date,
      notes
    } = body;

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        name,
        stage,
        value: value !== undefined ? parseFloat(value) : undefined,
        probability: probability !== undefined ? parseInt(probability) : undefined,
        contact_id,
        expected_close_date: expected_close_date ? new Date(expected_close_date) : null,
        notes
      }
    });

    return NextResponse.json({
      success: true,
      deal: {
        id: deal.id,
        title: deal.name,
        value: Number(deal.value),
        contactId: deal.contact_id,
        stage: deal.stage,
        probability: deal.probability || 0,
        expectedCloseDate: deal.expected_close_date?.toISOString().split('T')[0] || '',
        notes: deal.notes || ''
      }
    });
  } catch (error) {
    console.error('Error updating deal:', error);
    return NextResponse.json(
      { error: 'Failed to update deal' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.deal.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Deal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deal:', error);
    return NextResponse.json(
      { error: 'Failed to delete deal' },
      { status: 500 }
    );
  }
}

