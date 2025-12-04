import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/email/inbound - Get recent inbound emails
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '10')

    const whereClause: any = {
      // Inbound emails are those we received (direction = inbound)
      direction: 'inbound'
    }

    if (since) {
      whereClause.createdAt = {
        gt: new Date(since)
      }
    }

    const emails = await prisma.emailMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        fromEmail: true,
        fromName: true,
        toEmails: true,
        subject: true,
        textContent: true,
        status: true,
        createdAt: true,
        contactId: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true
          }
        }
      }
    })

    // Transform to frontend format
    const formattedEmails = emails.map(email => ({
      id: email.id,
      from: email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail,
      to: email.toEmails.join(', '),
      subject: email.subject,
      snippet: email.textContent?.substring(0, 100) || '',
      status: email.status,
      createdAt: email.createdAt,
      contact: email.contact ? {
        id: email.contact.id,
        firstName: email.contact.firstName,
        lastName: email.contact.lastName,
        email1: email.contact.email1
      } : null
    }))

    return NextResponse.json({
      emails: formattedEmails,
      count: formattedEmails.length
    })

  } catch (error) {
    console.error('Error fetching inbound emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inbound emails' },
      { status: 500 }
    )
  }
}

