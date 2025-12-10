import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - Sync all auto-sync enabled power dialer lists
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify internal API key
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.INTERNAL_API_KEY
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all lists with autoSync enabled
    const listsToSync = await prisma.powerDialerList.findMany({
      where: {
        autoSync: true,
        status: 'ACTIVE', // Only sync active lists
        syncTagIds: { isEmpty: false } // Must have at least one tag
      },
      select: {
        id: true,
        name: true,
        syncTagIds: true,
        lastSyncAt: true,
        syncIntervalMinutes: true
      }
    })

    if (listsToSync.length === 0) {
      return NextResponse.json({ message: 'No lists to sync', processed: 0 })
    }

    let totalAdded = 0
    let listsProcessed = 0

    for (const list of listsToSync) {
      // Check if sync interval has passed
      if (list.lastSyncAt) {
        const intervalMs = (list.syncIntervalMinutes || 1) * 60 * 1000
        const nextSyncAt = new Date(list.lastSyncAt).getTime() + intervalMs
        if (Date.now() < nextSyncAt) {
          continue // Skip, not time yet
        }
      }

      // Find contacts with matching tags
      const contactsWithTags = await prisma.contact.findMany({
        where: {
          contact_tags: {
            some: {
              tag_id: { in: list.syncTagIds }
            }
          },
          dnc: false,
          deletedAt: null,
          OR: [
            { phone1: { not: null } },
            { phone2: { not: null } },
            { phone3: { not: null } }
          ]
        },
        select: { id: true }
      })

      const contactIds = contactsWithTags.map(c => c.id)

      // Get existing contacts in list
      const existingContacts = await prisma.powerDialerListContact.findMany({
        where: { listId: list.id },
        select: { contactId: true }
      })
      const existingContactIds = new Set(existingContacts.map(c => c.contactId))

      // Filter out contacts already in list
      const newContactIds = contactIds.filter(id => !existingContactIds.has(id))

      // Add new contacts
      if (newContactIds.length > 0) {
        const result = await prisma.powerDialerListContact.createMany({
          data: newContactIds.map(contactId => ({
            listId: list.id,
            contactId,
            status: 'PENDING'
          })),
          skipDuplicates: true
        })
        totalAdded += result.count
        console.log(`[TAG SYNC] List "${list.name}": Added ${result.count} new contacts`)
      }

      // Update total contacts count and lastSyncAt
      const totalContacts = await prisma.powerDialerListContact.count({
        where: { listId: list.id }
      })

      await prisma.powerDialerList.update({
        where: { id: list.id },
        data: {
          totalContacts,
          lastSyncAt: new Date()
        }
      })

      listsProcessed++
    }

    return NextResponse.json({
      success: true,
      listsChecked: listsToSync.length,
      listsProcessed,
      totalAdded
    })
  } catch (error) {
    console.error('[TAG SYNC CRON] Error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

