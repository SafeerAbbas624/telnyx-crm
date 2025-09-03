import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// GET - List all text automations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admins can view all automations
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const automations = await prisma.textAutomation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            messages: true
          }
        }
      }
    })

    const formattedAutomations = automations.map(automation => ({
      id: automation.id,
      name: automation.name,
      message: automation.message,
      totalContacts: automation.totalContacts,
      currentCycle: automation.currentCycle,
      totalCycles: automation.totalCycles,
      isIndefinite: automation.isIndefinite,
      status: automation.status,
      messageDelay: automation.messageDelay,
      loopDelay: automation.loopDelay,
      loopDelayUnit: automation.loopDelayUnit,
      senderNumbers: automation.senderNumbers,
      selectedContacts: automation.selectedContacts,
      contactFilters: automation.contactFilters,
      currentIndex: automation.currentIndex,
      sentCount: automation.sentCount,
      deliveredCount: automation.deliveredCount,
      failedCount: automation.failedCount,
      nextRunAt: automation.nextRunAt?.toISOString(),
      startedAt: automation.startedAt?.toISOString(),
      lastRunAt: automation.lastRunAt?.toISOString(),
      createdAt: automation.createdAt.toISOString(),
      updatedAt: automation.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      automations: formattedAutomations
    })

  } catch (error) {
    console.error('Error fetching text automations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automations' },
      { status: 500 }
    )
  }
}

// POST - Create new text automation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admins can create automations
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      message,
      messageDelay,
      loopDelay,
      loopDelayUnit,
      isIndefinite,
      totalCycles,
      senderNumbers,
      selectedContacts,
      contactFilters,
      totalContacts
    } = body

    if (!message || !selectedContacts?.length || !senderNumbers?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate next run time (start immediately)
    const nextRunAt = new Date()

    const automation = await prisma.textAutomation.create({
      data: {
        name: name || `Automation ${new Date().toLocaleDateString()}`,
        message,
        totalContacts,
        currentCycle: 1,
        totalCycles: isIndefinite ? null : totalCycles,
        isIndefinite,
        status: 'running',
        messageDelay,
        loopDelay,
        loopDelayUnit,
        senderNumbers,
        selectedContacts,
        contactFilters,
        currentIndex: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        nextRunAt,
        startedAt: new Date(),
        createdBy: session.user.id,
      }
    })

    // Trigger the automation processor
    await fetch(`${process.env.NEXTAUTH_URL}/api/text/automations/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automationId: automation.id })
    }).catch(console.error)

    return NextResponse.json({
      success: true,
      automation: {
        id: automation.id,
        name: automation.name,
        status: automation.status,
        message: 'Automation created and started successfully'
      }
    })

  } catch (error) {
    console.error('Error creating text automation:', error)
    return NextResponse.json(
      { error: 'Failed to create automation' },
      { status: 500 }
    )
  }
}
