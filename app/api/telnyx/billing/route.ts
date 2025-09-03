import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Temporary workaround: Check if the telnyxBilling model exists
    if (!prisma.telnyxBilling) {
      console.warn('TelnyxBilling model not available in Prisma client. Returning empty data.');
      return NextResponse.json({
        billingRecords: [],
        pagination: {
          page: 1,
          limit: 50,
          totalCount: 0,
          totalPages: 0,
        },
        summary: {
          totalCost: 0,
          breakdown: [],
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const recordType = searchParams.get('recordType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (phoneNumber) {
      where.phoneNumber = phoneNumber;
    }

    if (recordType) {
      where.recordType = recordType;
    }

    if (startDate || endDate) {
      where.billingDate = {};
      if (startDate) {
        where.billingDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.billingDate.lte = new Date(endDate);
      }
    }

    const [billingRecords, totalCount] = await Promise.all([
      prisma.telnyxBilling.findMany({
        where,
        orderBy: {
          billingDate: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.telnyxBilling.count({ where }),
    ]);

    // Get summary statistics
    const summary = await prisma.telnyxBilling.groupBy({
      by: ['recordType'],
      where,
      _sum: {
        cost: true,
      },
      _count: {
        id: true,
      },
    });

    const totalCost = await prisma.telnyxBilling.aggregate({
      where,
      _sum: {
        cost: true,
      },
    });

    return NextResponse.json({
      billingRecords,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalCost: totalCost._sum.cost || 0,
        breakdown: summary.map(item => ({
          type: item.recordType,
          cost: item._sum.cost || 0,
          count: item._count.id,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching billing data:', error);
    // Return empty data instead of error to prevent UI crashes
    return NextResponse.json({
      billingRecords: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
      },
      summary: {
        totalCost: 0,
        breakdown: [],
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filters } = body;

    if (action === 'export') {
      // Generate CSV export
      const where: any = {};

      if (filters.phoneNumber) {
        where.phoneNumber = filters.phoneNumber;
      }

      if (filters.recordType) {
        where.recordType = filters.recordType;
      }

      if (filters.startDate || filters.endDate) {
        where.billingDate = {};
        if (filters.startDate) {
          where.billingDate.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.billingDate.lte = new Date(filters.endDate);
        }
      }

      const billingRecords = await prisma.telnyxBilling.findMany({
        where,
        orderBy: {
          billingDate: 'desc',
        },
      });

      // Convert to CSV format
      const csvHeaders = [
        'Date',
        'Phone Number',
        'Type',
        'Record ID',
        'Cost',
        'Currency',
        'Description',
      ];

      const csvRows = billingRecords.map(record => [
        record.billingDate.toISOString().split('T')[0],
        record.phoneNumber,
        record.recordType,
        record.recordId,
        record.cost.toString(),
        record.currency,
        record.description || '',
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="telnyx-billing-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing billing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
