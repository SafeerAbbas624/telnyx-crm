import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactIds, tagIds, removeAll } = await request.json();

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'Contact IDs are required' }, { status: 400 });
    }

    // If removeAll is true, remove ALL tags from the selected contacts
    if (removeAll === true) {
      const deleteResult = await prisma.contactTag.deleteMany({
        where: {
          contact_id: { in: contactIds },
        },
      });

      return NextResponse.json({
        success: true,
        message: `All tags removed from ${contactIds.length} contacts`,
        relationsDeleted: deleteResult.count,
      });
    }

    // Otherwise, require tagIds for selective removal
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json({ error: 'Tag IDs are required (or set removeAll: true)' }, { status: 400 });
    }

    // Verify all contacts exist (exclude soft-deleted contacts)
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (contacts.length !== contactIds.length) {
      console.log(`Contact verification failed: expected ${contactIds.length}, found ${contacts.length}`);
      console.log('Contact IDs requested:', contactIds);
      console.log('Contacts found:', contacts.map(c => c.id));
      return NextResponse.json(
        { error: `Some contacts not found (expected ${contactIds.length}, found ${contacts.length})` },
        { status: 404 }
      );
    }

    // Verify all tags exist
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: tagIds },
      },
      select: { id: true },
    });

    if (tags.length !== tagIds.length) {
      return NextResponse.json(
        { error: 'Some tags not found' },
        { status: 404 }
      );
    }

    // Delete contact-tag relationships using correct field names
    const deleteResult = await prisma.contactTag.deleteMany({
      where: {
        contact_id: { in: contactIds },
        tag_id: { in: tagIds },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Tags removed from ${contactIds.length} contacts`,
      relationsDeleted: deleteResult.count,
    });
  } catch (error: any) {
    console.error('Bulk tag removal error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    return NextResponse.json(
      { error: 'Failed to remove tags', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

