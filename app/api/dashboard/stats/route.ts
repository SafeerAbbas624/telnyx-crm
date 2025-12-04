import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const parseDate = (k: string) => {
      const v = url.searchParams.get(k)
      return v ? new Date(v) : undefined
    }

    const now = parseDate('now') ?? new Date()
    const todayStart = parseDate('todayStart') ?? startOfDay(now)
    const todayEnd = parseDate('todayEnd') ?? endOfDay(now)
    const weekStart = parseDate('weekStart') ?? startOfWeek(now)
    const weekEnd = parseDate('weekEnd') ?? endOfWeek(now)
    const monthStart = parseDate('monthStart') ?? startOfMonth(now)
    const monthEnd = parseDate('monthEnd') ?? endOfMonth(now)
    const recentGte = parseDate('recentGte') ?? subMonths(now, 1)

    // Parallelize all counts for performance
    const [
      totalContacts,
      recentContacts,
      totalActivities,
      completedActivities,
      pendingActivities,
      overdueActivities,
      contactsByPropertyType,
      // Telnyx messages
      totalTelnyxMessages,
      sentTelnyxMessages,
      receivedTelnyxMessages,
      todayTelnyxMessages,
      weekTelnyxMessages,
      monthTelnyxMessages,
      // Telnyx calls
      totalTelnyxCalls,
      outboundTelnyxCalls,
      inboundTelnyxCalls,
      todayTelnyxCalls,
      weekTelnyxCalls,
      monthTelnyxCalls,
      // Phone numbers & billing
      activePhoneNumbers,
      billingSum,
      // Recent activities w/ contact
      recentActivities,
      // Distinct contacted contacts
      msgContactIds,
      callContactIds,
      // Contacts created time windows
      todayNewContacts,
      weekNewContacts,
      monthNewContacts,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { createdAt: { gte: recentGte } } }),
      prisma.activity.count(),
      prisma.activity.count({ where: { status: 'completed' } }),
      prisma.activity.count({ where: { status: 'planned' } }),
      prisma.activity.count({ where: { due_date: { lt: now }, status: { not: 'completed' } } }),
      prisma.contact.groupBy({
        by: ['propertyType'],
        _count: { id: true },
        where: { propertyType: { not: null } },
      }),

      // Telnyx messages
      prisma.telnyxMessage.count(),
      prisma.telnyxMessage.count({ where: { direction: 'outbound' } }),
      prisma.telnyxMessage.count({ where: { direction: 'inbound' } }),
      prisma.telnyxMessage.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.telnyxMessage.count({ where: { createdAt: { gte: weekStart, lte: weekEnd } } }),
      prisma.telnyxMessage.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),

      // Telnyx calls
      prisma.telnyxCall.count(),
      prisma.telnyxCall.count({ where: { direction: 'outbound' } }),
      prisma.telnyxCall.count({ where: { direction: 'inbound' } }),
      prisma.telnyxCall.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.telnyxCall.count({ where: { createdAt: { gte: weekStart, lte: weekEnd } } }),
      prisma.telnyxCall.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),

      // Phone numbers & billing
      prisma.telnyxPhoneNumber.count({ where: { isActive: true } }),
      prisma.telnyxBilling.aggregate({ _sum: { cost: true } }),

      // Recent activities with basic contact (for task list and popups)
      prisma.activity.findMany({
        take: 100,
        orderBy: { created_at: 'desc' },
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
      }),

      // Distinct contacts who have been contacted via SMS or calls
      prisma.telnyxMessage.findMany({ where: { contactId: { not: null } }, distinct: ['contactId'], select: { contactId: true } }),
      prisma.telnyxCall.findMany({ distinct: ['contactId'], select: { contactId: true } }),

      // New contacts time windows
      prisma.contact.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.contact.count({ where: { createdAt: { gte: weekStart, lte: weekEnd } } }),
      prisma.contact.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    ])

    // Build contacts array for dashboard (unique contacts referenced in recent activities)
    const contactsMap = new Map<string, any>()
    for (const act of recentActivities) {
      if (act.contact) {
        contactsMap.set(act.contact.id, act.contact)
      }
    }
    const contacts = Array.from(contactsMap.values())

    // Merge distinct contacted contact IDs from SMS and Calls
    const contactedIds = new Set<string>()
    for (const r of msgContactIds) if (r.contactId) contactedIds.add(r.contactId)
    for (const r of callContactIds) if (r.contactId) contactedIds.add(r.contactId)
    const totalContactsContacted = contactedIds.size

    const telnyxCost = Number((billingSum?._sum?.cost as unknown as any) || 0)

    return NextResponse.json({
      // Contact stats
      totalContacts,
      recentContacts,
      totalContactsContacted,
      totalContactsLeftForContact: Math.max(0, totalContacts - totalContactsContacted),

      // Message stats
      totalMessages: totalTelnyxMessages,
      totalMessagesSent: sentTelnyxMessages,
      totalMessagesReceived: receivedTelnyxMessages,

      // Telnyx specific stats
      telnyxMessages: totalTelnyxMessages,
      telnyxCalls: totalTelnyxCalls,
      telnyxCost,
      telnyxPhoneNumbers: activePhoneNumbers,

      // Call stats (duplicated for clarity in UI)
      totalCalls: totalTelnyxCalls,
      totalOutboundCalls: outboundTelnyxCalls,
      totalInboundCalls: inboundTelnyxCalls,

      // Activity stats
      totalActivities,
      completedActivities,
      pendingActivities,
      overdueActivities,

      // Time-based stats
      todayStats: {
        messages: todayTelnyxMessages,
        calls: todayTelnyxCalls,
        activities: await prisma.activity.count({ where: { created_at: { gte: todayStart, lte: todayEnd } } }),
        contacts: todayNewContacts,
      },
      weekStats: {
        messages: weekTelnyxMessages,
        calls: weekTelnyxCalls,
        activities: await prisma.activity.count({ where: { created_at: { gte: weekStart, lte: weekEnd } } }),
        contacts: weekNewContacts,
      },
      monthStats: {
        messages: monthTelnyxMessages,
        calls: monthTelnyxCalls,
        activities: await prisma.activity.count({ where: { created_at: { gte: monthStart, lte: monthEnd } } }),
        contacts: monthNewContacts,
      },

      // Additional data
      contactsByPropertyType: contactsByPropertyType.map((item) => ({
        type: item.propertyType || 'Unknown',
        count: item._count.id,
      })),
      recentActivities: recentActivities.map((activity) => ({
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
      contacts,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
