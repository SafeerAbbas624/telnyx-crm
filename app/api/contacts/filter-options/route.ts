import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
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
      
      // Tags
      prisma.tag.findMany({
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' }
      }),
      
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

    return NextResponse.json(filterOptions);
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
