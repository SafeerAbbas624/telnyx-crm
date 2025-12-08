import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: params.id },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Email blast not found' },
        { status: 404 }
      )
    }

    if (blast.status !== 'running') {
      return NextResponse.json(
        { error: 'Email blast is not running' },
        { status: 400 }
      )
    }

    const updatedBlast = await prisma.emailBlast.update({
      where: { id: params.id },
      data: {
        status: 'paused',
        isPaused: true,
        pausedAt: new Date(),
      },
    })

    return NextResponse.json({ blast: updatedBlast })
  } catch (error) {
    console.error('Error pausing email blast:', error)
    return NextResponse.json(
      { error: 'Failed to pause email blast' },
      { status: 500 }
    )
  }
}

