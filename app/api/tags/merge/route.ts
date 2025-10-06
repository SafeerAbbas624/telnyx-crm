import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string().uuid()).min(2, 'At least 2 tags required for merging'),
  targetTagId: z.string().uuid(),
  newName: z.string().optional(),
  newColor: z.string().optional(),
  newDescription: z.string().optional(),
})

// POST /api/tags/merge - Merge multiple tags into one
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admins can merge tags
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = mergeTagsSchema.parse(body)

    const { sourceTagIds, targetTagId, newName, newColor, newDescription } = validatedData

    // Verify all tags exist and get their details
    const allTagIds = [...sourceTagIds, targetTagId]
    const tags = await prisma.tag.findMany({
      where: { id: { in: allTagIds } },
      include: {
        contact_tags: { select: { contact_id: true } },
        activity_tags: { select: { activity_id: true } }
      }
    })

    if (tags.length !== allTagIds.length) {
      return NextResponse.json(
        { error: 'One or more tags not found' },
        { status: 404 }
      )
    }

    const targetTag = tags.find(t => t.id === targetTagId)
    const sourceTags = tags.filter(t => sourceTagIds.includes(t.id))

    if (!targetTag) {
      return NextResponse.json(
        { error: 'Target tag not found' },
        { status: 404 }
      )
    }

    // Check for system tags
    const systemTags = tags.filter(t => t.is_system)
    if (systemTags.length > 0) {
      return NextResponse.json(
        { error: `Cannot merge system tags: ${systemTags.map(t => t.name).join(', ')}` },
        { status: 400 }
      )
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Collect all contact and activity associations from source tags
      const contactIds = new Set<string>()
      const activityIds = new Set<string>()

      sourceTags.forEach(tag => {
        tag.contact_tags.forEach(ct => contactIds.add(ct.contact_id))
        tag.activity_tags.forEach(at => activityIds.add(at.activity_id))
      })

      // Get existing associations for target tag
      const existingContactAssociations = await tx.contactTag.findMany({
        where: { tag_id: targetTagId },
        select: { contact_id: true }
      })

      const existingActivityAssociations = await tx.activityTag.findMany({
        where: { tag_id: targetTagId },
        select: { activity_id: true }
      })

      const existingContactIds = new Set(existingContactAssociations.map(ca => ca.contact_id))
      const existingActivityIds = new Set(existingActivityAssociations.map(aa => aa.activity_id))

      // Create new associations for contacts that don't already have the target tag
      const newContactAssociations = Array.from(contactIds)
        .filter(contactId => !existingContactIds.has(contactId))
        .map(contactId => ({
          contact_id: contactId,
          tag_id: targetTagId,
          created_by: session.user.id
        }))

      const newActivityAssociations = Array.from(activityIds)
        .filter(activityId => !existingActivityIds.has(activityId))
        .map(activityId => ({
          activity_id: activityId,
          tag_id: targetTagId,
          created_by: session.user.id
        }))

      // Create new associations
      if (newContactAssociations.length > 0) {
        await tx.contactTag.createMany({
          data: newContactAssociations,
          skipDuplicates: true
        })
      }

      if (newActivityAssociations.length > 0) {
        await tx.activityTag.createMany({
          data: newActivityAssociations,
          skipDuplicates: true
        })
      }

      // Update target tag if new properties provided
      const updateData: any = {}
      if (newName) updateData.name = newName
      if (newColor) updateData.color = newColor
      if (newDescription !== undefined) updateData.description = newDescription

      let updatedTargetTag = targetTag
      if (Object.keys(updateData).length > 0) {
        updatedTargetTag = await tx.tag.update({
          where: { id: targetTagId },
          data: updateData
        })
      }

      // Delete source tag associations
      await tx.contactTag.deleteMany({
        where: { tag_id: { in: sourceTagIds } }
      })

      await tx.activityTag.deleteMany({
        where: { tag_id: { in: sourceTagIds } }
      })

      // Delete source tags
      await tx.tag.deleteMany({
        where: { id: { in: sourceTagIds } }
      })

      return {
        targetTag: updatedTargetTag,
        mergedTags: sourceTags.map(t => ({ id: t.id, name: t.name })),
        contactsAffected: contactIds.size,
        activitiesAffected: activityIds.size,
        newAssociationsCreated: newContactAssociations.length + newActivityAssociations.length
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${sourceTags.length} tags into "${result.targetTag.name}"`,
      result
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error merging tags:', error)
    return NextResponse.json(
      { error: 'Failed to merge tags' },
      { status: 500 }
    )
  }
}

// GET /api/tags/merge/suggestions - Get suggestions for duplicate tags that could be merged
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find potential duplicate tags based on similar names
    const tags = await prisma.tag.findMany({
      where: { is_system: { not: true } },
      select: { id: true, name: true, color: true, description: true },
      orderBy: { name: 'asc' }
    })

    const suggestions = []
    const processed = new Set<string>()

    for (let i = 0; i < tags.length; i++) {
      if (processed.has(tags[i].id)) continue

      const currentTag = tags[i]
      const similarTags = []

      for (let j = i + 1; j < tags.length; j++) {
        if (processed.has(tags[j].id)) continue

        const otherTag = tags[j]
        
        // Check for similar names (case-insensitive, ignoring spaces and punctuation)
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
        const currentNormalized = normalize(currentTag.name)
        const otherNormalized = normalize(otherTag.name)

        // Exact match after normalization
        if (currentNormalized === otherNormalized) {
          similarTags.push(otherTag)
          processed.add(otherTag.id)
        }
        // Very similar (Levenshtein distance <= 2 for names > 3 chars)
        else if (currentTag.name.length > 3 && otherTag.name.length > 3) {
          const distance = levenshteinDistance(currentNormalized, otherNormalized)
          if (distance <= 2) {
            similarTags.push(otherTag)
            processed.add(otherTag.id)
          }
        }
      }

      if (similarTags.length > 0) {
        suggestions.push({
          group: [currentTag, ...similarTags],
          reason: 'Similar names detected',
          confidence: similarTags.length === 1 ? 'high' : 'medium'
        })
        processed.add(currentTag.id)
      }
    }

    return NextResponse.json({ suggestions })

  } catch (error) {
    console.error('Error getting merge suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to get merge suggestions' },
      { status: 500 }
    )
  }
}

// Simple Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}
