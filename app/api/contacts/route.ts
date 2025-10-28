import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { redisClient } from '@/lib/cache/redis-client';
import { elasticsearchClient } from '@/lib/search/elasticsearch-client';
import { formatPhoneNumberForTelnyx, last10Digits } from '@/lib/phone-utils';
import { getToken } from 'next-auth/jwt';

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 20000) // Cap at 20000 to allow loading all contacts
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
    const hasMultiValues = [dealStatus, propertyType, city, state, propertyCounty, tags].some(v => (v ?? '').includes(','))
    const useElasticsearch = (searchParams.get('useElasticsearch') === 'true' || !!search) && !hasMultiValues

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

        // If Elasticsearch returned results, respond; otherwise, fall back to DB query below
        if (result.total && result.total > 0 && Array.isArray(formattedContacts) && formattedContacts.length > 0) {
          return NextResponse.json(response)
        } else {
          console.warn('Elasticsearch returned no results; falling back to database query for search=', search)
        }
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

    // Helper to parse comma-separated values
    const splitCsv = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean)

    if (dealStatus) {
      const list = splitCsv(dealStatus)
      where.dealStatus = list.length > 1 ? { in: list } : list[0]
    }

    if (propertyType) {
      const list = splitCsv(propertyType)
      where.propertyType = list.length > 1 ? { in: list } : list[0]
    }

    if (city) {
      const list = splitCsv(city)
      where.city = list.length > 1 ? { in: list } : { equals: list[0] }
    }

    if (state) {
      const list = splitCsv(state)
      where.state = list.length > 1 ? { in: list } : { equals: list[0] }
    }

    if (propertyCounty) {
      const list = splitCsv(propertyCounty)
      where.propertyCounty = list.length > 1 ? { in: list } : { equals: list[0] }
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

    // Apply value filters only when range is not the default "show all". Avoid excluding NULLs on default.
    if ((minValue !== undefined || maxValue !== undefined) && !isDefaultValueRange) {
      where.estValue = {}
      if (minValue !== undefined) where.estValue.gte = minValue
      if (maxValue !== undefined) where.estValue.lte = maxValue
    }

    // Apply equity filters only when range is not the default "show all". Avoid excluding NULLs on default.
    if ((minEquity !== undefined || maxEquity !== undefined) && !isDefaultEquityRange) {
      where.estEquity = {}
      if (minEquity !== undefined) where.estEquity.gte = minEquity
      if (maxEquity !== undefined) where.estEquity.lte = maxEquity
    }

    // Always get accurate count for proper pagination
    let totalCount: number
    let contacts: any[]
    let hasMore: boolean

    // Determine which fields to select based on whether we have active filters
    const hasActiveFilters = hasActiveSearch || hasExplicitFilters

    // Get accurate total count and contacts in parallel
    const [exactTotal, rows] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        select: hasActiveFilters ? {
          // Slim payload for filtered results
          id: true,
          firstName: true,
          lastName: true,
          llcName: true,
          phone1: true,
          email1: true,
          propertyAddress: true,
          city: true,
          state: true,
          propertyCounty: true,
          propertyType: true,
          bedrooms: true,
          estValue: true,
          estEquity: true,
          dnc: true,
          dealStatus: true,
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
        } : {
          // Full details for browsing all contacts
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
    ])

    totalCount = exactTotal
    contacts = rows
    hasMore = offset + contacts.length < totalCount

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
      tags: (contact.contact_tags ?? []).map((ct: { tag: { name: string; id: string; color: string } }) => ({
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
        hasMore
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

    // Normalize phone numbers to E.164
    const phone1 = formatPhoneNumberForTelnyx(body.phone1 || '') || null
    const phone2 = formatPhoneNumberForTelnyx(body.phone2 || '') || null
    const phone3 = formatPhoneNumberForTelnyx(body.phone3 || '') || null

    // Validate required fields: firstName and phone1
    if (!body.firstName || !String(body.firstName).trim()) {
      return NextResponse.json({ error: 'firstName is required' }, { status: 400 })
    }
    if (!body.phone1 || !phone1) {
      return NextResponse.json({ error: 'phone1 is required and must be a valid phone number' }, { status: 400 })
    }

    // De-dup by phone: if any provided phone matches an existing contact (digits-only ends-with), update it instead of creating new
    const candidatesLast10 = [phone1, phone2, phone3].map(p => last10Digits(p || '')).filter(Boolean) as string[]
    let existing: any = null
    if (candidatesLast10.length > 0 && prisma.$queryRaw) {
      try {
        const last10 = candidatesLast10[0] // prioritize primary
        const rows: Array<{ id: string }> = await prisma.$queryRaw`
          SELECT id FROM contacts
          WHERE regexp_replace(COALESCE(phone1, ''), '\\D', '', 'g') LIKE ${'%' + last10}
             OR regexp_replace(COALESCE(phone2, ''), '\\D', '', 'g') LIKE ${'%' + last10}
             OR regexp_replace(COALESCE(phone3, ''), '\\D', '', 'g') LIKE ${'%' + last10}
          LIMIT 1`
        if (rows && rows.length > 0) {
          existing = await prisma.contact.findUnique({ where: { id: rows[0].id } })
        }
      } catch (e) {
        console.warn('Digits-only POST /contacts lookup failed:', e)
      }
    }

    const contactData = {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      llcName: body.llcName || null,
      phone1,
      phone2,
      phone3,
      email1: body.email1 || null,
      email2: body.email2 || null,
      email3: body.email3 || null,
      propertyAddress: body.propertyAddress || null,
      contactAddress: body.contactAddress || null,
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

    const createdOrUpdated = existing
      ? await prisma.contact.update({ where: { id: existing.id }, data: contactData })
      : await prisma.contact.create({ data: contactData })

    // If tags provided, upsert names and sync associations (only when at least one tag specified)
    if (Array.isArray(body.tags)) {
      const incoming: Array<{ id?: string; name?: string; color?: string } | string> = body.tags;

      // Only modify associations when user actually provided at least one tag token
      if (incoming.length > 0) {
        const desiredTagIds = new Set<string>();
        const candidatesToCreate = new Map<string, string | undefined>();

        for (const item of incoming) {
          if (typeof item === 'string') {
            const name = item.trim();
            if (name) candidatesToCreate.set(name, undefined);
            continue;
          }
          if (item && item.id) {
            desiredTagIds.add(item.id);
          } else if (item && item.name) {
            const name = item.name.trim();
            if (name) candidatesToCreate.set(name, item.color);
          }
        }

        for (const [name, color] of candidatesToCreate.entries()) {
          const tag = await prisma.tag.upsert({
            where: { name },
            update: color ? { color } : {},
            create: { name, ...(color ? { color } : {}) },
          });
          desiredTagIds.add(tag.id);
        }

        // Replace existing associations with the desired set
        await prisma.contactTag.deleteMany({ where: { contact_id: createdOrUpdated.id } });

        if (desiredTagIds.size > 0) {
          await prisma.contactTag.createMany({
            data: [...desiredTagIds].map((tid) => ({ contact_id: createdOrUpdated.id, tag_id: tid })),
            skipDuplicates: true,
          });
        }
      }
    }

    // Re-fetch full contact with tags to return
    const newContact = await prisma.contact.findUnique({
      where: { id: createdOrUpdated.id },
      include: { contact_tags: { include: { tag: { select: { id: true, name: true, color: true } } } } },
    })

    if (!newContact) {
      return NextResponse.json({ error: 'Contact not found after creation' }, { status: 500 })
    }

    // If a TEAM_USER created this contact, auto-assign it to them
    try {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
      if (token && token.role === 'TEAM_USER' && token.sub) {
        await prisma.contactAssignment.upsert({
          where: { userId_contactId: { userId: token.sub as string, contactId: newContact.id } },
          update: { assignedBy: token.sub as string },
          create: { userId: token.sub as string, contactId: newContact.id, assignedBy: token.sub as string },
        })
      }
    } catch (e) {
      console.warn('Auto-assign on contact create failed (non-fatal):', e)
    }

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

    // Index the contact into Elasticsearch (non-blocking on failure)
    try {
      await elasticsearchClient.indexContact({
        id: newContact.id,
        firstName: newContact.firstName || undefined,
        lastName: newContact.lastName || undefined,
        llcName: newContact.llcName || undefined,
        phone1: newContact.phone1 || undefined,
        phone2: newContact.phone2 || undefined,
        phone3: newContact.phone3 || undefined,
        email1: newContact.email1 || undefined,
        email2: newContact.email2 || undefined,
        email3: newContact.email3 || undefined,
        propertyAddress: newContact.propertyAddress || undefined,
        contactAddress: newContact.contactAddress || undefined,
        city: newContact.city || undefined,
        state: newContact.state || undefined,
        propertyCounty: newContact.propertyCounty || undefined,
        propertyType: newContact.propertyType || undefined,
        estValue: newContact.estValue != null ? Number(newContact.estValue) : undefined,
        estEquity: newContact.estEquity != null ? Number(newContact.estEquity) : undefined,
        dnc: typeof newContact.dnc === 'boolean' ? newContact.dnc : undefined,
        dealStatus: newContact.dealStatus || undefined,
        createdAt: newContact.createdAt.toISOString(),
        updatedAt: (newContact.updatedAt?.toISOString() || newContact.createdAt.toISOString()),
        tags: newContact.contact_tags?.map((ct) => ct.tag.name) || [],
      })
    } catch (e) {
      console.warn('ES indexContact failed (non-fatal):', e)
    }

    return NextResponse.json(formattedContact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
