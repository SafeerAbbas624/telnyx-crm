import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/sequences - List all sequences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pipelineId = searchParams.get("pipelineId")
    const isActive = searchParams.get("isActive")

    const where: any = {
      createdById: session.user.id,
    }

    if (pipelineId) {
      where.pipelineId = pipelineId
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true"
    }

    const sequences = await prisma.sequence.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            type: true,
            name: true,
            orderIndex: true,
            delayMinutes: true,
          },
        },
        enrollments: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            steps: true,
            enrollments: true,
          },
        },
      },
    })

    return NextResponse.json({ sequences })
  } catch (error) {
    console.error("Error fetching sequences:", error)
    return NextResponse.json(
      { error: "Failed to fetch sequences" },
      { status: 500 }
    )
  }
}

// POST /api/sequences - Create a new sequence
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, pipelineId } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Sequence name is required" },
        { status: 400 }
      )
    }

    const sequence = await prisma.sequence.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        pipelineId: pipelineId || null,
        createdById: session.user.id,
        isActive: false, // Start as inactive until steps are added
      },
      include: {
        steps: true,
        _count: {
          select: {
            steps: true,
            enrollments: true,
          },
        },
      },
    })

    return NextResponse.json({ sequence }, { status: 201 })
  } catch (error) {
    console.error("Error creating sequence:", error)
    return NextResponse.json(
      { error: "Failed to create sequence" },
      { status: 500 }
    )
  }
}

