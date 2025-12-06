import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/sequences/[id] - Get a single sequence with all details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const sequence = await prisma.sequence.findFirst({
      where: {
        id,
        createdById: session.user.id,
      },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
        },
        enrollments: {
          include: {
            contact: {
              select: {
                id: true,
                fullName: true,
                firstName: true,
                lastName: true,
                email1: true,
                phone1: true,
              },
            },
          },
          orderBy: { enrolledAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            steps: true,
            enrollments: true,
          },
        },
      },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    return NextResponse.json({ sequence })
  } catch (error) {
    console.error("Error fetching sequence:", error)
    return NextResponse.json(
      { error: "Failed to fetch sequence" },
      { status: 500 }
    )
  }
}

// PATCH /api/sequences/[id] - Update a sequence
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, isActive, pipelineId } = body

    // Verify ownership
    const existing = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (pipelineId !== undefined) updateData.pipelineId = pipelineId || null

    const sequence = await prisma.sequence.update({
      where: { id },
      data: updateData,
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
        },
        _count: {
          select: {
            steps: true,
            enrollments: true,
          },
        },
      },
    })

    return NextResponse.json({ sequence })
  } catch (error) {
    console.error("Error updating sequence:", error)
    return NextResponse.json(
      { error: "Failed to update sequence" },
      { status: 500 }
    )
  }
}

// DELETE /api/sequences/[id] - Delete a sequence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existing = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    // Delete sequence (cascades to steps, enrollments, logs)
    await prisma.sequence.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sequence:", error)
    return NextResponse.json(
      { error: "Failed to delete sequence" },
      { status: 500 }
    )
  }
}

