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

    if (automation.status !== 'running') {
      return NextResponse.json(
        { error: 'Automation is not running' },
        { status: 400 }
      )
    }

    await prisma.textAutomation.update({
      where: { id },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Automation paused successfully'
    })

  } catch (error) {
    console.error('Error pausing automation:', error)
    return NextResponse.json(
      { error: 'Failed to pause automation' },
      { status: 500 }
    )
  }
}
