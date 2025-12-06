import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - List all call scripts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pipelineId = searchParams.get('pipelineId')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: any = {}
    if (pipelineId) where.pipelineId = pipelineId
    if (activeOnly) where.isActive = true

    const scripts = await prisma.callScript.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { campaigns: true }
        }
      }
    })

    return NextResponse.json({ scripts })
  } catch (error) {
    console.error('Error fetching call scripts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call scripts' },
      { status: 500 }
    )
  }
}

// POST - Create a new call script
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, content, variables, pipelineId } = body

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }

    // Extract variables from content if not provided
    const extractedVariables = variables || extractVariablesFromContent(content)

    const script = await prisma.callScript.create({
      data: {
        name,
        description,
        content,
        variables: extractedVariables,
        pipelineId: pipelineId || null,
      },
    })

    return NextResponse.json({ script })
  } catch (error) {
    console.error('Error creating call script:', error)
    return NextResponse.json(
      { error: 'Failed to create call script' },
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

