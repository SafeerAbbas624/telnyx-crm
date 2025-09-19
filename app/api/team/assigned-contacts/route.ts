import { NextRequest, NextResponse } from 'next/server'
import { withTeamAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  return withTeamAuth(request, async (req, user) => {
    try {
      const userId = user.sub
      const { searchParams } = new URL(request.url)
      const search = searchParams.get('search') || ''
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
      const offset = (page - 1) * limit

      // Additional filters
      const city = searchParams.get('city') || undefined
      const state = searchParams.get('state') || undefined
      const propertyCounty = searchParams.get('propertyCounty') || undefined
      const propertyType = searchParams.get('propertyType') || undefined
      const tags = searchParams.get('tags') || undefined
      const minValue = searchParams.get('minValue') ? parseFloat(searchParams.get('minValue')!) : undefined
      const maxValue = searchParams.get('maxValue') ? parseFloat(searchParams.get('maxValue')!) : undefined
      const minEquity = searchParams.get('minEquity') ? parseFloat(searchParams.get('minEquity')!) : undefined
      const maxEquity = searchParams.get('maxEquity') ? parseFloat(searchParams.get('maxEquity')!) : undefined

      // Build where clause for assigned contacts + filters
      const where: any = {
        assignments: { some: { userId } }
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { llcName: { contains: search, mode: 'insensitive' } },
          { email1: { contains: search, mode: 'insensitive' } },
          { phone1: { contains: search } },
          { propertyAddress: { contains: search, mode: 'insensitive' } },
        ]
      }

      if (city) where.city = { contains: city, mode: 'insensitive' }
      if (state) where.state = { contains: state, mode: 'insensitive' }
      if (propertyCounty) where.propertyCounty = { contains: propertyCounty, mode: 'insensitive' }
      if (propertyType) where.propertyType = propertyType

      if (tags) {
        const tagNames = tags.split(',').map(t => t.trim()).filter(Boolean)
        if (tagNames.length > 0) {
          where.contact_tags = { some: { tag: { name: { in: tagNames } } } }
        }
      }

      if (minValue !== undefined || maxValue !== undefined) {
        where.estValue = {}
        if (minValue !== undefined) where.estValue.gte = minValue
        if (maxValue !== undefined) where.estValue.lte = maxValue
      }

      if (minEquity !== undefined || maxEquity !== undefined) {
        where.estEquity = {}
        if (minEquity !== undefined) where.estEquity.gte = minEquity
        if (maxEquity !== undefined) where.estEquity.lte = maxEquity
      }

      // Parallel count + page data
      const [totalCount, contacts] = await Promise.all([
        prisma.contact.count({ where }),
        prisma.contact.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            email2: true,
            email3: true,
            phone1: true,
            phone2: true,
            phone3: true,
            llcName: true,
            propertyAddress: true,
            contactAddress: true,
            city: true,
            state: true,
            propertyCounty: true,
            estValue: true,
            estEquity: true,
            createdAt: true,
            updatedAt: true,
            contact_tags: {
              select: { tag: { select: { id: true, name: true, color: true } } }
            },
            assignments: {
              where: { userId },
              select: { assignedAt: true, assignedBy: true }
            }
          },
          orderBy: [
            { firstName: 'asc' },
            { lastName: 'asc' }
          ],
          take: limit,
          skip: offset
        })
      ])

      const formattedContacts = contacts.map(contact => ({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email1: contact.email1,
        email2: contact.email2,
        email3: contact.email3,
        phone1: contact.phone1,
        phone2: contact.phone2,
        phone3: contact.phone3,
        llcName: contact.llcName,
        propertyAddress: contact.propertyAddress,
        contactAddress: contact.contactAddress,
        city: contact.city,
        state: contact.state,
        propertyCounty: contact.propertyCounty,
        estValue: contact.estValue,
        estEquity: contact.estEquity,
        tags: contact.contact_tags.map((ct: any) => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color || '#3B82F6' })),
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
        assignedAt: contact.assignments[0]?.assignedAt?.toISOString()
      }))

      return NextResponse.json({
        contacts: formattedContacts,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount
        }
      })
    } catch (error) {
      console.error('Error fetching assigned contacts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch assigned contacts' },
        { status: 500 }
      )
    }
  })
}
