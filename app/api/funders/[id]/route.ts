import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET a specific funder
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const funder = await prisma.funder.findUnique({
      where: { id: params.id },
    })

    if (!funder) {
      return NextResponse.json(
        { error: 'Funder not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ funder })
  } catch (error) {
    console.error('Error fetching funder:', error)
    return NextResponse.json(
      { error: 'Failed to fetch funder' },
      { status: 500 }
    )
  }
}

// PUT update a funder
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, description, requiredDocuments } = body

    const funder = await prisma.funder.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(requiredDocuments && { requiredDocuments }),
      },
    })

    return NextResponse.json({ funder })
  } catch (error) {
    console.error('Error updating funder:', error)
    return NextResponse.json(
      { error: 'Failed to update funder' },
      { status: 500 }
    )
  }
}

// DELETE a funder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.funder.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting funder:', error)
    return NextResponse.json(
      { error: 'Failed to delete funder' },
      { status: 500 }
    )
  }
}

