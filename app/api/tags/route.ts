import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/tags - Get all tags with optional filtering and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeUsage = searchParams.get('includeUsage') === 'true'
    const includeSystem = searchParams.get('includeSystem') !== 'false' // default true
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'name' // name, usage, created_at
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}
    
    if (!includeSystem) {
      where.is_system = false
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Base query
    const baseQuery = {
      where,
      skip: offset,
      take: limit,
    }

    let tags
    if (includeUsage) {
      // Include usage count
      tags = await prisma.tag.findMany({
        ...baseQuery,
        include: {
          _count: {
            select: { contact_tags: true }
          }
        }
      })
    } else {
      tags = await prisma.tag.findMany(baseQuery)
    }

    // Sort results
    if (sortBy === 'usage' && includeUsage) {
      tags.sort((a: any, b: any) => {
        const aCount = a._count?.contact_tags || 0
        const bCount = b._count?.contact_tags || 0
        return sortOrder === 'desc' ? bCount - aCount : aCount - bCount
      })
    } else if (sortBy === 'created_at') {
      tags.sort((a, b) => {
        const aDate = new Date(a.created_at).getTime()
        const bDate = new Date(b.created_at).getTime()
        return sortOrder === 'desc' ? bDate - aDate : aDate - bDate
      })
    } else {
      // Default sort by name
      tags.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name)
        return sortOrder === 'desc' ? -comparison : comparison
      })
    }

    // Get total count for pagination
    const totalCount = await prisma.tag.count({ where })

    // Format response
    const formattedTags = tags.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      is_system: tag.is_system,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
      ...(includeUsage && { usage_count: tag._count?.contact_tags || 0 })
    }))

    return NextResponse.json({
      tags: formattedTags,
      pagination: {
        total: totalCount,
        offset,
        limit,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// POST /api/tags - Create new tag
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Allow all authenticated users to create tags
    // Team members can create tags for their contacts

    const body = await request.json()
    const { name, color, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      )
    }

    // Check if tag already exists
    const existing = await prisma.tag.findUnique({
      where: { name: name.trim() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 409 }
      )
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color || '#3B82F6',
        description: description?.trim() || null,
        is_system: false
      }
    })

    return NextResponse.json(tag, { status: 201 })

  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    )
  }
}

// PUT /api/tags - Bulk operations
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Team members cannot perform bulk operations
    if (session.user.role === 'TEAM_MEMBER') {
      return NextResponse.json(
        { error: 'Forbidden - Team members cannot perform bulk operations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { operation, tagIds, data } = body

    if (!operation || !Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'Operation and tagIds array are required' },
        { status: 400 }
      )
    }

    let result
    switch (operation) {
      case 'delete':
        // Prevent deletion of system tags
        const systemTags = await prisma.tag.findMany({
          where: { id: { in: tagIds }, is_system: true },
          select: { id: true, name: true }
        })

        if (systemTags.length > 0) {
          return NextResponse.json(
            { error: `Cannot delete system tags: ${systemTags.map(t => t.name).join(', ')}` },
            { status: 400 }
          )
        }

        result = await prisma.tag.deleteMany({
          where: { id: { in: tagIds }, is_system: false }
        })
        break

      case 'updateColor':
        if (!data?.color) {
          return NextResponse.json(
            { error: 'Color is required for updateColor operation' },
            { status: 400 }
          )
        }
        result = await prisma.tag.updateMany({
          where: { id: { in: tagIds } },
          data: { color: data.color }
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      affected: result.count,
      operation
    })

  } catch (error) {
    console.error('Error performing bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}
