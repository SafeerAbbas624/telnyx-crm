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

    // Can cancel blasts that are running, paused, or pending
    if (!['running', 'paused', 'pending'].includes(blast.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a blast with status: ${blast.status}` },
        { status: 400 }
      )
    }

    const updatedBlast = await prisma.textBlast.update({
      where: { id: params.id },
      data: {
        status: 'cancelled',
        isPaused: true,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ 
      blast: updatedBlast,
      message: 'Text blast cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling text blast:', error)
    return NextResponse.json(
      { error: 'Failed to cancel text blast' },
      { status: 500 }
    )
  }
}

