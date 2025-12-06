import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Get a single call campaign with details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaign = await prisma.callCampaign.findUnique({
      where: { id: params.id },
      include: {
        script: true,
        contacts: {
          where: {
            contact: {
              dnc: { not: true }, // Exclude DNC contacts
              deletedAt: null, // Exclude soft-deleted contacts
            }
          },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone1: true,
                phone2: true,
                propertyAddress: true,
                city: true,
                state: true,
                dnc: true,
              }
            }
          },
          orderBy: { addedAt: 'asc' }
        },
        _count: {
          select: { contacts: true }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Error fetching call campaign:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call campaign' },
      { status: 500 }
    )
  }
}

// PUT - Update a call campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, scriptId, dispositions, senderNumbers, pipelineId, status } = body

    // Check if campaign exists and is not running
    const existing = await prisma.callCampaign.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (existing.status === 'running' && status !== 'paused' && status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot modify a running campaign. Pause it first.' },
        { status: 400 }
      )
    }

    const campaign = await prisma.callCampaign.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(scriptId !== undefined && { scriptId }),
        ...(dispositions !== undefined && { dispositions }),
        ...(senderNumbers !== undefined && { senderNumbers }),
        ...(pipelineId !== undefined && { pipelineId }),
        ...(status !== undefined && { status }),
      },
      include: {
        script: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Error updating call campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update call campaign' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a call campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.callCampaign.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (existing.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete a running campaign. Stop it first.' },
        { status: 400 }
      )
    }

    // Delete campaign (contacts will cascade delete)
    await prisma.callCampaign.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting call campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete call campaign' },
      { status: 500 }
    )
  }
}

