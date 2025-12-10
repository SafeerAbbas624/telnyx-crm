import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Sync contacts with specified tags into the list
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
    
    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Check if list has tags to sync
    if (!list.syncTagIds || list.syncTagIds.length === 0) {
      return NextResponse.json({ 
        error: 'No tags configured for sync. Set syncTagIds first.' 
      }, { status: 400 })
    }

    // Find all contacts with the specified tags that are NOT DNC
    const contactsWithTags = await prisma.contact.findMany({
      where: {
        contact_tags: {
          some: {
            tag_id: { in: list.syncTagIds }
          }
        },
        dnc: false, // Exclude DNC contacts
        deletedAt: null, // Exclude soft-deleted contacts
        OR: [
          { phone1: { not: null } },
          { phone2: { not: null } },
          { phone3: { not: null } }
        ]
      },
      select: { id: true }
    })

    const contactIds = contactsWithTags.map(c => c.id)
    
    // Get existing contacts in list to avoid duplicates
    const existingContacts = await prisma.powerDialerListContact.findMany({
      where: { listId },
      select: { contactId: true }
    })
    const existingContactIds = new Set(existingContacts.map(c => c.contactId))
    
    // Filter out contacts already in list
    const newContactIds = contactIds.filter(id => !existingContactIds.has(id))

    // Add new contacts
    let addedCount = 0
    if (newContactIds.length > 0) {
      const result = await prisma.powerDialerListContact.createMany({
        data: newContactIds.map(contactId => ({
          listId,
          contactId,
          status: 'PENDING'
        })),
        skipDuplicates: true
      })
      addedCount = result.count
    }

    // Update total contacts count and lastSyncAt
    const totalContacts = await prisma.powerDialerListContact.count({
      where: { listId }
    })

    await prisma.powerDialerList.update({
      where: { id: listId },
      data: { 
        totalContacts,
        lastSyncAt: new Date()
      }
    })

    console.log(`[TAG SYNC] List ${list.name}: Found ${contactIds.length} contacts with tags, ${newContactIds.length} new, added ${addedCount}`)

    return NextResponse.json({
      success: true,
      totalTaggedContacts: contactIds.length,
      newContactsFound: newContactIds.length,
      addedCount,
      totalContacts,
      syncedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[TAG SYNC] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sync contacts' },
      { status: 500 }
    )
  }
}

// GET - Get sync status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const list = await prisma.powerDialerList.findUnique({
      where: { id: params.id },
      select: {
        syncTagIds: true,
        autoSync: true,
        lastSyncAt: true,
        syncIntervalMinutes: true,
        totalContacts: true
      }
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Get tag names for display
    const tags = list.syncTagIds.length > 0 
      ? await prisma.tag.findMany({
          where: { id: { in: list.syncTagIds } },
          select: { id: true, name: true, color: true }
        })
      : []

    return NextResponse.json({
      syncTagIds: list.syncTagIds,
      tags,
      autoSync: list.autoSync,
      lastSyncAt: list.lastSyncAt,
      syncIntervalMinutes: list.syncIntervalMinutes,
      totalContacts: list.totalContacts
    })
  } catch (error) {
    console.error('[TAG SYNC] Error getting status:', error)
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 })
  }
}

