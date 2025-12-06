import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/sequences/[id]/duplicate - Duplicate a sequence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get the original sequence with steps
    const original = await prisma.sequence.findFirst({
      where: {
        id,
        createdById: session.user.id,
      },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
        },
      },
    })

    if (!original) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    // Create the duplicate
    const duplicate = await prisma.sequence.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        pipelineId: original.pipelineId,
        createdById: session.user.id,
        isActive: false, // Always start as inactive
        steps: {
          create: original.steps.map((step) => ({
            orderIndex: step.orderIndex,
            type: step.type,
            name: step.name,
            delayMinutes: step.delayMinutes,
            config: step.config as any,
          })),
        },
      },
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

    return NextResponse.json({ sequence: duplicate }, { status: 201 })
  } catch (error) {
    console.error("Error duplicating sequence:", error)
    return NextResponse.json(
      { error: "Failed to duplicate sequence" },
      { status: 500 }
    )
  }
}

