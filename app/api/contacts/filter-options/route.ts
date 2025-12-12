import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizePropertyType } from '@/lib/property-type-mapper';

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
      equityStats,
      sqftStats,
      bedsStats,
      bathsStats,
      propertiesStats
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
      }),

      // Square Feet Stats
      prisma.contact.aggregate({
        _min: { buildingSqft: true },
        _max: { buildingSqft: true },
        where: { buildingSqft: { not: null } }
      }),

      // Bedrooms Stats
      prisma.contact.aggregate({
        _min: { bedrooms: true },
        _max: { bedrooms: true },
        where: { bedrooms: { not: null } }
      }),

      // Bathrooms Stats
      prisma.contact.aggregate({
        _min: { totalBathrooms: true },
        _max: { totalBathrooms: true },
        where: { totalBathrooms: { not: null } }
      }),

      // Properties Count Stats - get min/max of property counts per contact
      // Property count = 1 (if contact has property_address) + count of contact_properties
      prisma.$queryRaw`
        SELECT
          COALESCE(MIN(property_count), 1) as min_properties,
          COALESCE(MAX(property_count), 1) as max_properties
        FROM (
          SELECT c.id,
            (CASE WHEN c.property_address IS NOT NULL THEN 1 ELSE 0 END) + COUNT(cp.id) as property_count
          FROM contacts c
          LEFT JOIN contact_properties cp ON c.id = cp.contact_id
          GROUP BY c.id
        ) property_counts
      `
    ]);

    console.log('✅ [FILTER OPTIONS API] Query results:', {
      cities: cities.length,
      states: states.length,
      counties: counties.length,
      propertyTypes: propertyTypes.length,
      dealStatuses: dealStatuses.length,
      tags: (tags as any[]).length
    })

    // Normalize property types and get unique values
    const rawPropertyTypes = propertyTypes.map(p => p.propertyType).filter(Boolean);
    const normalizedPropertyTypes = Array.from(new Set(
      rawPropertyTypes.map(pt => normalizePropertyType(pt) || pt)
    )).filter(Boolean).sort();

    // Format the response
    const filterOptions = {
      cities: cities.map(c => c.city).filter(Boolean),
      states: states.map(s => s.state).filter(Boolean),
      counties: counties.map(c => c.propertyCounty).filter(Boolean),
      propertyTypes: normalizedPropertyTypes,
      dealStatuses: dealStatuses.map(d => d.dealStatus).filter(Boolean),
      tags: (tags as any[]).map(t => ({
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
      },
      sqftRange: {
        min: sqftStats._min.buildingSqft ? Number(sqftStats._min.buildingSqft) : 0,
        max: sqftStats._max.buildingSqft ? Number(sqftStats._max.buildingSqft) : 10000
      },
      bedsRange: {
        min: bedsStats._min.bedrooms ? Number(bedsStats._min.bedrooms) : 0,
        max: bedsStats._max.bedrooms ? Number(bedsStats._max.bedrooms) : 10
      },
      bathsRange: {
        min: bathsStats._min.totalBathrooms ? Number(bathsStats._min.totalBathrooms) : 0,
        max: bathsStats._max.totalBathrooms ? Number(bathsStats._max.totalBathrooms) : 10
      },
      propertiesRange: {
        min: (propertiesStats as any[])?.[0]?.min_properties ? Number((propertiesStats as any[])[0].min_properties) : 1,
        max: (propertiesStats as any[])?.[0]?.max_properties ? Number((propertiesStats as any[])[0].max_properties) : 20
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
