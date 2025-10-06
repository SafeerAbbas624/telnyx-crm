import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Contact {
  tags: string[];
}

interface Tag {
  id: string;
  name: string;
}

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        is_system: true,
        _count: {
          select: { contact_tags: true }
        }
      },
      orderBy: [
        { is_system: 'desc' }, // System tags first
        { name: 'asc' }
      ],
    });

    // Format response to include usage count
    const formattedTags = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      is_system: tag.is_system,
      usage_count: tag._count.contact_tags
    }));

    return NextResponse.json(formattedTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
