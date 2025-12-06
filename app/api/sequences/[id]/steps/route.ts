import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SequenceStepType } from "@prisma/client"

// GET /api/sequences/[id]/steps - Get all steps for a sequence
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

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const steps = await prisma.sequenceStep.findMany({
      where: { sequenceId: id },
      orderBy: { orderIndex: "asc" },
    })

    return NextResponse.json({ steps })
  } catch (error) {
    console.error("Error fetching steps:", error)
    return NextResponse.json(
      { error: "Failed to fetch steps" },
      { status: 500 }
    )
  }
}

// POST /api/sequences/[id]/steps - Add a new step
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
    const body = await request.json()
    const { type, name, delayMinutes, config, orderIndex } = body

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    // Validate step type
    const validTypes: SequenceStepType[] = ["EMAIL", "SMS", "TASK", "VOICEMAIL_DROP", "AI_CALL"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid step type" }, { status: 400 })
    }

    // Get the next order index if not provided
    let nextOrderIndex = orderIndex
    if (nextOrderIndex === undefined) {
      const lastStep = await prisma.sequenceStep.findFirst({
        where: { sequenceId: id },
        orderBy: { orderIndex: "desc" },
      })
      nextOrderIndex = lastStep ? lastStep.orderIndex + 1 : 0
    }

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId: id,
        type,
        name: name?.trim() || null,
        delayMinutes: delayMinutes || 0,
        config: config || {},
        orderIndex: nextOrderIndex,
      },
    })

    return NextResponse.json({ step }, { status: 201 })
  } catch (error) {
    console.error("Error creating step:", error)
    return NextResponse.json(
      { error: "Failed to create step" },
      { status: 500 }
    )
  }
}

// PUT /api/sequences/[id]/steps - Reorder steps (bulk update)
export async function PUT(
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
    const { steps } = body // Array of { id, orderIndex }

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    // Update all step order indices in a transaction
    await prisma.$transaction(
      steps.map((step: { id: string; orderIndex: number }) =>
        prisma.sequenceStep.update({
          where: { id: step.id },
          data: { orderIndex: step.orderIndex },
        })
      )
    )

    // Fetch updated steps
    const updatedSteps = await prisma.sequenceStep.findMany({
      where: { sequenceId: id },
      orderBy: { orderIndex: "asc" },
    })

    return NextResponse.json({ steps: updatedSteps })
  } catch (error) {
    console.error("Error reordering steps:", error)
    return NextResponse.json(
      { error: "Failed to reorder steps" },
      { status: 500 }
    )
  }
}

