import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Fetching email blast:', id)

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

    const blast = await prisma.emailBlast.findUnique({
      where: { id },
      include: {
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          }
        },
        messages: {
          select: {
            id: true,
            status: true,
          }
        }
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

    return NextResponse.json({
      success: true,
      blast: {
        id: blast.id,
        name: blast.name,
        subject: blast.subject,
        content: blast.content,
        textContent: blast.textContent,
        status: blast.status,
        totalContacts: blast.totalContacts,
        sentCount: blast.sentCount,
        failedCount: blast.failedCount,
        delayBetweenEmails: blast.delayBetweenEmails,
        contactIds: blast.contactIds,
        ccEmails: blast.ccEmails,
        bccEmails: blast.bccEmails,
        startedAt: blast.startedAt?.toISOString(),
        completedAt: blast.completedAt?.toISOString(),
        createdAt: blast.createdAt.toISOString(),
        updatedAt: blast.updatedAt.toISOString(),
        emailAccount: blast.emailAccount,
        messageCount: blast.messages?.length || 0,
      }
    })
  } catch (error) {
    console.error('Error fetching email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to fetch email blast'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    console.log('Updating email blast:', id)

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

    const blast = await prisma.emailBlast.update({
      where: { id },
      data: {
        ...body,
      },
      include: {
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      blast: {
        id: blast.id,
        name: blast.name,
        subject: blast.subject,
        content: blast.content,
        textContent: blast.textContent,
        status: blast.status,
        totalContacts: blast.totalContacts,
        updatedAt: blast.updatedAt.toISOString(),
        emailAccount: blast.emailAccount,
      },
      message: 'Email blast updated successfully'
    })
  } catch (error) {
    console.error('Error updating email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to update email blast'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Deleting email blast:', id)

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

    await prisma.emailBlast.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Email blast deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to delete email blast'
      },
      { status: 500 }
    )
  }
}
