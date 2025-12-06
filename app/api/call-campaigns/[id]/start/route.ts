import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Start a call campaign
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { forceStart } = body

    // Check if campaign exists
    const campaign = await prisma.callCampaign.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'running') {
      return NextResponse.json(
        { error: 'Campaign is already running' },
        { status: 400 }
      )
    }

    if (campaign.status === 'completed') {
      return NextResponse.json(
        { error: 'Campaign is already completed' },
        { status: 400 }
      )
    }

    if (campaign._count.contacts === 0) {
      return NextResponse.json(
        { error: 'Cannot start campaign with no contacts' },
        { status: 400 }
      )
    }

    // Check for other running campaigns (unless forceStart)
    if (!forceStart) {
      const runningCampaign = await prisma.callCampaign.findFirst({
        where: {
          status: 'running',
          id: { not: params.id }
        },
        select: { id: true, name: true }
      })

      if (runningCampaign) {
        return NextResponse.json({
          error: 'Another campaign is already running',
          requiresConfirmation: true,
          runningCampaign
        }, { status: 409 })
      }
    }

    // Start the campaign
    const updatedCampaign = await prisma.callCampaign.update({
      where: { id: params.id },
      data: {
        status: 'running',
        startedAt: campaign.startedAt || new Date(),
        pausedAt: null,
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
    console.error('Error starting call campaign:', error)
    return NextResponse.json(
      { error: 'Failed to start call campaign' },
      { status: 500 }
    )
  }
}

