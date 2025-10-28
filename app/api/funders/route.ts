import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all funders or create default funders if none exist
export async function GET(request: NextRequest) {
  try {
    let funders = await prisma.funder.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // If no funders exist, create default ones
    if (funders.length === 0) {
      const defaultFunders = [
        {
          name: 'Kiavi',
          description: 'Kiavi - Fix & Flip and DSCR Lender',
          requiredDocuments: [
            'Application',
            'Bank Statements',
            'Tax Returns',
            'Credit Report',
            'Insurance',
            'Appraisal',
          ],
        },
        {
          name: 'Visio',
          description: 'Visio - DSCR and Commercial Lender',
          requiredDocuments: [
            'Application',
            'Bank Statements',
            'Credit Report',
            'Title',
          ],
        },
        {
          name: 'ROC Capital',
          description: 'ROC Capital - Fix & Flip and Ground Up Construction',
          requiredDocuments: [
            'Application',
            'Bank Statements',
            'Tax Returns',
            'Appraisal',
            'Title',
          ],
        },
      ]

      for (const funderData of defaultFunders) {
        await prisma.funder.create({
          data: {
            name: funderData.name,
            description: funderData.description,
            requiredDocuments: funderData.requiredDocuments,
          },
        })
      }

      funders = await prisma.funder.findMany({
        orderBy: { createdAt: 'desc' },
      })
    }

    return NextResponse.json({ funders })
  } catch (error) {
    console.error('Error fetching funders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch funders' },
      { status: 500 }
    )
  }
}

// POST create a new funder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, requiredDocuments } = body

    if (!name || !requiredDocuments || !Array.isArray(requiredDocuments)) {
      return NextResponse.json(
        { error: 'Name and requiredDocuments array are required' },
        { status: 400 }
      )
    }

    const funder = await prisma.funder.create({
      data: {
        name,
        description: description || '',
        requiredDocuments,
      },
    })

    return NextResponse.json({ funder }, { status: 201 })
  } catch (error) {
    console.error('Error creating funder:', error)
    return NextResponse.json(
      { error: 'Failed to create funder' },
      { status: 500 }
    )
  }
}

