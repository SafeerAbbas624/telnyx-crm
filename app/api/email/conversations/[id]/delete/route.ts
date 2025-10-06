import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id

    // Soft delete by setting deletedAt timestamp
    const conversation = await prisma.emailConversation.update({
      where: { id: conversationId },
      data: { 
        deletedAt: new Date(),
        isArchived: false // Remove from archived when deleted
      }
    })

    return NextResponse.json({ success: true, conversation })
  } catch (error: any) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation', details: error.message },
      { status: 500 }
    )
  }
}

