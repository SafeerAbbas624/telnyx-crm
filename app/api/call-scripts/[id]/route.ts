import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Get a single call script
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const script = await prisma.callScript.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { campaigns: true }
        }
      }
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    return NextResponse.json({ script })
  } catch (error) {
    console.error('Error fetching call script:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call script' },
      { status: 500 }
    )
  }
}

// PUT - Update a call script
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, content, variables, isActive, pipelineId } = body

    // Extract variables from content if content changed and variables not provided
    let extractedVariables = variables
    if (content && !variables) {
      extractedVariables = extractVariablesFromContent(content)
    }

    const script = await prisma.callScript.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(content !== undefined && { content }),
        ...(extractedVariables !== undefined && { variables: extractedVariables }),
        ...(isActive !== undefined && { isActive }),
        ...(pipelineId !== undefined && { pipelineId }),
      },
    })

    return NextResponse.json({ script })
  } catch (error) {
    console.error('Error updating call script:', error)
    return NextResponse.json(
      { error: 'Failed to update call script' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a call script
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if script is used by any campaigns
    const campaignCount = await prisma.callCampaign.count({
      where: { scriptId: params.id }
    })

    if (campaignCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete script. It is used by ${campaignCount} campaign(s).` },
        { status: 400 }
      )
    }

    await prisma.callScript.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting call script:', error)
    return NextResponse.json(
      { error: 'Failed to delete call script' },
      { status: 500 }
    )
  }
}

// Helper function to extract variables from script content
function extractVariablesFromContent(content: string): string[] {
  const regex = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g
  const matches = content.matchAll(regex)
  const variables = new Set<string>()
  
  for (const match of matches) {
    variables.add(match[1])
  }
  
  return Array.from(variables)
}

