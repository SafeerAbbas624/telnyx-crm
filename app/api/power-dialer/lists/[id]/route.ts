import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET - Get specific list with all contacts
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

    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId },
      include: {
        script: {
          select: {
            id: true,
            name: true,
            content: true,
          }
        },
        contacts: {
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
              }
            }
          }
        }
      }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    return NextResponse.json(list)
  } catch (error) {
    console.error('Error fetching power dialer list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    )
  }
}

// PATCH - Update list (name, description, status)
export async function PATCH(
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
    const { name, description, status, scriptId, syncTagIds, excludeTagIds, autoSync, sessionState, resetContacts, resyncContacts } = body

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (scriptId !== undefined) updateData.scriptId = scriptId // Save script association
    if (sessionState !== undefined) updateData.sessionState = sessionState // Save session state for persistence
    if (syncTagIds !== undefined) updateData.syncTagIds = syncTagIds
    if (excludeTagIds !== undefined) updateData.excludeTagIds = excludeTagIds
    if (autoSync !== undefined) updateData.autoSync = autoSync
    if (status !== undefined) {
      updateData.status = status
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
      }
    }

    // Reset all contacts in the list to PENDING and clear lastCalledAt
    if (resetContacts === true) {
      await prisma.powerDialerListContact.updateMany({
        where: { listId },
        data: {
          status: 'PENDING',
          disposition: null,
          lastCalledAt: null,
          attemptCount: 0,
        }
      })
      console.log(`[PowerDialer] Reset all contacts in list ${listId} to PENDING`)
    }

    // Resync contacts from tags if requested
    if (resyncContacts === true && syncTagIds && syncTagIds.length > 0) {
      // Get contacts matching the tags
      const whereClause: any = {
        userId: session.user.id,
        contact_tags: {
          some: {
            tag_id: { in: syncTagIds }
          }
        }
      }

      // Exclude contacts with excluded tags
      if (excludeTagIds && excludeTagIds.length > 0) {
        whereClause.NOT = {
          contact_tags: {
            some: {
              tag_id: { in: excludeTagIds }
            }
          }
        }
      }

      const matchingContacts = await prisma.contact.findMany({
        where: whereClause,
        select: { id: true }
      })

      const contactIds = matchingContacts.map(c => c.id)

      // Get existing contacts in the list
      const existingEntries = await prisma.powerDialerListContact.findMany({
        where: { listId },
        select: { contactId: true }
      })
      const existingContactIds = new Set(existingEntries.map(e => e.contactId))

      // Add new contacts that aren't already in the list
      const newContactIds = contactIds.filter(id => !existingContactIds.has(id))

      if (newContactIds.length > 0) {
        await prisma.powerDialerListContact.createMany({
          data: newContactIds.map(contactId => ({
            listId,
            contactId,
            status: 'PENDING',
          })),
          skipDuplicates: true,
        })
      }

      // Update total contacts count
      const totalContacts = await prisma.powerDialerListContact.count({
        where: { listId }
      })
      updateData.totalContacts = totalContacts
      updateData.lastSyncAt = new Date()

      console.log(`[PowerDialer] Resynced list ${listId}: added ${newContactIds.length} new contacts, total: ${totalContacts}`)
    }

    const updatedList = await prisma.powerDialerList.update({
      where: { id: listId },
      data: updateData,
      include: {
        script: {
          select: {
            id: true,
            name: true,
            content: true,
          }
        }
      }
    })

    return NextResponse.json(updatedList)
  } catch (error) {
    console.error('Error updating power dialer list:', error)
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    )
  }
}

// DELETE - Delete list
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

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Delete list
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

