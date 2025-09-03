import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/templates - Get all templates
export async function GET() {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, content, description } = body

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }

    // Extract variables from content (format: {variableName})
    const variableRegex = /\{([^}]+)\}/g
    const matches = Array.from(content.matchAll(variableRegex))
    const variables: string[] = []

    for (const match of matches) {
      if (match[1] && !variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        content,
        description,
        variables,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
