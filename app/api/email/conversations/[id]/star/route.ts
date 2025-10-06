import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isStarred } = await request.json()
    const conversationId = params.id

    const conversation = await prisma.emailConversation.update({
      where: { id: conversationId },
      data: { isStarred }
    })

    return NextResponse.json({ success: true, conversation })
  } catch (error: any) {
    console.error('Error updating conversation star status:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation', details: error.message },
      { status: 500 }
    )
  }
}

