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

    const { contactIds, tagIds } = await request.json();

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'Contact IDs are required' }, { status: 400 });
    }

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json({ error: 'Tag IDs are required' }, { status: 400 });
    }

    // Verify all contacts exist
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
      },
      select: { id: true },
    });

    if (contacts.length !== contactIds.length) {
      return NextResponse.json(
        { error: 'Some contacts not found' },
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

    // Create contact-tag relationships using correct field names
    const associations = [];
    for (const contactId of contactIds) {
      for (const tagId of tagIds) {
        associations.push({
          contact_id: contactId,
          tag_id: tagId,
          created_by: session.user.id,
        });
      }
    }

    // Bulk create contact-tag relationships
    await prisma.contactTag.createMany({
      data: associations,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      message: `Tags assigned to ${contactIds.length} contacts`,
      affectedContacts: contactIds.length,
      processedTags: tagIds.length,
    });
  } catch (error) {
    console.error('Bulk tag assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign tags' },
      { status: 500 }
    );
  }
}

