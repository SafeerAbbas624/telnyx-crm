import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

// GET - Get specific list with all contacts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listId = params.id

    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId },
      include: {
        script: {
          select: {
            id: true,
            name: true,
            content: true,
          }
        },
        contacts: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone1: true,
                phone2: true,
                phone3: true,
              }
            }
          }
        }
      }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    return NextResponse.json(list)
  } catch (error) {
    console.error('Error fetching power dialer list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    )
  }
}

// PATCH - Update list (name, description, status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listId = params.id
    const body = await request.json()
    const { name, description, status, scriptId } = body

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (scriptId !== undefined) updateData.scriptId = scriptId // Save script association
    if (status !== undefined) {
      updateData.status = status
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
      }
    }

    const updatedList = await prisma.powerDialerList.update({
      where: { id: listId },
      data: updateData,
    })

    return NextResponse.json(updatedList)
  } catch (error) {
    console.error('Error updating power dialer list:', error)
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    )
  }
}

// DELETE - Delete list
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const listId = params.id

    // Verify ownership
    const list = await prisma.powerDialerList.findUnique({
      where: { id: listId }
    })

    if (!list || list.userId !== session.user.id) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    // Delete list
    await prisma.powerDialerList.delete({
      where: { id: listId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting power dialer list:', error)
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    )
  }
}

