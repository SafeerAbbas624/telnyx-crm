import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/email-blast/[id] - Get a specific email blast
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: params.id },
      include: {
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
      },
    })

    if (!blast) {
      return NextResponse.json(
        { error: 'Email blast not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ blast })
  } catch (error) {
    console.error('Error fetching email blast:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email blast' },
      { status: 500 }
    )
  }
}

// DELETE /api/email-blast/[id] - Delete a specific email blast
export async function DELETE(
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

    // Don't allow deletion of running blasts
    if (blast.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete a running blast. Stop it first.' },
        { status: 400 }
      )
    }

    await prisma.emailBlast.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Email blast deleted' })
  } catch (error) {
    console.error('Error deleting email blast:', error)
    return NextResponse.json(
      { error: 'Failed to delete email blast' },
      { status: 500 }
    )
  }
}

