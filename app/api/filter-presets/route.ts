import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/filter-presets - Get all filter presets for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const presets = await prisma.filterPreset.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(presets)
  } catch (error) {
    console.error('Error fetching filter presets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filter presets' },
      { status: 500 }
    )
  }
}

// POST /api/filter-presets - Create a new filter preset
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, filters, isDefault } = body

    if (!name || !filters) {
      return NextResponse.json(
        { error: 'Name and filters are required' },
        { status: 400 }
      )
    }

    // If this preset is being set as default, unset any existing default
    if (isDefault) {
      await prisma.filterPreset.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    const preset = await prisma.filterPreset.create({
      data: {
        name,
        description,
        filters,
        userId: session.user.id,
        isDefault: isDefault || false
      }
    })

    return NextResponse.json(preset, { status: 201 })
  } catch (error) {
    console.error('Error creating filter preset:', error)
    return NextResponse.json(
      { error: 'Failed to create filter preset' },
      { status: 500 }
    )
  }
}

