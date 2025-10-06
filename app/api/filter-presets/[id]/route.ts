import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/filter-presets/[id] - Get a specific filter preset
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preset = await prisma.filterPreset.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json(preset)
  } catch (error) {
    console.error('Error fetching filter preset:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filter preset' },
      { status: 500 }
    )
  }
}

// PATCH /api/filter-presets/[id] - Update a filter preset
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, filters, isDefault } = body

    // Verify ownership
    const existingPreset = await prisma.filterPreset.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingPreset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    // If this preset is being set as default, unset any existing default
    if (isDefault && !existingPreset.isDefault) {
      await prisma.filterPreset.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true,
          id: { not: params.id }
        },
        data: {
          isDefault: false
        }
      })
    }

    const preset = await prisma.filterPreset.update({
      where: {
        id: params.id
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(filters !== undefined && { filters }),
        ...(isDefault !== undefined && { isDefault })
      }
    })

    return NextResponse.json(preset)
  } catch (error) {
    console.error('Error updating filter preset:', error)
    return NextResponse.json(
      { error: 'Failed to update filter preset' },
      { status: 500 }
    )
  }
}

// DELETE /api/filter-presets/[id] - Delete a filter preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existingPreset = await prisma.filterPreset.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingPreset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    await prisma.filterPreset.delete({
      where: {
        id: params.id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting filter preset:', error)
    return NextResponse.json(
      { error: 'Failed to delete filter preset' },
      { status: 500 }
    )
  }
}

