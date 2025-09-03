import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
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

    return NextResponse.json({ blast })
  } catch (error) {
    console.error('Error fetching text blast:', error)
    return NextResponse.json(
      { error: 'Failed to fetch text blast' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      status,
      sentCount,
      deliveredCount,
      failedCount,
      currentIndex,
      isPaused,
      startedAt,
      completedAt,
      pausedAt,
      resumedAt,
    } = body

    const updateData: any = {}
    
    if (status !== undefined) updateData.status = status
    if (sentCount !== undefined) updateData.sentCount = sentCount
    if (deliveredCount !== undefined) updateData.deliveredCount = deliveredCount
    if (failedCount !== undefined) updateData.failedCount = failedCount
    if (currentIndex !== undefined) updateData.currentIndex = currentIndex
    if (isPaused !== undefined) updateData.isPaused = isPaused
    if (startedAt !== undefined) updateData.startedAt = startedAt ? new Date(startedAt) : null
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null
    if (pausedAt !== undefined) updateData.pausedAt = pausedAt ? new Date(pausedAt) : null
    if (resumedAt !== undefined) updateData.resumedAt = resumedAt ? new Date(resumedAt) : null

    const blast = await prisma.textBlast.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ blast })
  } catch (error) {
    console.error('Error updating text blast:', error)
    return NextResponse.json(
      { error: 'Failed to update text blast' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.textBlast.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting text blast:', error)
    return NextResponse.json(
      { error: 'Failed to delete text blast' },
      { status: 500 }
    )
  }
}
