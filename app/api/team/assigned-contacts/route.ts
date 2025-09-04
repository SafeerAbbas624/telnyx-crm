import { NextRequest, NextResponse } from 'next/server'
import { withTeamAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  return withTeamAuth(request, async (req, user) => {
    try {
      const userId = user.sub
      const { searchParams } = new URL(request.url)
      const search = searchParams.get('search')
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      // Build where clause for search
      const where: any = {
        assignments: {
          some: {
            userId
          }
        }
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email1: { contains: search, mode: 'insensitive' } },
          { phone1: { contains: search, mode: 'insensitive' } },
          { llcName: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Get total count for pagination
      const totalCount = await prisma.contact.count({ where })

      const contacts = await prisma.contact.findMany({
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
          estValue: true,
          estEquity: true,
          createdAt: true,
          updatedAt: true,
          assignments: {
            where: { userId },
            select: {
              assignedAt: true,
              assignedBy: true
            }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ],
        take: limit,
        skip: offset
      })

      // Transform the data to match the expected Contact type
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
        propertyCounty: null, // Not selected in query
        estValue: contact.estValue,
        estEquity: contact.estEquity,
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
