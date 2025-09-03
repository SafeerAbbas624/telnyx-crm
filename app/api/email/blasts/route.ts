import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('Fetching email blasts with status:', status)

    // Build where clause
    const whereClause: any = {}
    if (status) {
      // Map common status values to TextBlastStatus enum
      const statusMapping: { [key: string]: string } = {
        'active': 'running',
        'inactive': 'paused',
        'draft': 'draft',
        'pending': 'pending',
        'running': 'running',
        'paused': 'paused',
        'completed': 'completed',
        'failed': 'failed',
        'cancelled': 'cancelled'
      }

      const mappedStatus = statusMapping[status] || status
      whereClause.status = mappedStatus
    }

    // Check if EmailBlast model exists
    if (!prisma.emailBlast) {
      console.warn('EmailBlast model not available in Prisma client')
      return NextResponse.json({
        success: true,
        blasts: [],
        total: 0,
        message: 'EmailBlast model not available'
      })
    }

    const blasts = await prisma.emailBlast.findMany({
      where: whereClause,
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
    })

    const total = await prisma.emailBlast.count({
      where: whereClause
    })

    console.log(`Found ${blasts.length} email blasts`)

    return NextResponse.json({
      success: true,
      blasts: blasts.map(blast => ({
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
        startedAt: blast.startedAt?.toISOString(),
        completedAt: blast.completedAt?.toISOString(),
        createdAt: blast.createdAt.toISOString(),
        updatedAt: blast.updatedAt.toISOString(),
        emailAccount: blast.emailAccount,
        messageCount: blast.messages?.length || 0,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching email blasts:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to fetch email blasts'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      subject,
      content,
      textContent,
      emailAccountId,
      contactIds,
      ccEmails,
      bccEmails,
      delayBetweenEmails,
    } = body

    console.log('Creating email blast:', { name, subject, recipientCount: contactIds?.length })

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

    // Validate required fields
    if (!name || !subject || !content || !emailAccountId) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Missing required fields: name, subject, content, emailAccountId'
        },
        { status: 400 }
      )
    }

    // Create email blast
    const blast = await prisma.emailBlast.create({
      data: {
        name,
        subject,
        content,
        textContent: textContent || content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        emailAccountId,
        contactIds: contactIds || [],
        ccEmails: ccEmails || [],
        bccEmails: bccEmails || [],
        totalContacts: contactIds?.length || 0,
        status: 'draft',
        delayBetweenEmails: delayBetweenEmails || 0,
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

    console.log('Email blast created:', blast.id)

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
        createdAt: blast.createdAt.toISOString(),
        emailAccount: blast.emailAccount,
      },
      message: 'Email blast created successfully'
    })
  } catch (error) {
    console.error('Error creating email blast:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to create email blast'
      },
      { status: 500 }
    )
  }
}
