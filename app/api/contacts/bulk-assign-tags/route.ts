import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Verify all contacts belong to the user
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (contacts.length !== contactIds.length) {
      return NextResponse.json(
        { error: 'Some contacts not found or unauthorized' },
        { status: 404 }
      );
    }

    // Verify all tags belong to the user
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: tagIds },
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (tags.length !== tagIds.length) {
      return NextResponse.json(
        { error: 'Some tags not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get existing contact-tag relationships
    const existingRelations = await prisma.contactTag.findMany({
      where: {
        contactId: { in: contactIds },
        tagId: { in: tagIds },
      },
      select: {
        contactId: true,
        tagId: true,
      },
    });

    // Create a Set of existing relationships for quick lookup
    const existingSet = new Set(
      existingRelations.map((rel) => `${rel.contactId}-${rel.tagId}`)
    );

    // Prepare new relationships to create (only those that don't exist)
    const newRelations = [];
    for (const contactId of contactIds) {
      for (const tagId of tagIds) {
        const key = `${contactId}-${tagId}`;
        if (!existingSet.has(key)) {
          newRelations.push({
            contactId,
            tagId,
          });
        }
      }
    }

    // Bulk create new contact-tag relationships
    if (newRelations.length > 0) {
      await prisma.contactTag.createMany({
        data: newRelations,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Tags assigned to ${contactIds.length} contacts`,
      newRelationsCreated: newRelations.length,
    });
  } catch (error) {
    console.error('Bulk tag assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign tags' },
      { status: 500 }
    );
  }
}

