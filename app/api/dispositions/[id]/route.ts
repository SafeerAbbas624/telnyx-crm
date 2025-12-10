import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/dispositions/[id]
 * Get a single disposition with actions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const disposition = await prisma.callDisposition.findUnique({
      where: { id },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!disposition) {
      return NextResponse.json(
        { error: 'Disposition not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(disposition)
  } catch (error) {
    console.error('[Disposition API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch disposition' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/dispositions/[id]
 * Update a disposition and its actions
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, color, icon, isActive, sortOrder, actions } = body

    // Update disposition
    const disposition = await prisma.callDisposition.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder })
      }
    })

    // Update actions if provided
    if (actions !== undefined) {
      // Delete existing actions
      await prisma.callDispositionAction.deleteMany({
        where: { dispositionId: id }
      })

      // Create new actions
      if (actions.length > 0) {
        await prisma.callDispositionAction.createMany({
          data: actions.map((action: { actionType: string; config: Record<string, unknown>; isActive?: boolean }, index: number) => ({
            dispositionId: id,
            actionType: action.actionType,
            config: action.config || {},
            sortOrder: index,
            isActive: action.isActive !== false
          }))
        })
      }
    }

    // Return updated disposition with actions
    const updated = await prisma.callDisposition.findUnique({
      where: { id },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[Disposition API] Error updating:', error)
    return NextResponse.json(
      { error: 'Failed to update disposition' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dispositions/[id]
 * Soft delete a disposition (set isActive = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const disposition = await prisma.callDisposition.findUnique({
      where: { id }
    })

    if (!disposition) {
      return NextResponse.json(
        { error: 'Disposition not found' },
        { status: 404 }
      )
    }

    if (disposition.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default disposition' },
        { status: 400 }
      )
    }

    // Soft delete
    await prisma.callDisposition.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Disposition API] Error deleting:', error)
    return NextResponse.json(
      { error: 'Failed to delete disposition' },
      { status: 500 }
    )
  }
}

