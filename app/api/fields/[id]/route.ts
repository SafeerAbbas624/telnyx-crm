import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/fields/[id] - Get a single field definition
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const field = await prisma.fieldDefinition.findUnique({
      where: { id: params.id }
    });

    if (!field) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error('Error fetching field:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field' },
      { status: 500 }
    );
  }
}

// PUT /api/fields/[id] - Update a field definition
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      fieldType,
      category,
      options,
      isRequired,
      isActive,
      placeholder,
      helpText,
      displayOrder
    } = body;

    // Check if field exists
    const existing = await prisma.fieldDefinition.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    // Prevent editing system fields
    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'System fields cannot be modified' },
        { status: 403 }
      );
    }

    const field = await prisma.fieldDefinition.update({
      where: { id: params.id },
      data: {
        name,
        fieldType,
        category,
        options: options || null,
        isRequired,
        isActive,
        placeholder,
        helpText,
        displayOrder
      }
    });

    return NextResponse.json(field);
  } catch (error) {
    console.error('Error updating field:', error);
    return NextResponse.json(
      { error: 'Failed to update field' },
      { status: 500 }
    );
  }
}

// DELETE /api/fields/[id] - Delete a field definition
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if field exists
    const existing = await prisma.fieldDefinition.findUnique({
      where: { id: params.id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    // Prevent deleting system fields
    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'System fields cannot be deleted' },
        { status: 403 }
      );
    }

    await prisma.fieldDefinition.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting field:', error);
    return NextResponse.json(
      { error: 'Failed to delete field' },
      { status: 500 }
    );
  }
}

