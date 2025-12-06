import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SequenceStepType } from "@prisma/client"

// GET /api/sequences/[id]/steps/[stepId] - Get a single step
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, stepId } = await params

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const step = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId: id },
    })

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 })
    }

    return NextResponse.json({ step })
  } catch (error) {
    console.error("Error fetching step:", error)
    return NextResponse.json(
      { error: "Failed to fetch step" },
      { status: 500 }
    )
  }
}

// PATCH /api/sequences/[id]/steps/[stepId] - Update a step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, stepId } = await params
    const body = await request.json()
    const { type, name, delayMinutes, config } = body

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const existing = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 })
    }

    const updateData: any = {}
    
    if (type !== undefined) {
      const validTypes: SequenceStepType[] = ["EMAIL", "SMS", "TASK", "VOICEMAIL_DROP", "AI_CALL"]
      if (!validTypes.includes(type)) {
        return NextResponse.json({ error: "Invalid step type" }, { status: 400 })
      }
      updateData.type = type
    }
    
    if (name !== undefined) updateData.name = name?.trim() || null
    if (delayMinutes !== undefined) updateData.delayMinutes = delayMinutes
    if (config !== undefined) updateData.config = config

    const step = await prisma.sequenceStep.update({
      where: { id: stepId },
      data: updateData,
    })

    return NextResponse.json({ step })
  } catch (error) {
    console.error("Error updating step:", error)
    return NextResponse.json(
      { error: "Failed to update step" },
      { status: 500 }
    )
  }
}

// DELETE /api/sequences/[id]/steps/[stepId] - Delete a step
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, stepId } = await params

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const existing = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 })
    }

    // Delete the step
    await prisma.sequenceStep.delete({
      where: { id: stepId },
    })

    // Reorder remaining steps
    const remainingSteps = await prisma.sequenceStep.findMany({
      where: { sequenceId: id },
      orderBy: { orderIndex: "asc" },
    })

    await prisma.$transaction(
      remainingSteps.map((step, index) =>
        prisma.sequenceStep.update({
          where: { id: step.id },
          data: { orderIndex: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting step:", error)
    return NextResponse.json(
      { error: "Failed to delete step" },
      { status: 500 }
    )
  }
}

