import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Starting email blast:', id)

    // Check if EmailBlast model exists
    if (!prisma.emailBlast) {
      return NextResponse.json(
        { 
          success: false,
          message: 'EmailBlast model not available'
        },
        { status: 400 }
      )
    }

    // Get the blast
    const blast = await prisma.emailBlast.findUnique({
      where: { id },
      include: {
        emailAccount: true,
      }
    })

    if (!blast) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Email blast not found'
        },
        { status: 404 }
      )
    }

    // Check if blast can be started
    if (blast.status !== 'draft' && blast.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot start blast with status: ${blast.status}`
        },
        { status: 400 }
      )
    }

    // Update blast status to running
    const updatedBlast = await prisma.emailBlast.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: new Date(),
      }
    })

    console.log('Email blast started:', updatedBlast.id)

    // TODO: Implement actual email sending logic here
    // This would typically involve:
    // 1. Getting recipient list
    // 2. Queuing emails for sending
    // 3. Processing emails with delays
    // 4. Updating counts and status

    return NextResponse.json({
      success: true,
      blast: {
        id: updatedBlast.id,
        name: updatedBlast.name,
        status: updatedBlast.status,
        startedAt: updatedBlast.startedAt?.toISOString(),
      },
      message: 'Email blast started successfully'
    })
  } catch (error) {
    console.error('Error starting email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to start email blast'
      },
      { status: 500 }
    )
  }
}
