import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic'

// Check if search term looks like a phone number (mostly digits)
function isPhoneSearch(term: string): boolean {
  const digits = term.replace(/\D/g, '');
  // If search has 7+ digits, treat as phone search
  return digits.length >= 7;
}

// Check if search term looks like an email
function isEmailSearch(term: string): boolean {
  return term.includes('@') || (term.includes('.') && /^[a-z0-9._%+-]+$/i.test(term));
}

// Normalize phone for comparison (strip non-digits, handle +1)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Remove leading 1 for US numbers
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.toLowerCase().trim();
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    const normalizedSearchPhone = searchTerm.replace(/\D/g, '');

    console.log('🔍 [SEARCH API] Pipedrive-style search for:', searchTerm);

    // Build contact where clause based on user role
    let contactWhereClause: any = {};

    if (session.user.role === 'TEAM_USER') {
      const assignedContacts = await prisma.contactAssignment.findMany({
        where: { userId: session.user.id },
        select: { contactId: true }
      });
      const assignedContactIds = assignedContacts.map(ac => ac.contactId);

      if (assignedContactIds.length === 0) {
        return NextResponse.json({ results: [] });
      }

      contactWhereClause.id = { in: assignedContactIds };
    }

    // Detect search type for more precise matching
    const isPhone = isPhoneSearch(searchTerm);
    const isEmail = isEmailSearch(searchTerm);
    const normalizedSearchPhoneFull = normalizePhone(searchTerm);

    // Build database-level search filter for efficiency (instead of loading all contacts)
    const searchFilter: any = { ...contactWhereClause };

    if (isPhone && normalizedSearchPhoneFull.length >= 7) {
      // Phone search - DB stores phones with +1 prefix, so search for both formats
      // Also search by the last N digits for partial matching
      searchFilter.OR = [
        { phone1: { contains: normalizedSearchPhoneFull, mode: 'insensitive' } },
        { phone2: { contains: normalizedSearchPhoneFull, mode: 'insensitive' } },
        { phone3: { contains: normalizedSearchPhoneFull, mode: 'insensitive' } },
      ];
    } else if (isEmail) {
      // Email search - search by email prefix or full email
      const emailPrefix = searchTerm.split('@')[0];
      searchFilter.OR = [
        { email1: { contains: emailPrefix, mode: 'insensitive' } },
        { email2: { contains: emailPrefix, mode: 'insensitive' } },
        { email3: { contains: emailPrefix, mode: 'insensitive' } },
      ];
    } else {
      // Name/text search - search firstName, lastName, llcName, propertyAddress, city, state, zipCode
      // For multi-word searches, use OR conditions for each word in key fields
      const searchConditions: any[] = [];

      // Add conditions for each search word
      for (const word of searchWords) {
        searchConditions.push(
          { firstName: { contains: word, mode: 'insensitive' } },
          { lastName: { contains: word, mode: 'insensitive' } }
        );
      }

      // Also add full search term for llcName, propertyAddress, city, state
      searchConditions.push(
        { llcName: { contains: searchTerm, mode: 'insensitive' } },
        { propertyAddress: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        { state: { contains: searchTerm, mode: 'insensitive' } },
        { zipCode: { contains: searchTerm, mode: 'insensitive' } }
      );

      // For multi-word searches on address/llc, add individual words too
      if (searchWords.length > 1) {
        for (const word of searchWords) {
          if (word.length >= 2) {
            searchConditions.push(
              { llcName: { contains: word, mode: 'insensitive' } },
              { propertyAddress: { contains: word, mode: 'insensitive' } }
            );
          }
        }
      }

      searchFilter.OR = searchConditions;
    }

    // Get filtered contacts with limit for performance
    const allContacts = await prisma.contact.findMany({
      where: searchFilter,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        phone2: true,
        phone3: true,
        email1: true,
        email2: true,
        email3: true,
        propertyAddress: true,
        llcName: true,
        city: true,
        state: true,
        zipCode: true,
      },
      take: 100, // Limit to 100 contacts for performance
      orderBy: { createdAt: 'desc' },
    });

    // Precise search scoring - like Pipedrive
    const contactsWithScore = allContacts.map((contact) => {
      const firstName = (contact.firstName || '').toLowerCase().trim();
      const lastName = (contact.lastName || '').toLowerCase().trim();
      const fullName = `${firstName} ${lastName}`.trim();

      const phone1Norm = normalizePhone(contact.phone1 || '');
      const phone2Norm = normalizePhone(contact.phone2 || '');
      const phone3Norm = normalizePhone(contact.phone3 || '');

      const email1 = (contact.email1 || '').toLowerCase();
      const email2 = (contact.email2 || '').toLowerCase();
      const email3 = (contact.email3 || '').toLowerCase();

      const address = (contact.propertyAddress || '').toLowerCase();
      const llc = (contact.llcName || '').toLowerCase();
      const city = (contact.city || '').toLowerCase();
      const state = (contact.state || '').toLowerCase();
      const zipCode = (contact.zipCode || '').toLowerCase();

      let score = 0;
      let matchReason = '';

      // PHONE SEARCH: Exact match only (7+ digits)
      if (isPhone && normalizedSearchPhoneFull.length >= 7) {
        // Exact phone match (full number) or contains the search digits
        if (phone1Norm === normalizedSearchPhoneFull || phone1Norm.endsWith(normalizedSearchPhoneFull) || phone1Norm.includes(normalizedSearchPhoneFull)) {
          score = 10000;
          matchReason = 'Phone';
        } else if (phone2Norm === normalizedSearchPhoneFull || phone2Norm.endsWith(normalizedSearchPhoneFull) || phone2Norm.includes(normalizedSearchPhoneFull)) {
          score = 10000;
          matchReason = 'Phone 2';
        } else if (phone3Norm === normalizedSearchPhoneFull || phone3Norm.endsWith(normalizedSearchPhoneFull) || phone3Norm.includes(normalizedSearchPhoneFull)) {
          score = 10000;
          matchReason = 'Phone 3';
        }
        // For phone searches, only return exact matches
        return { contact, score, matchReason };
      }

      // EMAIL SEARCH: Exact match or contains
      if (isEmail) {
        const emailPrefix = searchTerm.split('@')[0].toLowerCase();
        if (email1 === searchTerm || email1.startsWith(emailPrefix)) {
          score = 10000;
          matchReason = 'Email';
        } else if (email2 === searchTerm || email2.startsWith(emailPrefix)) {
          score = 10000;
          matchReason = 'Email 2';
        } else if (email3 === searchTerm || email3.startsWith(emailPrefix)) {
          score = 10000;
          matchReason = 'Email 3';
        }
        // For email searches, only return exact matches
        return { contact, score, matchReason };
      }

      // NAME SEARCH: Multi-word (e.g., "george mena") - STRICT matching, ALL words must match
      if (searchWords.length > 1) {
        // Exact full name match - highest score
        if (fullName === searchTerm) {
          score = 10000;
          matchReason = 'Exact name';
          return { contact, score, matchReason };
        }

        // Check if ALL words match in name (first word in firstName, last word in lastName)
        const firstWord = searchWords[0];
        const lastWord = searchWords[searchWords.length - 1];

        const firstMatchesFirstName = firstName.startsWith(firstWord) || firstName === firstWord;
        const lastMatchesLastName = lastName.startsWith(lastWord) || lastName === lastWord;

        if (firstMatchesFirstName && lastMatchesLastName) {
          score = 9000;
          matchReason = 'Name match';
          return { contact, score, matchReason };
        }

        // Check if ALL words appear somewhere in the full name (strict AND logic)
        const allWordsInName = searchWords.every(w => fullName.includes(w));
        if (allWordsInName) {
          score = 8000;
          matchReason = 'Name contains';
          return { contact, score, matchReason };
        }

        // Multi-word search for address - ALL words must match
        if (address && searchWords.every(w => address.includes(w))) {
          score = 4000;
          matchReason = 'Address';
          return { contact, score, matchReason };
        }

        // Multi-word search for LLC - ALL words must match
        if (llc && searchWords.every(w => llc.includes(w))) {
          score = 3500;
          matchReason = 'Company';
          return { contact, score, matchReason };
        }

        // For multi-word search, DO NOT return partial matches (only one word matching)
        // This prevents "Menachem Posner" showing up when searching "george mena"
        return { contact, score: 0, matchReason: '' };
      }

      // SINGLE WORD SEARCH
      const word = searchWords[0];

      // Exact first or last name match
      if (firstName === word || lastName === word) {
        score = 7000;
        matchReason = 'Exact name';
      }
      // Name starts with search term
      else if (firstName.startsWith(word) || lastName.startsWith(word)) {
        score = 6000;
        matchReason = 'Name starts with';
      }
      // Name contains search term
      else if (fullName.includes(word) && word.length >= 3) {
        score = 5000;
        matchReason = 'Name contains';
      }
      // Partial phone match (for shorter searches like last 4 digits)
      else if (normalizedSearchPhone.length >= 4 && normalizedSearchPhone.length < 7) {
        if (phone1Norm.endsWith(normalizedSearchPhone)) { score = 3000; matchReason = 'Phone'; }
        else if (phone2Norm.endsWith(normalizedSearchPhone)) { score = 3000; matchReason = 'Phone 2'; }
        else if (phone3Norm.endsWith(normalizedSearchPhone)) { score = 3000; matchReason = 'Phone 3'; }
      }
      // Company/LLC name match
      if (score === 0 && llc.includes(word) && word.length >= 2) {
        score = 2000;
        matchReason = 'Company';
      }
      // Address match
      if (score === 0 && address.includes(word) && word.length >= 3) {
        score = 1500;
        matchReason = 'Address';
      }
      // City match
      if (score === 0 && city.includes(word) && word.length >= 2) {
        score = 1200;
        matchReason = 'City';
      }
      // State match
      if (score === 0 && state.includes(word) && word.length >= 2) {
        score = 1100;
        matchReason = 'State';
      }
      // Zip code match
      if (score === 0 && zipCode.includes(word) && word.length >= 3) {
        score = 1000;
        matchReason = 'Zip';
      }

      return { contact, score, matchReason };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Limit to 10 most relevant contacts (increased from 5)

    const contacts = contactsWithScore;

    console.log('🔍 [SEARCH API] Filtered to', contacts.length, 'matching contacts');

    // Build activity (task) search filter - filter at database level for efficiency
    const activitySearchFilter: any = {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    // Add word-by-word search for multi-word queries
    if (searchWords.length > 1) {
      for (const word of searchWords) {
        if (word.length >= 2) {
          activitySearchFilter.OR.push(
            { title: { contains: word, mode: 'insensitive' } },
            { description: { contains: word, mode: 'insensitive' } }
          );
        }
      }
    }

    // Apply role-based filtering for TEAM_USER
    if (session.user.role === 'TEAM_USER') {
      const assignedContacts = await prisma.contactAssignment.findMany({
        where: { userId: session.user.id },
        select: { contactId: true }
      });
      const assignedContactIds = assignedContacts.map(ac => ac.contactId);

      if (assignedContactIds.length === 0) {
        // No contacts assigned, return empty activities
        activitySearchFilter.contact_id = { in: [] };
      } else {
        activitySearchFilter.contact_id = { in: assignedContactIds };
      }
    }

    // Search activities with database-level filtering
    const activities = await prisma.activity.findMany({
      where: activitySearchFilter,
      select: {
        id: true,
        title: true,
        description: true,
        due_date: true,
        status: true,
        contact: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      take: 10, // Limit results for performance
      orderBy: { created_at: 'desc' },
    });

    console.log('🔍 [SEARCH API] Found', activities.length, 'matching activities');

    // Search deals - Note: Deal model doesn't have a contact relation, only contact_id
    const deals = await prisma.deal.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { notes: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        name: true,
        value: true,
        stage: true,
        contact_id: true,
      },
    });

    console.log('🔍 [SEARCH API] Found', deals.length, 'matching deals');

    // Get contact names for deals
    const dealContactIds = deals.map(d => d.contact_id).filter(Boolean) as string[];
    const dealContacts = dealContactIds.length > 0 ? await prisma.contact.findMany({
      where: { id: { in: dealContactIds } },
      select: { id: true, firstName: true, lastName: true }
    }) : [];

    const dealContactMap = new Map(dealContacts.map(c => [c.id, c]));

    // Helper to get the matched value based on match reason
    const getMatchedValue = (contact: typeof allContacts[0], matchReason: string): string => {
      switch (matchReason) {
        case 'Phone':
          return contact.phone1 || '';
        case 'Phone 2':
          return contact.phone2 || contact.phone1 || '';
        case 'Phone 3':
          return contact.phone3 || contact.phone1 || '';
        case 'Email':
          return contact.email1 || '';
        case 'Email 2':
          return contact.email2 || contact.email1 || '';
        case 'Email 3':
          return contact.email3 || contact.email1 || '';
        case 'Company':
          return contact.llcName || '';
        case 'Address':
          return contact.propertyAddress || '';
        case 'City':
          return contact.city || '';
        case 'State':
          return contact.state || '';
        case 'Zip':
          return contact.zipCode || '';
        default:
          return '';
      }
    };

    // Name-related match reasons that shouldn't show in subtitle
    const nameMatchReasons = ['Exact name match', 'Name match', 'Exact name', 'Name starts with', 'Similar name', 'Name contains'];

    // Format results - show match reason like Pipedrive
    const results = [
      ...contacts.map(({ contact, matchReason }) => {
        const matchedValue = getMatchedValue(contact, matchReason);
        const isNameMatch = nameMatchReasons.includes(matchReason);

        return {
          id: contact.id,
          type: 'contact' as const,
          title: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact',
          subtitle: !isNameMatch && matchedValue
            ? `${matchReason}: ${matchedValue}`
            : contact.phone1 || contact.email1 || undefined,
          metadata: contact.propertyAddress || contact.city || undefined,
        };
      }),
      ...activities.map((activity) => ({
        id: activity.id,
        type: 'task' as const,
        title: activity.title,
        subtitle: activity.contact
          ? `${activity.contact.firstName || ''} ${activity.contact.lastName || ''}`.trim()
          : undefined,
        metadata: activity.due_date
          ? new Date(activity.due_date).toLocaleDateString()
          : activity.status,
      })),
      ...deals.map((deal) => {
        const contact = deal.contact_id ? dealContactMap.get(deal.contact_id) : null;
        return {
          id: deal.id,
          type: 'deal' as const,
          title: deal.name,
          subtitle: contact
            ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
            : undefined,
          metadata: deal.value ? `$${Number(deal.value).toLocaleString()}` : deal.stage,
        };
      }),
    ];

    console.log('🔍 [SEARCH API] Returning', results.length, 'total results');

    return NextResponse.json({ results });
  } catch (error) {
    console.error('❌ [SEARCH API] Search error:', error);
    console.error('❌ [SEARCH API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ error: 'Search failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

