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

    // Determine target phone number (contact's number)
    const toNumber = phoneNumber || contact.phone1
    if (!toNumber) {
      return NextResponse.json({ error: 'No phone number available for contact' }, { status: 400 })
    }

    // Enforce team restriction: must send from assigned number
    const fromNumber = session.user.assignedPhoneNumber
    if (!fromNumber) {
      return NextResponse.json({ error: 'No assigned phone number. Contact your admin.' }, { status: 403 })
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
          phone_number: toNumber,
          last_message_at: new Date(),
          created_at: new Date()
        }
      })
    }

    // Send via Telnyx using assigned fromNumber
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const sendResp = await fetch(`${baseUrl}/api/telnyx/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromNumber, toNumber, message: message.trim(), contactId })
    })

    if (!sendResp.ok) {
      const err = await sendResp.json().catch(() => ({ error: 'Failed to send SMS' }))
      return NextResponse.json(err, { status: sendResp.status })
    }

    // Create a local message record for immediate UI feedback
    const newMessage = await prisma.message.create({
      data: {
        contact_id: contactId,
        conversation_id: conversation.id,
        sent_by: userId,
        direction: 'outbound',
        content: message.trim(),
        timestamp: new Date(),
        status: 'sent',
        message_type: 'sms',
        phone_number: toNumber,
        created_at: new Date()
      }
    })

    // Update conversation summary
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        last_message_at: new Date(),
        last_message_content: message.trim(),
        last_message_direction: 'outbound',
        last_sender_number: fromNumber
      }
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
