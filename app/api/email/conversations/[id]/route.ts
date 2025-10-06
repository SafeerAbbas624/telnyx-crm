import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id

    const conversation = await prisma.emailConversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true
      }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ conversation })
  } catch (error: any) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id

    // Get the conversation first to find related messages
    const conversation = await prisma.emailConversation.findUnique({
      where: { id: conversationId }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Delete all messages related to this contact and email address
    // Since EmailMessage doesn't have conversationId, we need to find by contact and email
    await prisma.emailMessage.deleteMany({
      where: {
        contactId: conversation.contactId,
        OR: [
          { fromEmail: conversation.emailAddress },
          { toEmails: { has: conversation.emailAddress } }
        ]
      }
    })

    // Delete the conversation
    await prisma.emailConversation.delete({
      where: {
        id: conversationId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
