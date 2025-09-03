import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Checking email messages in database...')
    
    // Check if EmailMessage model exists
    if (!prisma.emailMessage) {
      return NextResponse.json({
        error: 'EmailMessage model not available',
        available_models: Object.keys(prisma).filter(key => !key.startsWith('_'))
      })
    }

    // Get total count of email messages
    const totalCount = await prisma.emailMessage.count()
    
    // Get sample email messages
    const sampleMessages = await prisma.emailMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
          }
        },
        emailAccount: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          }
        }
      }
    })

    // Get contacts with email addresses
    const contactsWithEmails = await prisma.contact.findMany({
      where: {
        OR: [
          { email1: { not: null } },
          { email2: { not: null } },
          { email3: { not: null } },
        ]
      },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email1: true,
        email2: true,
        email3: true,
      }
    })

    // Get email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        status: true,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalEmailMessages: totalCount,
        sampleMessages,
        contactsWithEmails: contactsWithEmails.length,
        sampleContacts: contactsWithEmails,
        emailAccounts: emailAccounts.length,
        sampleEmailAccounts: emailAccounts,
      }
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
