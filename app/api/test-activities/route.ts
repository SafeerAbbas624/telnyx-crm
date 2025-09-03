import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get activity count
    const activityCount = await prisma.activity.count();
    
    // Get sample activities
    const sampleActivities = await prisma.activity.findMany({
      take: 5,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      activityCount,
      sampleActivities: sampleActivities.map(activity => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        status: activity.status,
        dueDate: activity.due_date,
        contactId: activity.contact_id,
        contact: activity.contact
      }))
    });

  } catch (error) {
    console.error('Error testing activities:', error);
    return NextResponse.json(
      { error: 'Failed to test activities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}