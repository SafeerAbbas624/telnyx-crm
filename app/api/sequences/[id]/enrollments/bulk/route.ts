import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SequenceStatus } from "@prisma/client"

// POST /api/sequences/[id]/enrollments/bulk - Bulk enroll contacts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sequenceId } = await params
    const body = await request.json()
    const { contactIds, tagId } = body

    // Verify sequence exists
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
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

    // Get contacts to enroll
    let contacts: { id: string }[] = []

    if (contactIds && Array.isArray(contactIds)) {
      contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true },
      })
    } else if (tagId) {
      // Enroll all contacts with a specific tag
      const contactTags = await prisma.contactTag.findMany({
        where: { tag_id: tagId },
        select: { contact_id: true },
      })
      contacts = contactTags.map((ct) => ({ id: ct.contact_id }))
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: "No contacts to enroll" }, { status: 400 })
    }

    // Get existing active enrollments to avoid duplicates
    const existingEnrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        sequenceId,
        contactId: { in: contacts.map((c) => c.id) },
        status: "ACTIVE",
      },
      select: { contactId: true },
    })

    const existingContactIds = new Set(existingEnrollments.map((e) => e.contactId))
    const newContacts = contacts.filter((c) => !existingContactIds.has(c.id))

    if (newContacts.length === 0) {
      return NextResponse.json({
        enrolled: 0,
        skipped: contacts.length,
        message: "All contacts are already enrolled in this sequence",
      })
    }

    // Calculate first step delay
    const firstStep = sequence.steps[0]
    const nextStepAt = firstStep
      ? new Date(Date.now() + firstStep.delayMinutes * 60 * 1000)
      : new Date()

    // Create enrollments
    const enrollments = await prisma.sequenceEnrollment.createMany({
      data: newContacts.map((contact) => ({
        sequenceId,
        contactId: contact.id,
        enrolledById: session.user.id,
        status: "ACTIVE" as SequenceStatus,
        currentStepIndex: 0,
        nextStepAt,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      enrolled: enrollments.count,
      skipped: contacts.length - newContacts.length,
      message: `Successfully enrolled ${enrollments.count} contacts`,
    })
  } catch (error: any) {
    console.error("Error bulk enrolling contacts:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/sequences/[id]/enrollments/bulk - Bulk update enrollments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sequenceId } = await params
    const body = await request.json()
    const { action, enrollmentIds, contactIds } = body

    // Build where clause
    const whereClause: any = { sequenceId }
    
    if (enrollmentIds && Array.isArray(enrollmentIds)) {
      whereClause.id = { in: enrollmentIds }
    } else if (contactIds && Array.isArray(contactIds)) {
      whereClause.contactId = { in: contactIds }
    }

    let updateData: any = {}
    let statusFilter: SequenceStatus | undefined

    switch (action) {
      case "pause":
        statusFilter = "ACTIVE"
        updateData = { status: "PAUSED", pauseReason: "Bulk paused by user" }
        break
      case "resume":
        statusFilter = "PAUSED"
        updateData = { status: "ACTIVE", pauseReason: null, nextStepAt: new Date() }
        break
      case "cancel":
        updateData = { status: "CANCELED" }
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (statusFilter) {
      whereClause.status = statusFilter
    }

    const result = await prisma.sequenceEnrollment.updateMany({
      where: whereClause,
      data: updateData,
    })

    return NextResponse.json({
      updated: result.count,
      action,
    })
  } catch (error: any) {
    console.error("Error bulk updating enrollments:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

