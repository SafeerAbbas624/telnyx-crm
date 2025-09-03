import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

export async function GET() {
  try {
    // Get basic contact stats
    const totalContacts = await prisma.contact.count();
    const recentContacts = await prisma.contact.count({
      where: {
        createdAt: {
          gte: subMonths(new Date(), 1),
        },
      },
    });

    // Activity stats
    const totalActivities = await prisma.activity.count();
    const completedActivities = await prisma.activity.count({
      where: { status: 'completed' },
    });
    const pendingActivities = await prisma.activity.count({
      where: { status: 'planned' },
    });

    // Get contacts by property type
    const contactsByPropertyType = await prisma.contact.groupBy({
      by: ['propertyType'],
      _count: {
        id: true,
      },
      where: {
        propertyType: {
          not: null,
        },
      },
    });

    // Get recent activities (increased limit for task management filtering)
    const recentActivities = await prisma.activity.findMany({
      take: 100, // Increased from 10 to 100 to support proper filtering
      orderBy: {
        created_at: 'desc',
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            propertyAddress: true,
            phone1: true,
            email1: true,
          },
        },
      },
    });

    return NextResponse.json({
      // Contact stats
      totalContacts,
      recentContacts,
      totalContactsContacted: 0, // Simplified for now
      totalContactsLeftForContact: totalContacts,

      // Message stats (simplified)
      totalMessages: 0,
      totalMessagesSent: 0,
      totalMessagesReceived: 0,

      // Telnyx specific stats (simplified)
      telnyxMessages: 0,
      telnyxCalls: 0,
      telnyxCost: 0,
      telnyxPhoneNumbers: 0,

      // Call stats
      totalCalls: 0,
      totalOutboundCalls: 0,
      totalInboundCalls: 0,

      // Activity stats
      totalActivities,
      completedActivities,
      pendingActivities,
      overdueActivities: 0, // Simplified for now

      // Deal stats
      totalDeals: 0,
      dealsValue: 0,
      dealsWon: 0,
      dealsLost: 0,

      // Time-based stats (simplified)
      todayStats: {
        messages: 0,
        calls: 0,
        activities: 0,
        contacts: 0,
      },
      weekStats: {
        messages: 0,
        calls: 0,
        activities: 0,
        contacts: 0,
      },
      monthStats: {
        messages: 0,
        calls: 0,
        activities: 0,
        contacts: 0,
      },

      // Additional data
      contactsByPropertyType: contactsByPropertyType.map(item => ({
        type: item.propertyType || 'Unknown',
        count: item._count.id,
      })),
      recentActivities: recentActivities.map(activity => ({
        id: activity.id,
        contactId: activity.contact_id,
        dealId: activity.deal_id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        dueDate: activity.due_date?.toISOString(),
        status: activity.status,
        priority: activity.priority,
        assignedTo: activity.assigned_to,
        location: activity.location,
        durationMinutes: activity.duration_minutes,
        reminderMinutes: activity.reminder_minutes,
        isAllDay: activity.is_all_day,
        completedAt: activity.completed_at?.toISOString(),
        completedBy: activity.completed_by,
        result: activity.result,
        nextAction: activity.next_action,
        createdAt: activity.created_at.toISOString(),
        updatedAt: activity.updated_at.toISOString(),
        contact: activity.contact ? {
          id: activity.contact.id,
          firstName: activity.contact.firstName,
          lastName: activity.contact.lastName,
          propertyAddress: activity.contact.propertyAddress,
          phone1: activity.contact.phone1,
          email1: activity.contact.email1,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
