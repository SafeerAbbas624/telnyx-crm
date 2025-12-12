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

    // Get tag names for lists with syncTagIds
    const allTagIds = lists.flatMap(l => l.syncTagIds || [])
    const uniqueTagIds = [...new Set(allTagIds)]

    const tags = uniqueTagIds.length > 0
      ? await prisma.tag.findMany({
          where: { id: { in: uniqueTagIds } },
          select: { id: true, name: true, color: true }
        })
      : []

    const tagMap = new Map(tags.map(t => [t.id, t]))

    // Enrich lists with tag details
    const enrichedLists = lists.map(list => ({
      ...list,
      syncTags: (list.syncTagIds || []).map(id => tagMap.get(id)).filter(Boolean)
    }))

    return NextResponse.json(enrichedLists)
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
    const { name, description, contactIds, scriptId, syncTagIds, excludeTagIds, autoSync } = body

    console.log('[POWER DIALER LIST] Creating list:', {
      name,
      contactCount: contactIds?.length,
      scriptId,
      syncTagIds,
      excludeTagIds,
      autoSync
    })

    // Validate: need either contactIds OR syncTagIds
    const hasContacts = Array.isArray(contactIds) && contactIds.length > 0
    const hasTags = Array.isArray(syncTagIds) && syncTagIds.length > 0

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!hasContacts && !hasTags) {
      return NextResponse.json(
        { error: 'Either contacts or tags must be provided' },
        { status: 400 }
      )
    }

    // If tags provided, fetch matching contacts
    let finalContactIds = hasContacts ? contactIds : []
    const hasExcludeTags = Array.isArray(excludeTagIds) && excludeTagIds.length > 0

    if (hasTags) {
      // Build where clause with include AND exclude tag filters
      const whereClause: any = {
        contact_tags: {
          some: {
            tag_id: { in: syncTagIds }
          }
        },
        dnc: false,
        deletedAt: null,
        OR: [
          { phone1: { not: null } },
          { phone2: { not: null } },
          { phone3: { not: null } }
        ]
      }

      // Add exclusion for contacts with ANY of the exclude tags
      if (hasExcludeTags) {
        whereClause.NOT = {
          contact_tags: {
            some: {
              tag_id: { in: excludeTagIds }
            }
          }
        }
        console.log(`[POWER DIALER LIST] Excluding contacts with tags:`, excludeTagIds)
      }

      const contactsWithTags = await prisma.contact.findMany({
        where: whereClause,
        select: { id: true }
      })

      // Merge with any manually added contacts, remove duplicates
      const tagContactIds = contactsWithTags.map(c => c.id)
      const allIds = [...new Set([...finalContactIds, ...tagContactIds])]
      finalContactIds = allIds

      console.log(`[POWER DIALER LIST] Found ${tagContactIds.length} contacts with specified tags (after exclusions)`)
    }

    if (finalContactIds.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found with the specified criteria' },
        { status: 400 }
      )
    }

    console.log('[POWER DIALER LIST] Creating list in database...')
    // Create list with tag sync settings
    const list = await prisma.powerDialerList.create({
      data: {
        userId: session.user.id,
        name,
        description,
        scriptId: scriptId || null,
        totalContacts: finalContactIds.length,
        status: 'ACTIVE',
        syncTagIds: hasTags ? syncTagIds : [],
        autoSync: hasTags ? (autoSync ?? true) : false, // Default to true if tags provided
        lastSyncAt: hasTags ? new Date() : null,
      }
    })

    console.log('[POWER DIALER LIST] List created:', { listId: list.id })

    console.log('[POWER DIALER LIST] Adding contacts to list...')
    // Add contacts to list
    const listContacts = await prisma.powerDialerListContact.createMany({
      data: finalContactIds.map((contactId: string) => ({
        listId: list.id,
        contactId,
        status: 'PENDING',
      }))
    })

    console.log('[POWER DIALER LIST] Contacts added:', { count: listContacts.count })

    return NextResponse.json({
      list,
      addedCount: listContacts.count,
      syncEnabled: hasTags && (autoSync ?? true),
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

