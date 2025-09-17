import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Checking emails in database...')
    
    // Check contacts
    const contacts = await prisma.contact.findMany({
      where: {
        email1: {
          contains: 'test@example.com'
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email1: true,
        createdAt: true,
      }
    })

    console.log('Debug: Found contacts:', contacts.length)

    // Check if EmailMessage model is available
    let emailMessages = []
    let emailConversations = []

    try {
      if (prisma.emailMessage) {
        emailMessages = await prisma.emailMessage.findMany({
          take: 10,
          orderBy: {
            deliveredAt: 'desc'
          },
          select: {
            id: true,
            messageId: true,
            fromEmail: true,
            subject: true,
            deliveredAt: true,
            sentAt: true,
            createdAt: true,
            contactId: true,
          }
        })
        console.log('Debug: Found email messages:', emailMessages.length)
      }
    } catch (error) {
      console.log('Debug: EmailMessage model not available:', error.message)
    }

    try {
      if (prisma.emailConversation) {
        emailConversations = await prisma.emailConversation.findMany({
          take: 10,
          orderBy: {
            lastMessageAt: 'desc'
          },
          select: {
            id: true,
            contactId: true,
            emailAddress: true,
            lastMessageContent: true,
            lastMessageAt: true,
            messageCount: true,
            unreadCount: true,
          }
        })
        console.log('Debug: Found email conversations:', emailConversations.length)
      }
    } catch (error) {
      console.log('Debug: EmailConversation model not available:', error.message)
    }

    return NextResponse.json({
      success: true,
      data: {
        contacts: contacts,
        emailMessages: emailMessages,
        emailConversations: emailConversations,
      },
      counts: {
        contacts: contacts.length,
        emailMessages: emailMessages.length,
        emailConversations: emailConversations.length,
      },
      message: `Found ${contacts.length} contacts, ${emailMessages.length} email messages, ${emailConversations.length} email conversations`
    })
  } catch (error) {
    console.error('Debug: Error checking emails:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to check emails in database'
      },
      { status: 500 }
    )
  }
}
