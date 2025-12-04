import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/tags/suggestions - Get tag suggestions for a contact
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const query = searchParams.get('query') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    let suggestions: any[] = []

    if (contactId) {
      // Get suggestions based on contact data
      suggestions = await getContactBasedSuggestions(contactId, limit)
    } else if (query) {
      // Get suggestions based on search query
      suggestions = await getQueryBasedSuggestions(query, limit)
    } else {
      // Get popular tags
      suggestions = await getPopularTags(limit)
    }

    return NextResponse.json({
      suggestions,
      query,
      contactId
    })

  } catch (error) {
    console.error('Error fetching tag suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tag suggestions' },
      { status: 500 }
    )
  }
}

// Get suggestions based on contact data
async function getContactBasedSuggestions(contactId: string, limit: number) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      contact_tags: {
        include: { tag: true }
      }
    }
  })

  if (!contact) {
    return []
  }

  const existingTagIds = contact.contact_tags.map(ct => ct.tag.id)
  const suggestions = []

  // 1. Suggest based on deal status
  if (contact.dealStatus) {
    const statusBasedTags = await prisma.tag.findMany({
      where: {
        id: { notIn: existingTagIds },
        contact_tags: {
          some: {
            contact: {
              dealStatus: contact.dealStatus
            }
          }
        }
      },
      include: {
        _count: {
          select: { contact_tags: true }
        }
      },
      orderBy: {
        contact_tags: {
          _count: 'desc'
        }
      },
      take: 3
    })

    suggestions.push(...statusBasedTags.map(tag => ({
      ...tag,
      reason: `Popular with ${contact.dealStatus} contacts`,
      confidence: 0.8
    })))
  }

  // 2. Suggest based on location
  if (contact.city && contact.state) {
    const locationBasedTags = await prisma.tag.findMany({
      where: {
        id: { notIn: existingTagIds },
        contact_tags: {
          some: {
            contact: {
              city: contact.city,
              state: contact.state
            }
          }
        }
      },
      include: {
        _count: {
          select: { contact_tags: true }
        }
      },
      orderBy: {
        contact_tags: {
          _count: 'desc'
        }
      },
      take: 2
    })

    suggestions.push(...locationBasedTags.map(tag => ({
      ...tag,
      reason: `Popular in ${contact.city}, ${contact.state}`,
      confidence: 0.7
    })))
  }

  // 3. Suggest based on property type
  if (contact.propertyType) {
    const propertyBasedTags = await prisma.tag.findMany({
      where: {
        id: { notIn: existingTagIds },
        contact_tags: {
          some: {
            contact: {
              propertyType: contact.propertyType
            }
          }
        }
      },
      include: {
        _count: {
          select: { contact_tags: true }
        }
      },
      orderBy: {
        contact_tags: {
          _count: 'desc'
        }
      },
      take: 2
    })

    suggestions.push(...propertyBasedTags.map(tag => ({
      ...tag,
      reason: `Popular with ${contact.propertyType} properties`,
      confidence: 0.6
    })))
  }

  // 4. Suggest based on similar contacts (contacts with overlapping tags)
  if (existingTagIds.length > 0) {
    const similarContactTags = await prisma.tag.findMany({
      where: {
        id: { notIn: existingTagIds },
        contact_tags: {
          some: {
            contact: {
              contact_tags: {
                some: {
                  tag_id: { in: existingTagIds }
                }
              }
            }
          }
        }
      },
      include: {
        _count: {
          select: { contact_tags: true }
        }
      },
      orderBy: {
        contact_tags: {
          _count: 'desc'
        }
      },
      take: 3
    })

    suggestions.push(...similarContactTags.map(tag => ({
      ...tag,
      reason: 'Used by similar contacts',
      confidence: 0.5
    })))
  }

  // Remove duplicates and sort by confidence
  const uniqueSuggestions = suggestions
    .filter((tag, index, self) => 
      index === self.findIndex(t => t.id === tag.id)
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)

  return uniqueSuggestions
}

// Get suggestions based on search query
async function getQueryBasedSuggestions(query: string, limit: number) {
  const tags = await prisma.tag.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    },
    include: {
      _count: {
        select: { contact_tags: true }
      }
    },
    orderBy: [
      { contact_tags: { _count: 'desc' } },
      { name: 'asc' }
    ],
    take: limit
  })

  return tags.map(tag => ({
    ...tag,
    reason: 'Matches search query',
    confidence: tag.name.toLowerCase().startsWith(query.toLowerCase()) ? 0.9 : 0.7
  }))
}

// Get popular tags
async function getPopularTags(limit: number) {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { contact_tags: true }
      }
    },
    orderBy: {
      contact_tags: {
        _count: 'desc'
      }
    },
    take: limit
  })

  return tags.map(tag => ({
    ...tag,
    reason: 'Popular tag',
    confidence: 0.4
  }))
}

// POST /api/tags/suggestions - Create smart tags based on contact data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Team members cannot create smart tags
    if (session.user.role === 'TEAM_USER') {
      return NextResponse.json(
        { error: 'Forbidden - Team members cannot create smart tags' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { contactId, autoApply = false } = body

    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const smartTags = []

    // Generate smart tags based on contact data
    if (contact.estValue && contact.estValue > 500000) {
      smartTags.push({ name: 'High Value Property', color: '#10B981' })
    }

    if (contact.city && contact.state) {
      smartTags.push({ name: `${contact.state} Lead`, color: '#3B82F6' })
    }

    if (contact.propertyType) {
      smartTags.push({ name: contact.propertyType, color: '#8B5CF6' })
    }

    // Create tags if they don't exist
    const createdTags = []
    for (const tagData of smartTags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagData.name },
        update: {},
        create: tagData
      })
      createdTags.push(tag)

      // Auto-apply if requested
      if (autoApply) {
        await prisma.contactTag.upsert({
          where: {
            contact_id_tag_id: {
              contact_id: contactId,
              tag_id: tag.id
            }
          },
          update: {},
          create: {
            contact_id: contactId,
            tag_id: tag.id
          }
        })
      }
    }

    return NextResponse.json({
      smart_tags: createdTags,
      auto_applied: autoApply,
      contact_id: contactId
    })

  } catch (error) {
    console.error('Error creating smart tags:', error)
    return NextResponse.json(
      { error: 'Failed to create smart tags' },
      { status: 500 }
    )
  }
}
