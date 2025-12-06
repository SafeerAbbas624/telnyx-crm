import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') // Optional status filter
    const checkRunning = searchParams.get('checkRunning') === 'true' // Check if any blast is running

    // If checking for running blasts only
    if (checkRunning) {
      const runningBlast = await prisma.textBlast.findFirst({
        where: { status: 'running' },
        select: { id: true, name: true, sentCount: true, totalContacts: true },
      })
      return NextResponse.json({
        hasRunning: !!runningBlast,
        runningBlast
      })
    }

    const where = status ? { status: status as any } : {}

    const blasts = await prisma.textBlast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100), // Max 100
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    // Calculate progress percentage for each blast
    const blastsWithProgress = blasts.map(blast => ({
      ...blast,
      progress: blast.totalContacts > 0
        ? Math.round((blast.sentCount + blast.failedCount) / blast.totalContacts * 100)
        : 0,
    }))

    return NextResponse.json({ blasts: blastsWithProgress })
  } catch (error) {
    console.error('Error fetching text blasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch text blasts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const {
      name,
      message,
      selectedContacts,
      senderNumbers,
      delaySeconds,
      contactFilters,
      startNow = false, // New parameter to determine immediate start
    } = body

    if (!message || !selectedContacts?.length || !senderNumbers?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if trying to start immediately while another blast is running
    if (startNow) {
      const runningBlast = await prisma.textBlast.findFirst({
        where: { status: 'running' },
        select: { id: true, name: true },
      })

      if (runningBlast) {
        return NextResponse.json({
          error: 'Another text blast is already running',
          runningBlast,
          requiresConfirmation: true,
        }, { status: 409 }) // 409 Conflict
      }
    }

    const blast = await prisma.textBlast.create({
      data: {
        name: name || `Text Blast ${new Date().toLocaleString()}`,
        message,
        totalContacts: selectedContacts.length,
        senderNumbers: JSON.stringify(senderNumbers),
        delaySeconds: delaySeconds || 1,
        contactFilters: contactFilters ? JSON.stringify(contactFilters) : null,
        selectedContacts: JSON.stringify(selectedContacts.map((c: any) => c.id)),
        status: startNow ? 'pending' : 'draft', // Draft if saving for later
        createdBy: session?.user?.id || null,
      },
    })

    return NextResponse.json({ blast })
  } catch (error) {
    console.error('Error creating text blast:', error)
    return NextResponse.json(
      { error: 'Failed to create text blast' },
      { status: 500 }
    )
  }
}
