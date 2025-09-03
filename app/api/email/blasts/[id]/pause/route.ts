import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Pausing email blast:', id)

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
      where: { id }
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

    // Check if blast can be paused
    if (blast.status !== 'running') {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot pause blast with status: ${blast.status}`
        },
        { status: 400 }
      )
    }

    // Update blast status to paused
    const updatedBlast = await prisma.emailBlast.update({
      where: { id },
      data: {
        status: 'paused',
      }
    })

    console.log('Email blast paused:', updatedBlast.id)

    return NextResponse.json({
      success: true,
      blast: {
        id: updatedBlast.id,
        name: updatedBlast.name,
        status: updatedBlast.status,
      },
      message: 'Email blast paused successfully'
    })
  } catch (error) {
    console.error('Error pausing email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to pause email blast'
      },
      { status: 500 }
    )
  }
}

// Resume endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Resuming email blast:', id)

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
      where: { id }
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

    // Check if blast can be resumed
    if (blast.status !== 'paused') {
      return NextResponse.json(
        { 
          success: false,
          message: `Cannot resume blast with status: ${blast.status}`
        },
        { status: 400 }
      )
    }

    // Update blast status to running
    const updatedBlast = await prisma.emailBlast.update({
      where: { id },
      data: {
        status: 'running',
      }
    })

    console.log('Email blast resumed:', updatedBlast.id)

    return NextResponse.json({
      success: true,
      blast: {
        id: updatedBlast.id,
        name: updatedBlast.name,
        status: updatedBlast.status,
      },
      message: 'Email blast resumed successfully'
    })
  } catch (error) {
    console.error('Error resuming email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to resume email blast'
      },
      { status: 500 }
    )
  }
}
