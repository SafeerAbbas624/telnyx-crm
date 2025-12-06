import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - List all call campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pipelineId = searchParams.get('pipelineId')
    const status = searchParams.get('status')
    const checkRunning = searchParams.get('checkRunning') === 'true'

    // If just checking for running campaigns
    if (checkRunning) {
      const runningCampaign = await prisma.callCampaign.findFirst({
        where: { status: 'running' },
        select: { id: true, name: true }
      })
      return NextResponse.json({ hasRunning: !!runningCampaign, runningCampaign })
    }

    const where: any = {}
    if (pipelineId) where.pipelineId = pipelineId
    if (status) where.status = status

    const campaigns = await prisma.callCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        script: {
          select: { id: true, name: true }
        },
        _count: {
          select: { contacts: true }
        }
      }
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching call campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call campaigns' },
      { status: 500 }
    )
  }
}

// POST - Create a new call campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, scriptId, dispositions, senderNumbers, pipelineId, startNow } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (!senderNumbers || senderNumbers.length === 0) {
      return NextResponse.json(
        { error: 'At least one sender number is required' },
        { status: 400 }
      )
    }

    // Default dispositions if not provided
    const defaultDispositions = [
      'Interested',
      'Not Interested',
      'Callback',
      'Wrong Number',
      'No Answer',
      'Voicemail',
      'Do Not Call'
    ]

    const campaign = await prisma.callCampaign.create({
      data: {
        name,
        description,
        scriptId: scriptId || null,
        dispositions: dispositions || defaultDispositions,
        senderNumbers,
        pipelineId: pipelineId || null,
        status: startNow ? 'pending' : 'draft',
      },
      include: {
        script: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Error creating call campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create call campaign' },
      { status: 500 }
    )
  }
}

