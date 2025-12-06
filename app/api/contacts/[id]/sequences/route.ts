import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/contacts/[id]/sequences - Get all sequence enrollments for a contact
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

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: { contactId: id },
      include: {
        sequence: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            _count: {
              select: {
                steps: true,
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    })

    return NextResponse.json({ enrollments })
  } catch (error) {
    console.error("Error fetching contact sequences:", error)
    return NextResponse.json(
      { error: "Failed to fetch contact sequences" },
      { status: 500 }
    )
  }
}

