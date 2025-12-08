import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// POST /api/contacts/batch - Fetch multiple contacts by IDs
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 })
    }

    // Limit to 500 contacts max to prevent abuse
    const limitedIds = ids.slice(0, 500)

    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: limitedIds }
      },
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
        city: true,
        state: true,
        estValue: true,
        dealStatus: true,
      },
      orderBy: {
        // Preserve the order of the input IDs by sorting later
        createdAt: 'asc'
      }
    })

    // Reorder contacts to match the input IDs order
    const contactMap = new Map(contacts.map(c => [c.id, c]))
    const orderedContacts = limitedIds
      .map(id => contactMap.get(id))
      .filter(Boolean) // Remove any not found

    return NextResponse.json({
      contacts: orderedContacts,
      total: orderedContacts.length,
      requested: limitedIds.length
    })
  } catch (error) {
    console.error('Error fetching batch contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

