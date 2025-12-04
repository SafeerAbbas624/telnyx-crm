import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { elasticsearchClient } from '@/lib/search/elasticsearch-client';
import { redisClient } from '@/lib/cache/redis-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all contacts with "nan" in firstName or lastName
    const contactsWithNan = await prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: 'nan', mode: 'insensitive' } },
          { lastName: { contains: 'nan', mode: 'insensitive' } }
        ]
      },
      select: { id: true }
    });

    const contactIds = contactsWithNan.map(c => c.id);

    if (contactIds.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No contacts with "nan" found'
      });
    }

    // Delete related records first
    await prisma.contactTag.deleteMany({
      where: { contact_id: { in: contactIds } }
    });

    await prisma.contactProperty.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    await prisma.contactAssignment.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    await prisma.activity.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    await prisma.powerDialerListContact.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    // Delete the contacts
    const result = await prisma.contact.deleteMany({
      where: { id: { in: contactIds } }
    });

    // Remove from Elasticsearch
    try {
      for (const contactId of contactIds) {
        await elasticsearchClient.deleteContact(contactId);
      }
    } catch (esError) {
      console.error('Elasticsearch delete error:', esError);
    }

    // Invalidate cache
    try {
      await redisClient.invalidateSearchCache();
    } catch (redisError) {
      console.error('Redis cache invalidation error:', redisError);
    }

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Successfully deleted ${result.count} contacts with "nan" in their names`
    });
  } catch (error) {
    console.error('Error deleting nan contacts:', error);
    return NextResponse.json(
      { error: 'Failed to delete contacts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

