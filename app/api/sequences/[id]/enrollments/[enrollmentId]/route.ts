import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SequenceStatus } from "@prisma/client"

// GET /api/sequences/[id]/enrollments/[enrollmentId] - Get a single enrollment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, enrollmentId } = await params

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, sequenceId: id },
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
        logs: {
          orderBy: { executedAt: "desc" },
          include: {
            step: {
              select: {
                id: true,
                type: true,
                name: true,
                orderIndex: true,
              },
            },
          },
        },
      },
    })

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    return NextResponse.json({ enrollment })
  } catch (error) {
    console.error("Error fetching enrollment:", error)
    return NextResponse.json(
      { error: "Failed to fetch enrollment" },
      { status: 500 }
    )
  }
}

// PATCH /api/sequences/[id]/enrollments/[enrollmentId] - Update enrollment (pause/resume/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, enrollmentId } = await params
    const body = await request.json()
    const { action, reason } = body

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, sequenceId: id },
    })

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })
    }

    let updateData: any = {}

    switch (action) {
      case "pause":
        if (enrollment.status !== "ACTIVE") {
          return NextResponse.json(
            { error: "Can only pause active enrollments" },
            { status: 400 }
          )
        }
        updateData = {
          status: "PAUSED" as SequenceStatus,
          pauseReason: reason || "Manually paused",
        }
        break

      case "resume":
        if (enrollment.status !== "PAUSED") {
          return NextResponse.json(
            { error: "Can only resume paused enrollments" },
            { status: 400 }
          )
        }
        updateData = {
          status: "ACTIVE" as SequenceStatus,
          pauseReason: null,
        }
        break

      case "cancel":
        if (enrollment.status === "COMPLETED" || enrollment.status === "CANCELED") {
          return NextResponse.json(
            { error: "Cannot cancel completed or already canceled enrollments" },
            { status: 400 }
          )
        }
        updateData = {
          status: "CANCELED" as SequenceStatus,
          cancelReason: reason || "Manually canceled",
          completedAt: new Date(),
        }
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const updated = await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({ enrollment: updated })
  } catch (error) {
    console.error("Error updating enrollment:", error)
    return NextResponse.json(
      { error: "Failed to update enrollment" },
      { status: 500 }
    )
  }
}

