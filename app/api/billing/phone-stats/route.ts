import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Calculate date filter
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Get all phone numbers with their base info
    const phoneNumbers = await prisma.telnyxPhoneNumber.findMany({
      where: { isActive: true },
      select: {
        phoneNumber: true,
        friendlyName: true,
        monthlyPrice: true,
        totalCost: true,
        totalSmsCount: true,
        totalCallCount: true,
      },
    });

    // Get billing records for the date range
    const billingRecords = await prisma.telnyxBilling.findMany({
      where: {
        billingDate: {
          gte: daysAgo,
        },
      },
      select: {
        phoneNumber: true,
        recordType: true,
        cost: true,
      },
    });

    // Calculate stats per phone number
    const statsMap = new Map<string, any>();

    // Initialize with phone number data
    phoneNumbers.forEach((phone) => {
      statsMap.set(phone.phoneNumber, {
        phoneNumber: phone.phoneNumber,
        friendlyName: phone.friendlyName || null,
        monthlyPrice: Number(phone.monthlyPrice || 0),
        totalCost: 0,
        smsCount: 0,
        callCount: 0,
        smsCost: 0,
        callCost: 0,
        totalSmsCount: phone.totalSmsCount || 0,
        totalCallCount: phone.totalCallCount || 0,
      });
    });

    // Aggregate billing records
    billingRecords.forEach((record) => {
      const stats = statsMap.get(record.phoneNumber);
      if (stats) {
        const cost = Number(record.cost);
        stats.totalCost += cost;

        if (record.recordType === 'sms') {
          stats.smsCount += 1;
          stats.smsCost += cost;
        } else if (record.recordType === 'call') {
          stats.callCount += 1;
          stats.callCost += cost;
        }
      }
    });

    // Convert to array and sort by total cost (descending)
    const stats = Array.from(statsMap.values()).sort((a, b) => b.totalCost - a.totalCost);

    // Calculate totals
    const totals = {
      totalCost: stats.reduce((sum, s) => sum + s.totalCost, 0),
      totalSmsCount: stats.reduce((sum, s) => sum + s.smsCount, 0),
      totalCallCount: stats.reduce((sum, s) => sum + s.callCount, 0),
      totalSmsCost: stats.reduce((sum, s) => sum + s.smsCost, 0),
      totalCallCost: stats.reduce((sum, s) => sum + s.callCost, 0),
      totalMonthlyPrice: stats.reduce((sum, s) => sum + s.monthlyPrice, 0),
    };

    return NextResponse.json({
      success: true,
      stats,
      totals,
      dateRange: {
        from: daysAgo.toISOString(),
        to: new Date().toISOString(),
        days,
      },
    });
  } catch (error) {
    console.error('Error fetching phone number stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phone number stats' },
      { status: 500 }
    );
  }
}

