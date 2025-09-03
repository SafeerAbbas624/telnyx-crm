import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(
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

    // Only team members can access this endpoint
    if (session.user.role !== 'TEAM_MEMBER') {
      return NextResponse.json(
        { error: 'Forbidden - Only team members can access team email conversations' },
        { status: 403 }
      )
    }

    const conversationId = params.id

    // First, verify the conversation belongs to an assigned contact
    const conversation = await prisma.emailConversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: {
          include: {
            assignedUsers: {
              where: { userId: session.user.id }
            }
          }
        }
      }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check if the contact is assigned to this team member
    if (!conversation.contact?.assignedUsers.length) {
      return NextResponse.json(
        { error: 'Forbidden - Contact not assigned to you' },
        { status: 403 }
      )
    }

    // Get messages for this conversation
    const messages = await prisma.email.findMany({
      where: {
        conversationId: conversationId
      },
      orderBy: {
        timestamp: 'asc'
      },
      include: {
        attachments: {
          select: {
            id: true,
            filename: true,
            size: true,
            contentType: true
          }
        }
      }
    })

    return NextResponse.json({
      messages: messages.map(message => ({
        id: message.id,
        subject: message.subject,
        content: message.content,
        fromEmail: message.fromEmail,
        fromName: message.fromName,
        toEmail: message.toEmail,
        toName: message.toName,
        direction: message.direction,
        timestamp: message.timestamp,
        isRead: message.isRead,
        attachments: message.attachments
      }))
    })

  } catch (error) {
    console.error('Error fetching email messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
