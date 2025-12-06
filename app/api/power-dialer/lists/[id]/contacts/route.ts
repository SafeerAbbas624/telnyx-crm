import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET - Get contacts in list with pagination
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listId = params.id
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const where: any = { listId }
    if (status) where.status = status

    const skip = (page - 1) * limit

    const [contacts, total] = await Promise.all([
      prisma.powerDialerListContact.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone1: true,
              phone2: true,
              phone3: true,
              email1: true,
              propertyAddress: true,
              city: true,
              state: true,
              dnc: true,
            }
          }
        },
        skip,
        take: limit,
        orderBy: { addedAt: 'desc' }
      }),
      prisma.powerDialerListContact.count({ where })
    ])

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Error fetching list contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

// POST - Add contacts to list
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listId = params.id
    const body = await request.json()
    const { contactIds } = body

    if (!Array.isArray(contactIds)) {
      return NextResponse.json(
        { error: 'Contact IDs array is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Add contacts (skip duplicates)
    const result = await prisma.powerDialerListContact.createMany({
      data: contactIds.map((contactId: string) => ({
        listId,
        contactId,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    })

    // Update list total contacts count
    const totalContacts = await prisma.powerDialerListContact.count({
      where: { listId }
    })

    await prisma.powerDialerList.update({
      where: { id: listId },
      data: { totalContacts }
    })

    return NextResponse.json({
      addedCount: result.count,
      totalContacts,
    })
  } catch (error) {
    console.error('Error adding contacts to list:', error)
    return NextResponse.json(
      { error: 'Failed to add contacts' },
      { status: 500 }
    )
  }
}

// DELETE - Remove contact from list
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listId = params.id
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Delete contact from list
    await prisma.powerDialerListContact.delete({
      where: {
        listId_contactId: {
          listId,
          contactId,
        }
      }
    })

    // Update list total contacts count
    const totalContacts = await prisma.powerDialerListContact.count({
      where: { listId }
    })

    await prisma.powerDialerList.update({
      where: { id: listId },
      data: { totalContacts }
    })

    return NextResponse.json({ success: true, totalContacts })
  } catch (error) {
    console.error('Error removing contact from list:', error)
    return NextResponse.json(
      { error: 'Failed to remove contact' },
      { status: 500 }
    )
  }
}

