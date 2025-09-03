import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get activities with contacts
    const activities = await prisma.activity.findMany({
      take: 20,
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        due_date: true,
        status: true,
        contact_id: true,
        created_at: true,
      },
    });

    // Get contacts
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email1: true,
        phone1: true,
      },
    });

    return NextResponse.json({
      success: true,
      activities: activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        dueDate: activity.due_date?.toISOString(),
        status: activity.status,
        contactId: activity.contact_id,
        createdAt: activity.created_at.toISOString(),
      })),
      contacts: contacts.map(contact => ({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email1,
        phone: contact.phone1,
      })),
      counts: {
        activities: activities.length,
        contacts: contacts.length,
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}