import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/sequences/[id]/enrollments - Get all enrollments for a sequence
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
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Verify ownership
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const where: any = { sequenceId: id }
    if (status) {
      where.status = status
    }

    const [enrollments, total] = await Promise.all([
      prisma.sequenceEnrollment.findMany({
        where,
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
            take: 5,
            include: {
              step: {
                select: {
                  id: true,
                  type: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.sequenceEnrollment.count({ where }),
    ])

    return NextResponse.json({ enrollments, total })
  } catch (error) {
    console.error("Error fetching enrollments:", error)
    return NextResponse.json(
      { error: "Failed to fetch enrollments" },
      { status: 500 }
    )
  }
}

// POST /api/sequences/[id]/enrollments - Enroll contacts in a sequence
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
    const { contactIds } = body

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "Contact IDs are required" },
        { status: 400 }
      )
    }

    // Verify ownership and get sequence with steps
    const sequence = await prisma.sequence.findFirst({
      where: { id, createdById: session.user.id },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
          take: 1,
        },
      },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    if (sequence.steps.length === 0) {
      return NextResponse.json(
        { error: "Cannot enroll contacts in a sequence with no steps" },
        { status: 400 }
      )
    }

    // Get existing active enrollments to avoid duplicates
    const existingEnrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        sequenceId: id,
        contactId: { in: contactIds },
        status: "ACTIVE",
      },
      select: { contactId: true },
    })

    const existingContactIds = new Set(existingEnrollments.map((e) => e.contactId))
    const newContactIds = contactIds.filter((cid: string) => !existingContactIds.has(cid))

    if (newContactIds.length === 0) {
      return NextResponse.json({
        message: "All contacts are already enrolled in this sequence",
        enrolled: 0,
        skipped: contactIds.length,
      })
    }

    // Calculate when the first step should execute
    const firstStepDelay = sequence.steps[0].delayMinutes
    const nextStepAt = new Date(Date.now() + firstStepDelay * 60 * 1000)

    // Create enrollments
    const enrollments = await prisma.sequenceEnrollment.createMany({
      data: newContactIds.map((contactId: string) => ({
        sequenceId: id,
        contactId,
        enrolledById: session.user.id,
        status: "ACTIVE",
        currentStepIndex: 0,
        nextStepAt,
      })),
    })

    return NextResponse.json({
      message: `Successfully enrolled ${enrollments.count} contacts`,
      enrolled: enrollments.count,
      skipped: contactIds.length - newContactIds.length,
    }, { status: 201 })
  } catch (error) {
    console.error("Error enrolling contacts:", error)
    return NextResponse.json(
      { error: "Failed to enroll contacts" },
      { status: 500 }
    )
  }
}

