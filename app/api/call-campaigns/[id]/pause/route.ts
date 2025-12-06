import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Pause a call campaign
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if campaign exists
    const campaign = await prisma.callCampaign.findUnique({
      where: { id: params.id }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'running') {
      return NextResponse.json(
        { error: 'Campaign is not running' },
        { status: 400 }
      )
    }

    // Pause the campaign
    const updatedCampaign = await prisma.callCampaign.update({
      where: { id: params.id },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
      include: {
        script: {
          select: { id: true, name: true }
        },
        _count: {
          select: { contacts: true }
        }
      }
    })

    return NextResponse.json({ campaign: updatedCampaign })
  } catch (error) {
    console.error('Error pausing call campaign:', error)
    return NextResponse.json(
      { error: 'Failed to pause call campaign' },
      { status: 500 }
    )
  }
}

