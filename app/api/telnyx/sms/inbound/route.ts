import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/telnyx/sms/inbound - Get recent inbound SMS messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '10')

    const whereClause: any = {
      direction: 'inbound'
    }

    if (since) {
      whereClause.createdAt = {
        gt: new Date(since)
      }
    }

    const messages = await prisma.telnyxMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            email1: true
          }
        }
      }
    })

    // Transform to frontend format
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      from: msg.fromNumber,
      to: msg.toNumber,
      body: msg.content,
      direction: msg.direction,
      status: msg.status,
      createdAt: msg.createdAt,
      contact: msg.contact ? {
        id: msg.contact.id,
        firstName: msg.contact.firstName,
        lastName: msg.contact.lastName,
        phone1: msg.contact.phone1,
        email1: msg.contact.email1
      } : null
    }))

    return NextResponse.json({
      messages: formattedMessages,
      count: formattedMessages.length
    })

  } catch (error) {
    console.error('Error fetching inbound SMS:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inbound messages' },
      { status: 500 }
    )
  }
}

