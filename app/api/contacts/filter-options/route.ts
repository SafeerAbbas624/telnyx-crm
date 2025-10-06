import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable Next.js caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    console.log('🔄 [FILTER OPTIONS API] Fetching filter options from database...')

    // Get unique values for each filter field from the database
    const [
      cities,
      states,
      counties,
      propertyTypes,
      dealStatuses,
      tags,
      valueStats,
      equityStats
    ] = await Promise.all([
      // Cities
      prisma.contact.findMany({
        select: { city: true },
        where: { city: { not: null } },
        distinct: ['city'],
        orderBy: { city: 'asc' }
      }),

      // States
      prisma.contact.findMany({
        select: { state: true },
        where: { state: { not: null } },
        distinct: ['state'],
        orderBy: { state: 'asc' }
      }),

      // Counties
      prisma.contact.findMany({
        select: { propertyCounty: true },
        where: { propertyCounty: { not: null } },
        distinct: ['propertyCounty'],
        orderBy: { propertyCounty: 'asc' }
      }),

      // Property Types
      prisma.contact.findMany({
        select: { propertyType: true },
        where: { propertyType: { not: null } },
        distinct: ['propertyType'],
        orderBy: { propertyType: 'asc' }
      }),

      // Deal Statuses
      prisma.contact.findMany({
        select: { dealStatus: true },
        where: { dealStatus: { not: null } },
        distinct: ['dealStatus'],
        orderBy: { dealStatus: 'asc' }
      }),

      // Tags - ONLY tags that are actually attached to contacts
      // Using raw SQL to bypass any Prisma caching issues
      prisma.$queryRaw`
        SELECT t.id, t.name, t.color
        FROM tags t
        WHERE EXISTS (
          SELECT 1 FROM contact_tags ct WHERE ct.tag_id = t.id
        )
        ORDER BY t.name ASC
      `,

      // Property Value Stats
      prisma.contact.aggregate({
        _min: { estValue: true },
        _max: { estValue: true },
        where: { estValue: { not: null } }
      }),

      // Equity Stats
      prisma.contact.aggregate({
        _min: { estEquity: true },
        _max: { estEquity: true },
        where: { estEquity: { not: null } }
      })
    ]);

    console.log('✅ [FILTER OPTIONS API] Query results:', {
      cities: cities.length,
      states: states.length,
      counties: counties.length,
      propertyTypes: propertyTypes.length,
      dealStatuses: dealStatuses.length,
      tags: tags.length
    })

    // Format the response
    const filterOptions = {
      cities: cities.map(c => c.city).filter(Boolean),
      states: states.map(s => s.state).filter(Boolean),
      counties: counties.map(c => c.propertyCounty).filter(Boolean),
      propertyTypes: propertyTypes.map(p => p.propertyType).filter(Boolean),
      dealStatuses: dealStatuses.map(d => d.dealStatus).filter(Boolean),
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || '#3B82F6'
      })),
      valueRange: {
        min: valueStats._min.estValue ? Number(valueStats._min.estValue) : 0,
        max: valueStats._max.estValue ? Number(valueStats._max.estValue) : 2000000
      },
      equityRange: {
        min: equityStats._min.estEquity ? Number(equityStats._min.estEquity) : 0,
        max: equityStats._max.estEquity ? Number(equityStats._max.estEquity) : 1000000
      }
    };

    console.log('📤 [FILTER OPTIONS API] Sending response with', filterOptions.tags.length, 'tags')

    return NextResponse.json(filterOptions);
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
