import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/fields - Get all field definitions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const fields = await prisma.fieldDefinition.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return NextResponse.json(fields);
  } catch (error) {
    console.error('Error fetching fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fields' },
      { status: 500 }
    );
  }
}

// POST /api/fields - Create a new field definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      fieldKey,
      fieldType,
      category,
      options,
      isRequired,
      placeholder,
      helpText,
      displayOrder
    } = body;

    // Validate required fields
    if (!name || !fieldKey || !fieldType) {
      return NextResponse.json(
        { error: 'Name, fieldKey, and fieldType are required' },
        { status: 400 }
      );
    }

    // Check if fieldKey already exists
    const existing = await prisma.fieldDefinition.findUnique({
      where: { fieldKey }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A field with this key already exists' },
        { status: 400 }
      );
    }

    const field = await prisma.fieldDefinition.create({
      data: {
        name,
        fieldKey,
        fieldType,
        category,
        options: options || null,
        isRequired: isRequired || false,
        placeholder,
        helpText,
        displayOrder
      }
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.error('Error creating field:', error);
    return NextResponse.json(
      { error: 'Failed to create field' },
      { status: 500 }
    );
  }
}

