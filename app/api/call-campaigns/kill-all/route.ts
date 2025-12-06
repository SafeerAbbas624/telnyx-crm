import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/call-campaigns/kill-all - Stop all running call campaigns
export async function POST() {
  try {
    // Update all active campaigns to cancelled
    // Status options: draft, pending, running, paused, completed, cancelled
    const result = await prisma.callCampaign.updateMany({
      where: {
        status: {
          in: ['running', 'pending', 'paused']
        }
      },
      data: {
        status: 'cancelled',
        pausedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Stopped ${result.count} call campaign(s)`,
      cancelledCount: result.count,
    })
  } catch (error) {
    console.error('Error killing all call campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to stop call campaigns', cancelledCount: 0 },
      { status: 500 }
    )
  }
}

// GET /api/call-campaigns/kill-all - Get count of running campaigns (for status check)
export async function GET() {
  try {
    const [running, pending, paused] = await Promise.all([
      prisma.callCampaign.count({ where: { status: 'running' } }),
      prisma.callCampaign.count({ where: { status: 'pending' } }),
      prisma.callCampaign.count({ where: { status: 'paused' } }),
    ])

    return NextResponse.json({
      running,
      pending,
      paused,
      total: running + pending + paused,
      hasActiveCampaigns: running + pending + paused > 0,
    })
  } catch (error) {
    console.error('Error checking active campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to check active campaigns' },
      { status: 500 }
    )
  }
}

