import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { conversationId, contactId, message, phoneNumber } = body

    console.log('Team message send request:', { conversationId, contactId, message: message?.substring(0, 50), phoneNumber, userId })

    if (!message?.trim()) {
      console.log('Message validation failed: empty message')
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    if (!contactId) {
      console.log('Message validation failed: no contactId')
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    // Verify user has access to this contact
    if (contactId) {
      const hasAccess = await prisma.contactAssignment.findFirst({
        where: {
          userId,
          contactId
        }
      })

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this contact' }, { status: 403 })
      }
    }

    // Get contact information
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        phone2: true,
        phone3: true
      }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Determine target phone number
    const targetPhone = phoneNumber || contact.phone1
    if (!targetPhone) {
      return NextResponse.json({ error: 'No phone number available for contact' }, { status: 400 })
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })
    }

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          contact_id: contactId,
          phone_number: targetPhone,
          last_message_at: new Date(),
          created_at: new Date()
        }
      })
    }

    // For now, we'll create the message record but won't actually send via Telnyx
    // In a real implementation, you'd integrate with Telnyx API here
    const newMessage = await prisma.message.create({
      data: {
        contact_id: contactId,
        conversation_id: conversation.id,
        sent_by: userId,
        direction: 'outbound',
        content: message.trim(),
        timestamp: new Date(),
        status: 'sent', // In real implementation, this would be 'pending' initially
        message_type: 'sms',
        phone_number: targetPhone,
        created_at: new Date()
      }
    })

    // Update conversation last message time
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { last_message_at: new Date() }
    })

    // Return the created message
    return NextResponse.json({
      success: true,
      message: {
        id: newMessage.id,
        content: newMessage.content,
        direction: newMessage.direction,
        timestamp: newMessage.timestamp,
        status: newMessage.status,
        type: newMessage.message_type,
        phoneNumber: newMessage.phone_number,
        sentBy: newMessage.sent_by,
        isFromUser: true
      },
      conversationId: conversation.id
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
