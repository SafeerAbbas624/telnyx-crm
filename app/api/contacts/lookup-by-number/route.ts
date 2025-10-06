import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { last10Digits, formatPhoneNumberForTelnyx } from '@/lib/phone-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = (searchParams.get('number') || searchParams.get('last10') || '').trim()
    if (!raw) return NextResponse.json({ error: 'number or last10 is required' }, { status: 400 })

    const last10 = searchParams.get('last10')?.trim() || last10Digits(formatPhoneNumberForTelnyx(raw) || raw)
    if (!last10) return NextResponse.json({ error: 'invalid number' }, { status: 400 })

    // Use a fast digits-only ends-with lookup across phone1/2/3
    // Postgres regexp_replace removes non-digits for robust matching
    let contact: any = null
    try {
      const rows: Array<{ id: string }> = await prisma.$queryRaw`
        SELECT id FROM contacts
        WHERE regexp_replace(COALESCE(phone1, ''), '\\D', '', 'g') LIKE ${'%' + last10}
           OR regexp_replace(COALESCE(phone2, ''), '\\D', '', 'g') LIKE ${'%' + last10}
           OR regexp_replace(COALESCE(phone3, ''), '\\D', '', 'g') LIKE ${'%' + last10}
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1`
      if (rows && rows.length > 0) {
        contact = await prisma.contact.findUnique({ where: { id: rows[0].id } })
      }
    } catch (e) {
      // Fallback to Prisma contains queries if raw SQL fails (less accurate)
      contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { phone1: { contains: last10 } },
            { phone2: { contains: last10 } },
            { phone3: { contains: last10 } },
          ]
        },
        orderBy: { updatedAt: 'desc' }
      })
    }

    if (!contact) return NextResponse.json({})

    // Normalize shape similar to /api/contacts/[id]
    const formatted = {
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
      createdAt: contact.createdAt?.toISOString?.() || contact.createdAt,
      updatedAt: contact.updatedAt?.toISOString?.() || contact.updatedAt,
    }

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Lookup by number failed:', error)
    return NextResponse.json({ error: 'Failed to lookup contact' }, { status: 500 })
  }
}

