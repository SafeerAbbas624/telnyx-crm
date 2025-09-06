import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redisClient } from '@/lib/cache/redis-client';
import { elasticsearchClient } from '@/lib/search/elasticsearch-client';

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  llcName: string | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  email1: string | null;
  email2: string | null;
  email3: string | null;
  propertyAddress: string | null;
  contactAddress: string | null;
  city: string | null;
  state: string | null;

  propertyCounty: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  totalBathrooms: any; // Decimal type from Prisma
  buildingSqft: number | null;
  effectiveYearBuilt: number | null;
  estValue: any; // Decimal type from Prisma
  estEquity: any; // Decimal type from Prisma
  dnc: boolean | null;
  dncReason: string | null;
  dealStatus: string | null;
  notes: string | null;
  avatarUrl: string | null;
  contact_tags: { tag: { id: string; name: string; color: string } }[];
  createdAt: Date;
  updatedAt: Date | null;
}

interface FormattedContact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  propertyAddress: string;
  propertyType: string;
  propertyValue: number | null;
  debtOwed: number | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}



export async function GET(request: NextRequest) {
  const startTime = Date.now()

  console.log(`🚀 [API DEBUG] Contacts API route called: ${request.url}`)

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Cap at 100 for performance
    const search = searchParams.get('search')
    const dealStatus = searchParams.get('dealStatus')
    const propertyType = searchParams.get('propertyType')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const propertyCounty = searchParams.get('propertyCounty')
    const tags = searchParams.get('tags')
    const minValue = searchParams.get('minValue') ? parseFloat(searchParams.get('minValue')!) : undefined
    const maxValue = searchParams.get('maxValue') ? parseFloat(searchParams.get('maxValue')!) : undefined
    const minEquity = searchParams.get('minEquity') ? parseFloat(searchParams.get('minEquity')!) : undefined
    const maxEquity = searchParams.get('maxEquity') ? parseFloat(searchParams.get('maxEquity')!) : undefined
    const useElasticsearch = searchParams.get('useElasticsearch') === 'true' || !!search

    const filters = { search, dealStatus, propertyType, city, state, propertyCounty, tags, minValue, maxValue, minEquity, maxEquity }

    // Enhanced logging for debugging
    console.log(`🔍 [API DEBUG] Contacts API called - Search: "${search || 'none'}" | Page: ${page} | Limit: ${limit}`)
    console.log(`🔍 [API DEBUG] All params:`, { search, dealStatus, propertyType, city, state, propertyCounty, tags, minValue, maxValue, minEquity, maxEquity })

    // Try cache first for non-search queries
    if (!search) {
      try {
        const cached = await redisClient.getCachedContactsPage(page, limit, filters)
        if (cached) {
          // Normalize previously mis-cached shapes (where entire response was stored under contacts)
          let normalized = cached as any
          if (normalized && normalized.contacts && !Array.isArray(normalized.contacts) && Array.isArray(normalized.contacts.contacts)) {
            normalized = normalized.contacts
          }
          if (normalized && Array.isArray(normalized.contacts) && normalized.contacts.length > 0) {
            return NextResponse.json({ ...normalized, source: 'cache' })
          }
          // If cache is empty or invalid, ignore and fall through to DB query
        }
      } catch (error) {
        console.log('⚠️ [API DEBUG] Redis cache failed, continuing without cache:', error)
      }
    }

    let result: any

    // Use Elasticsearch for search queries or when explicitly requested
    if (useElasticsearch && (await elasticsearchClient.isHealthy())) {
      try {
        result = await elasticsearchClient.searchContacts({
          search,
          dealStatus: dealStatus || undefined,
          propertyType: propertyType || undefined,
          city: city || undefined,
          state: state || undefined,
          minValue,
          maxValue,
          page,
          limit,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })

        // Transform Elasticsearch results to match expected format
        const formattedContacts = result.contacts.map((contact: any) => ({
          id: contact.id,
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          phone: contact.phone1 || contact.phone2 || contact.phone3 || '',
          email: contact.email1 || contact.email2 || contact.email3 || '',
          propertyAddress: contact.propertyAddress || '',
          propertyType: contact.propertyType || '',
          propertyValue: contact.estValue ? Number(contact.estValue) : null,
          debtOwed: contact.estValue && contact.estEquity ?
            Number(contact.estValue) - Number(contact.estEquity) : null,
          tags: contact.tags || [],
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          _score: contact._score,
          _highlights: contact._highlights
        }))

        const response = {
          contacts: formattedContacts,
          pagination: {
            page: result.page,
            limit: result.limit,
            totalCount: result.total,
            totalPages: result.totalPages,
            hasMore: page * limit < result.total
          },
          source: 'elasticsearch'
        }

        // Cache search results briefly
        if (search) {
          await redisClient.cacheSearchResults(search, page, limit, response, 120)
        }

        return NextResponse.json(response)
      } catch (esError) {
        console.error('Elasticsearch error, falling back to database:', esError)
        // Fall through to database query
      }
    }

    // Fallback to database query with optimizations
    const offset = (page - 1) * limit

    // Build where clause for filtering
    const where: any = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { llcName: { contains: search, mode: 'insensitive' } },
        { phone1: { contains: search } },
        { email1: { contains: search, mode: 'insensitive' } },
        { propertyAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dealStatus) {
      where.dealStatus = dealStatus
    }

    if (propertyType) {
      where.propertyType = propertyType
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' }
    }

    if (state) {
      where.state = { contains: state, mode: 'insensitive' }
    }

    if (propertyCounty) {
      where.propertyCounty = { contains: propertyCounty, mode: 'insensitive' }
    }

    if (tags) {
      const tagNames = tags.split(',').map(t => t.trim())
      where.contact_tags = {
        some: {
          tag: {
            name: { in: tagNames }
          }
        }
      }
    }

    // Only apply value/equity filters when there's an active search or when filters are explicitly set
    // This prevents the default filter ranges from excluding contacts when just browsing all contacts
    const hasActiveSearch = search && search.trim().length > 0
    const hasExplicitFilters = dealStatus || propertyType || city || state || propertyCounty || tags

    // Skip value/equity filters if they seem to be default "show all" values
    const isDefaultValueRange = (minValue === 500000 && maxValue === 2500000) ||
                               (minValue === 0 && maxValue >= 2000000)
    const isDefaultEquityRange = (minEquity <= 500 && maxEquity >= 900000000) ||
                                (minEquity === 0 && maxEquity >= 900000000)

    // Only apply value filters if we have an active search/filter OR the range is not default
    if ((minValue !== undefined || maxValue !== undefined) &&
        (hasActiveSearch || hasExplicitFilters || !isDefaultValueRange)) {
      where.estValue = {}
      if (minValue !== undefined) where.estValue.gte = minValue
      if (maxValue !== undefined) where.estValue.lte = maxValue
    }

    // Only apply equity filters if we have an active search/filter OR the range is not default
    if ((minEquity !== undefined || maxEquity !== undefined) &&
        (hasActiveSearch || hasExplicitFilters || !isDefaultEquityRange)) {
      where.estEquity = {}
      if (minEquity !== undefined) where.estEquity.gte = minEquity
      if (maxEquity !== undefined) where.estEquity.lte = maxEquity
    }

    // Use Promise.all for parallel queries
    const [totalCount, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          llcName: true,
          phone1: true,
          phone2: true,
          phone3: true,
          email1: true,
          email2: true,
          email3: true,
          propertyAddress: true,
          contactAddress: true,
          city: true,
          state: true,
          propertyCounty: true,
          propertyType: true,
          bedrooms: true,
          totalBathrooms: true,
          buildingSqft: true,
          effectiveYearBuilt: true,
          estValue: true,
          estEquity: true,
          dnc: true,
          dncReason: true,
          dealStatus: true,
          notes: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          contact_tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      })
    ]);

    console.log(`✅ [API DEBUG] Database query completed: ${totalCount} total, ${contacts.length} returned for "${search}" in ${Date.now() - startTime}ms`)

    if (contacts.length === 0) {
      console.log(`⚠️ [API DEBUG] No contacts returned from database query - this might indicate an issue with the query or filters`)
    } else {
      console.log(`📋 [API DEBUG] First contact sample:`, {
        id: contacts[0]?.id,
        name: `${contacts[0]?.firstName} ${contacts[0]?.lastName}`,
        phone: contacts[0]?.phone1
      })
    }

    // Transform the data to match the expected frontend format
    const formattedContacts = contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      llcName: contact.llcName || '',
      phone1: contact.phone1 || '',
      phone2: contact.phone2 || '',
      phone3: contact.phone3 || '',
      email1: contact.email1 || '',
      email2: contact.email2 || '',
      email3: contact.email3 || '',
      propertyAddress: contact.propertyAddress || '',
      contactAddress: contact.contactAddress || '',
      city: contact.city || '',
      state: contact.state || '',

      propertyCounty: contact.propertyCounty || '',
      propertyType: contact.propertyType || '',
      bedrooms: contact.bedrooms,
      totalBathrooms: contact.totalBathrooms ? Number(contact.totalBathrooms) : null,
      buildingSqft: contact.buildingSqft,
      effectiveYearBuilt: contact.effectiveYearBuilt,
      estValue: contact.estValue ? Number(contact.estValue) : null,
      estEquity: contact.estEquity ? Number(contact.estEquity) : null,
      dnc: contact.dnc,
      dncReason: contact.dncReason || '',
      dealStatus: contact.dealStatus,
      notes: contact.notes || '',
      avatarUrl: contact.avatarUrl || '',
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt?.toISOString() || contact.createdAt.toISOString(),
      // Legacy/compatibility fields
      phone: contact.phone1 || '',
      email: contact.email1 || '',
      propertyValue: contact.estValue ? Number(contact.estValue) : null,
      debtOwed: contact.estValue && contact.estEquity ?
        Number(contact.estValue) - Number(contact.estEquity) : null,
      tags: contact.contact_tags.map((ct: { tag: { name: string; id: string; color: string } }) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || '#3B82F6'
      })),
    }));



    const response = {
      contacts: formattedContacts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      },
      source: 'database'
    }

    // Cache the results (do not cache empty pages)
    try {
      await redisClient.cacheContactsPage(page, limit, filters, response.contacts, response.pagination)
    } catch (error) {
      console.log('⚠️ [API DEBUG] Redis caching failed, continuing without cache:', error)
    }

    console.log(`📤 [API DEBUG] Sending response with ${response.contacts.length} contacts, pagination:`, response.pagination)

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ [API DEBUG] Error fetching contacts:', error);
    console.error('❌ [API DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ [API DEBUG] Request params:', { search, page, limit, dealStatus, propertyType, city, state });
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST - Create new contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const contactData = {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      llcName: body.llcName || null,
      phone1: body.phone1 || null,
      phone2: body.phone2 || null,
      phone3: body.phone3 || null,
      email1: body.email1 || null,
      email2: body.email2 || null,
      email3: body.email3 || null,
      propertyAddress: body.propertyAddress || null,
      city: body.city || null,
      state: body.state || null,
      propertyCounty: body.propertyCounty || null,
      propertyType: body.propertyType || null,
      bedrooms: body.bedrooms || null,
      totalBathrooms: body.totalBathrooms || null,
      buildingSqft: body.buildingSqft || null,
      effectiveYearBuilt: body.effectiveYearBuilt || null,
      estValue: body.estValue || null,
      estEquity: body.estEquity || null,
      dnc: body.dnc || false,
      dncReason: body.dncReason || null,
      dealStatus: body.dealStatus || 'lead',
      notes: body.notes || null,
      avatarUrl: body.avatarUrl || null,
    };

    const newContact = await prisma.contact.create({
      data: contactData,
      include: {
        contact_tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Transform the data to match the expected frontend format
    const formattedContact = {
      id: newContact.id,
      firstName: newContact.firstName || '',
      lastName: newContact.lastName || '',
      llcName: newContact.llcName || '',
      phone1: newContact.phone1 || '',
      phone2: newContact.phone2 || '',
      phone3: newContact.phone3 || '',
      email1: newContact.email1 || '',
      email2: newContact.email2 || '',
      email3: newContact.email3 || '',
      propertyAddress: newContact.propertyAddress || '',
      contactAddress: newContact.contactAddress || '',
      city: newContact.city || '',
      state: newContact.state || '',
      propertyCounty: newContact.propertyCounty || '',
      propertyType: newContact.propertyType || '',
      bedrooms: newContact.bedrooms,
      totalBathrooms: newContact.totalBathrooms ? Number(newContact.totalBathrooms) : null,
      buildingSqft: newContact.buildingSqft,
      effectiveYearBuilt: newContact.effectiveYearBuilt,
      estValue: newContact.estValue ? Number(newContact.estValue) : null,
      estEquity: newContact.estEquity ? Number(newContact.estEquity) : null,
      dnc: newContact.dnc,
      dncReason: newContact.dncReason || '',
      dealStatus: newContact.dealStatus,
      notes: newContact.notes || '',
      avatarUrl: newContact.avatarUrl || '',
      createdAt: newContact.createdAt.toISOString(),
      updatedAt: newContact.updatedAt?.toISOString() || newContact.createdAt.toISOString(),
      // Legacy/compatibility fields
      phone: newContact.phone1 || '',
      email: newContact.email1 || '',
      propertyValue: newContact.estValue ? Number(newContact.estValue) : null,
      debtOwed: newContact.estValue && newContact.estEquity ?
        Number(newContact.estValue) - Number(newContact.estEquity) : null,
      tags: newContact.contact_tags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color || '#3B82F6'
      })),
    };

    return NextResponse.json(formattedContact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
