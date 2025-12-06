import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET - List all call lists for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sort = searchParams.get('sort') || 'lastWorkedOn'

    const where: any = { userId: session.user.id }
    if (status) where.status = status

    const orderBy: any = {}
    if (sort === 'lastWorkedOn') {
      orderBy.lastWorkedOn = 'desc'
    } else if (sort === 'created') {
      orderBy.createdAt = 'desc'
    } else if (sort === 'name') {
      orderBy.name = 'asc'
    }

    const lists = await prisma.powerDialerList.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: {
            contacts: true,
            sessions: true,
          }
        },
        script: {
          select: {
            id: true,
            name: true,
            content: true,
          }
        }
      }
    })

    return NextResponse.json(lists)
  } catch (error) {
    console.error('Error fetching power dialer lists:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lists' },
      { status: 500 }
    )
  }
}

// POST - Create new call list
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, contactIds, scriptId } = body

    console.log('[POWER DIALER LIST] Creating list:', { name, contactCount: contactIds?.length, scriptId })

    if (!name || !Array.isArray(contactIds)) {
      console.error('[POWER DIALER LIST] Validation failed:', { name, isArray: Array.isArray(contactIds) })
      return NextResponse.json(
        { error: 'Name and contact IDs are required' },
        { status: 400 }
      )
    }

    if (contactIds.length === 0) {
      console.error('[POWER DIALER LIST] No contacts provided')
      return NextResponse.json(
        { error: 'At least one contact is required' },
        { status: 400 }
      )
    }

    console.log('[POWER DIALER LIST] Creating list in database...')
    // Create list
    const list = await prisma.powerDialerList.create({
      data: {
        userId: session.user.id,
        name,
        description,
        scriptId: scriptId || null,
        totalContacts: contactIds.length,
        status: 'ACTIVE',
      }
    })

    console.log('[POWER DIALER LIST] List created:', { listId: list.id })

    console.log('[POWER DIALER LIST] Adding contacts to list...')
    // Add contacts to list
    const listContacts = await prisma.powerDialerListContact.createMany({
      data: contactIds.map((contactId: string) => ({
        listId: list.id,
        contactId,
        status: 'PENDING',
      }))
    })

    console.log('[POWER DIALER LIST] Contacts added:', { count: listContacts.count })

    return NextResponse.json({
      list,
      addedCount: listContacts.count,
    })
  } catch (error) {
    console.error('[POWER DIALER LIST] Error creating list:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create list: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// DELETE - Delete call list
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const listId = searchParams.get('listId')

    if (!listId) {
      return NextResponse.json(
        { error: 'List ID is required' },
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

    // Delete list (cascade will delete contacts and sessions)
    await prisma.powerDialerList.delete({
      where: { id: listId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting power dialer list:', error)
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    )
  }
}

