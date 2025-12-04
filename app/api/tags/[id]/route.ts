import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/tags/[id] - Get single tag with usage details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeContacts = searchParams.get('includeContacts') === 'true'
    const contactsLimit = parseInt(searchParams.get('contactsLimit') || '10')

    let tag
    if (includeContacts) {
      tag = await prisma.tag.findUnique({
        where: { id },
        include: {
          contact_tags: {
            take: contactsLimit,
            include: {
              contact: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone1: true,
                  email1: true,
                  dealStatus: true,
                  createdAt: true
                }
              }
            },
            orderBy: { created_at: 'desc' }
          },
          _count: {
            select: { contact_tags: true }
          }
        }
      })
    } else {
      tag = await prisma.tag.findUnique({
        where: { id },
        include: {
          _count: {
            select: { contact_tags: true }
          }
        }
      })
    }

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      )
    }

    // Format response
    const formattedTag = {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      is_system: tag.is_system,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
      usage_count: tag._count.contact_tags,
      ...(includeContacts && {
        recent_contacts: tag.contact_tags.map((ct: any) => ({
          ...ct.contact,
          tagged_at: ct.created_at
        }))
      })
    }

    return NextResponse.json(formattedTag)

  } catch (error) {
    console.error('Error fetching tag:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tag' },
      { status: 500 }
    )
  }
}

// PATCH /api/tags/[id] - Update tag
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Team members cannot update tags
    if (session.user.role === 'TEAM_USER') {
      return NextResponse.json(
        { error: 'Forbidden - Team members cannot update tags' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, color, description } = body

    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id }
    })

    if (!existingTag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      )
    }

    // Prevent modification of system tags (except color and description)
    if (existingTag.is_system && name && name !== existingTag.name) {
      return NextResponse.json(
        { error: 'Cannot rename system tags' },
        { status: 400 }
      )
    }

    // Check for name conflicts if name is being changed
    if (name && name !== existingTag.name) {
      const nameConflict = await prisma.tag.findUnique({
        where: { name: name.trim() }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Tag with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (name && !existingTag.is_system) updateData.name = name.trim()
    if (color) updateData.color = color
    if (description !== undefined) updateData.description = description?.trim() || null

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(updatedTag)

  } catch (error) {
    console.error('Error updating tag:', error)
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    )
  }
}

// DELETE /api/tags/[id] - Delete tag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Team members cannot delete tags
    if (session.user.role === 'TEAM_USER') {
      return NextResponse.json(
        { error: 'Forbidden - Team members cannot delete tags' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if tag exists and is not a system tag
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { contact_tags: true }
        }
      }
    })

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      )
    }

    if (tag.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system tags' },
        { status: 400 }
      )
    }

    // Delete the tag (cascade will handle contact_tags)
    await prisma.tag.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: `Tag "${tag.name}" deleted successfully`,
      contacts_affected: tag._count.contact_tags
    })

  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    )
  }
}
