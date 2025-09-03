import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blast = await prisma.textBlast.findUnique({
      where: { id: params.id },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Text blast not found' },
        { status: 404 }
      )
    }

    if (blast.status !== 'running') {
      return NextResponse.json(
        { error: 'Text blast is not running' },
        { status: 400 }
      )
    }

    const updatedBlast = await prisma.textBlast.update({
      where: { id: params.id },
      data: {
        status: 'paused',
        isPaused: true,
        pausedAt: new Date(),
      },
    })

    return NextResponse.json({ blast: updatedBlast })
  } catch (error) {
    console.error('Error pausing text blast:', error)
    return NextResponse.json(
      { error: 'Failed to pause text blast' },
      { status: 500 }
    )
  }
}
