import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/templates/[id]/use - Increment usage count when template is used
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.messageTemplate.update({
      where: { id: params.id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({ 
      message: 'Template usage tracked',
      usageCount: template.usageCount 
    })
  } catch (error) {
    console.error('Error tracking template usage:', error)
    return NextResponse.json(
      { error: 'Failed to track template usage' },
      { status: 500 }
    )
  }
}
