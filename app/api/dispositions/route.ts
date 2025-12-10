import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/dispositions
 * List all call dispositions with their actions
 */
export async function GET() {
  try {
    const dispositions = await prisma.callDisposition.findMany({
      where: { isActive: true },
      include: {
        actions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json(dispositions)
  } catch (error) {
    console.error('[Dispositions API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dispositions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dispositions
 * Create a new disposition
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, color, icon, actions } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Get highest sort order
    const maxOrder = await prisma.callDisposition.aggregate({
      _max: { sortOrder: true }
    })

    const disposition = await prisma.callDisposition.create({
      data: {
        name,
        description,
        color: color || '#6b7280',
        icon,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        actions: actions?.length > 0 ? {
          create: actions.map((action: { actionType: string; config: Record<string, unknown> }, index: number) => ({
            actionType: action.actionType,
            config: action.config || {},
            sortOrder: index
          }))
        } : undefined
      },
      include: {
        actions: true
      }
    })

    return NextResponse.json(disposition)
  } catch (error) {
    console.error('[Dispositions API] Error creating:', error)
    return NextResponse.json(
      { error: 'Failed to create disposition' },
      { status: 500 }
    )
  }
}

