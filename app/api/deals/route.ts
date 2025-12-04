import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pipeline = searchParams.get('pipeline') || 'default';
    const stage = searchParams.get('stage');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {
      pipeline: pipeline
    };

    if (stage) {
      where.stage = stage;
    }

    // Fetch deals
    const deals = await prisma.deal.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get total count
    const total = await prisma.deal.count({ where });

    // Fetch contact information for all deals
    const contactIds = [...new Set(deals.map(d => d.contact_id))];
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        propertyAddress: true,
        llcName: true
      }
    });

    const contactMap = new Map(contacts.map(c => [c.id, c]));

    // Transform deals to match frontend format
    const transformedDeals = deals.map(deal => {
      const contact = contactMap.get(deal.contact_id);
      return {
        id: deal.id,
        title: deal.name,
        value: Number(deal.value),
        contactId: deal.contact_id,
        contactName: contact ? (contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()) : '',
        propertyAddress: contact?.propertyAddress || '',
        llcName: contact?.llcName || '',
        stage: deal.stage,
        probability: deal.probability || 0,
        expectedCloseDate: deal.expected_close_date?.toISOString().split('T')[0] || '',
        notes: deal.notes || '',
        tasks: [],
        assignedTo: deal.assigned_to || '',
        pipelineId: 'pipeline-1',
        archived: false,
        loanData: deal.custom_fields?.loanData || null,
        createdAt: deal.created_at.toISOString().split('T')[0],
        updatedAt: deal.updated_at?.toISOString().split('T')[0] || ''
      };
    });

    return NextResponse.json({
      success: true,
      deals: transformedDeals,
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      stage,
      value,
      probability,
      contact_id,
      expected_close_date,
      source,
      campaign,
      lead_score,
      pipeline,
      notes,
      custom_fields
    } = body;

    const deal = await prisma.deal.create({
      data: {
        name,
        stage,
        value: parseFloat(value),
        probability: parseInt(probability) || 0,
        contact_id,
        expected_close_date: expected_close_date ? new Date(expected_close_date) : null,
        source,
        campaign,
        lead_score: parseInt(lead_score) || 0,
        pipeline: pipeline || 'default',
        notes,
        custom_fields
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
        notes: deal.notes || '',
        loanData: deal.custom_fields?.loanData || null
      }
    });

  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { error: 'Failed to create deal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

