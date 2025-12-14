import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const bulkTagSchema = z.object({
  contactIds: z.array(z.string().uuid()),
  operation: z.enum(['add', 'remove', 'replace']),
  tagIds: z.array(z.string().uuid()).optional(),
  tagNames: z.array(z.string()).optional(),
})

// POST /api/contacts/bulk-tags - Bulk tag operations on contacts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = bulkTagSchema.parse(body)

    const { contactIds, operation, tagIds = [], tagNames = [] } = validatedData

    // For team members, verify they have access to all contacts
    if (session.user.role === 'TEAM_USER') {
      const assignedContacts = await prisma.contactAssignment.findMany({
        where: {
          userId: session.user.id,
          contactId: { in: contactIds }
        },
        select: { contactId: true }
      })

      const assignedContactIds = assignedContacts.map(ac => ac.contactId)
      const unauthorizedContacts = contactIds.filter(id => !assignedContactIds.includes(id))

      if (unauthorizedContacts.length > 0) {
        return NextResponse.json(
          { error: 'Forbidden - Some contacts not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Resolve tag names to IDs
    const allTagIds = new Set(tagIds)
    
    if (tagNames.length > 0) {
      const existingTags = await prisma.tag.findMany({
        where: { name: { in: tagNames } },
        select: { id: true, name: true }
      })

      const existingTagNames = existingTags.map(t => t.name)
      const newTagNames = tagNames.filter(name => !existingTagNames.includes(name))

      // Create new tags
      if (newTagNames.length > 0) {
        const newTags = await prisma.tag.createMany({
          data: newTagNames.map(name => ({ name })),
          skipDuplicates: true
        })

        // Get the created tags
        const createdTags = await prisma.tag.findMany({
          where: { name: { in: newTagNames } },
          select: { id: true }
        })

        createdTags.forEach(tag => allTagIds.add(tag.id))
      }

      existingTags.forEach(tag => allTagIds.add(tag.id))
    }

    const finalTagIds = Array.from(allTagIds)

    // Get tag names for history logging
    const tagNameMap = new Map<string, string>()
    if (finalTagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: finalTagIds } },
        select: { id: true, name: true }
      })
      tags.forEach(t => tagNameMap.set(t.id, t.name))
    }

    // Perform bulk operations
    switch (operation) {
      case 'add':
        // Add tags to contacts (skip duplicates)
        if (finalTagIds.length > 0) {
          const associations = []
          const historyRecords = []
          for (const contactId of contactIds) {
            for (const tagId of finalTagIds) {
              associations.push({
                contact_id: contactId,
                tag_id: tagId,
                created_by: session.user.id
              })
              historyRecords.push({
                contact_id: contactId,
                tag_id: tagId,
                tag_name: tagNameMap.get(tagId) || 'Unknown',
                action: 'added',
                created_by: session.user.id
              })
            }
          }

          await prisma.contactTag.createMany({
            data: associations,
            skipDuplicates: true
          })
          await prisma.contactTagHistory.createMany({
            data: historyRecords
          })
        }
        break

      case 'remove':
        // Remove tags from contacts
        if (finalTagIds.length > 0) {
          await prisma.contactTag.deleteMany({
            where: {
              contact_id: { in: contactIds },
              tag_id: { in: finalTagIds }
            }
          })
          // Log removals to history
          const historyRecords = []
          for (const contactId of contactIds) {
            for (const tagId of finalTagIds) {
              historyRecords.push({
                contact_id: contactId,
                tag_id: tagId,
                tag_name: tagNameMap.get(tagId) || 'Unknown',
                action: 'removed',
                created_by: session.user.id
              })
            }
          }
          await prisma.contactTagHistory.createMany({
            data: historyRecords
          })
        }
        break

      case 'replace':
        // Replace all tags on contacts
        // Get existing tags for history logging
        const existingTags = await prisma.contactTag.findMany({
          where: { contact_id: { in: contactIds } },
          include: { tag: { select: { name: true } } }
        })

        // First remove all existing tags
        await prisma.contactTag.deleteMany({
          where: { contact_id: { in: contactIds } }
        })

        // Log removals
        if (existingTags.length > 0) {
          await prisma.contactTagHistory.createMany({
            data: existingTags.map(et => ({
              contact_id: et.contact_id,
              tag_id: et.tag_id,
              tag_name: et.tag.name,
              action: 'removed',
              created_by: session.user.id
            }))
          })
        }

        // Then add new tags
        if (finalTagIds.length > 0) {
          const associations = []
          const historyRecords = []
          for (const contactId of contactIds) {
            for (const tagId of finalTagIds) {
              associations.push({
                contact_id: contactId,
                tag_id: tagId,
                created_by: session.user.id
              })
              historyRecords.push({
                contact_id: contactId,
                tag_id: tagId,
                tag_name: tagNameMap.get(tagId) || 'Unknown',
                action: 'added',
                created_by: session.user.id
              })
            }
          }

          await prisma.contactTag.createMany({
            data: associations,
            skipDuplicates: true
          })
          await prisma.contactTagHistory.createMany({
            data: historyRecords
          })
        }
        break
    }

    // Update Elasticsearch for affected contacts
    try {
      const updatedContacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        include: {
          contact_tags: {
            include: {
              tag: { select: { name: true } }
            }
          }
        }
      })

      // Update search index (simplified - in production you'd want proper error handling)
      for (const contact of updatedContacts) {
        const tagNames = contact.contact_tags.map(ct => ct.tag.name)
        // Update Elasticsearch document with new tags
        // This would be implemented based on your search setup
      }
    } catch (searchError) {
      console.error('Failed to update search index:', searchError)
      // Don't fail the request if search update fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${operation}ed tags for ${contactIds.length} contacts`,
      affectedContacts: contactIds.length,
      processedTags: finalTagIds.length
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error in bulk tag operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk tag operation' },
      { status: 500 }
    )
  }
}
