import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const blasts = await prisma.textBlast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ blasts })
  } catch (error) {
    console.error('Error fetching text blasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch text blasts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      message,
      selectedContacts,
      senderNumbers,
      delaySeconds,
      contactFilters,
    } = body

    if (!message || !selectedContacts?.length || !senderNumbers?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const blast = await prisma.textBlast.create({
      data: {
        name: name || `Text Blast ${new Date().toLocaleString()}`,
        message,
        totalContacts: selectedContacts.length,
        senderNumbers: JSON.stringify(senderNumbers),
        delaySeconds: delaySeconds || 1,
        contactFilters: contactFilters ? JSON.stringify(contactFilters) : null,
        selectedContacts: JSON.stringify(selectedContacts.map((c: any) => c.id)),
        status: 'pending',
      },
    })

    return NextResponse.json({ blast })
  } catch (error) {
    console.error('Error creating text blast:', error)
    return NextResponse.json(
      { error: 'Failed to create text blast' },
      { status: 500 }
    )
  }
}
