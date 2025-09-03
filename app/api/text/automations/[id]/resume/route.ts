import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admins can control automations
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = params

    const automation = await prisma.textAutomation.findUnique({
      where: { id }
    })

    if (!automation) {
      return NextResponse.json(
        { error: 'Automation not found' },
        { status: 404 }
      )
    }

    if (automation.status !== 'paused') {
      return NextResponse.json(
        { error: 'Automation is not paused' },
        { status: 400 }
      )
    }

    // Calculate next run time based on where we left off
    const nextRunAt = new Date()

    await prisma.textAutomation.update({
      where: { id },
      data: {
        status: 'running',
        nextRunAt,
        pausedAt: null,
      }
    })

    // Trigger the automation processor
    await fetch(`${process.env.NEXTAUTH_URL}/api/text/automations/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automationId: id })
    }).catch(console.error)

    return NextResponse.json({
      success: true,
      message: 'Automation resumed successfully'
    })

  } catch (error) {
    console.error('Error resuming automation:', error)
    return NextResponse.json(
      { error: 'Failed to resume automation' },
      { status: 500 }
    )
  }
}
