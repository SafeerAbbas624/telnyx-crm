import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { elasticsearchClient } from '@/lib/search/elasticsearch-client';
import { redisClient } from '@/lib/cache/redis-client';

export async function POST(request: NextRequest) {
  try {
    console.log('[BULK DELETE] Starting bulk delete request');
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.log('[BULK DELETE] Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[BULK DELETE] User authenticated:', session.user.email);

    const { contactIds } = await request.json();
    console.log('[BULK DELETE] Contact IDs to delete:', contactIds);

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      console.log('[BULK DELETE] Invalid contactIds array');
      return NextResponse.json(
        { error: 'Invalid contactIds array' },
        { status: 400 }
      );
    }

    // Safety limit - prevent accidental mass deletion
    if (contactIds.length > 10000) {
      console.log('[BULK DELETE] Too many contacts:', contactIds.length);
      return NextResponse.json(
        { error: 'Cannot delete more than 10,000 contacts at once' },
        { status: 400 }
      );
    }

    console.log('[BULK DELETE] Deleting', contactIds.length, 'contacts');

    // Delete related records first to avoid foreign key constraints
    // Note: Prisma's deleteMany doesn't trigger cascade deletes, so we must delete all relations manually

    console.log('[BULK DELETE] Deleting contact tags...');
    await prisma.contactTag.deleteMany({
      where: { contact_id: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting contact properties...');
    await prisma.contactProperty.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting contact assignments...');
    await prisma.contactAssignment.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting messages...');
    await prisma.message.deleteMany({
      where: { contact_id: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting Telnyx messages...');
    await prisma.telnyxMessage.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting conversations...');
    await prisma.conversation.deleteMany({
      where: { contact_id: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting email messages...');
    await prisma.emailMessage.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting email conversations...');
    await prisma.emailConversation.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting power dialer queue entries...');
    await prisma.powerDialerQueue.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting power dialer calls...');
    await prisma.powerDialerCall.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting power dialer list contacts...');
    await prisma.powerDialerListContact.deleteMany({
      where: { contactId: { in: contactIds } }
    });

    console.log('[BULK DELETE] Deleting activities...');
    await prisma.activity.deleteMany({
      where: { contact_id: { in: contactIds } }
    });

    // Delete the contacts
    console.log('[BULK DELETE] Deleting contacts from database...');
    const result = await prisma.contact.deleteMany({
      where: { id: { in: contactIds } }
    });
    console.log('[BULK DELETE] Deleted', result.count, 'contacts from database');

    // Remove from Elasticsearch (non-blocking)
    try {
      console.log('[BULK DELETE] Removing from Elasticsearch...');
      for (const contactId of contactIds) {
        await elasticsearchClient.deleteContact(contactId);
      }
      console.log('[BULK DELETE] Removed from Elasticsearch');
    } catch (esError) {
      console.error('[BULK DELETE] Elasticsearch delete error:', esError);
    }

    // Invalidate cache
    try {
      console.log('[BULK DELETE] Invalidating cache...');
      await redisClient.invalidateSearchCache();
      console.log('[BULK DELETE] Cache invalidated');
    } catch (redisError) {
      console.error('[BULK DELETE] Redis cache invalidation error:', redisError);
    }

    console.log('[BULK DELETE] Bulk delete completed successfully');
    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Successfully deleted ${result.count} contacts`
    });
  } catch (error) {
    console.error('[BULK DELETE] Error in bulk delete contacts:', error);
    return NextResponse.json(
      { error: 'Failed to delete contacts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

