import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/sequences/[id]/logs - Get activity logs for a sequence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sequenceId } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "50")

    // Verify sequence exists and belongs to user
    const sequence = await prisma.sequence.findFirst({
      where: {
        id: sequenceId,
        createdById: session.user.id,
      },
    })

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    // Get logs for this sequence
    const logs = await prisma.sequenceLog.findMany({
      where: {
        enrollment: {
          sequenceId,
        },
      },
      orderBy: { executedAt: "desc" },
      take: limit,
      include: {
        step: {
          select: {
            id: true,
            type: true,
            name: true,
          },
        },
        enrollment: {
          select: {
            id: true,
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error("Error fetching sequence logs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

