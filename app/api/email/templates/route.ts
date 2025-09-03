import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check if EmailTemplate model exists
    if (!prisma.emailTemplate) {
      console.warn('EmailTemplate model not available in Prisma client. Returning empty data.');
      return NextResponse.json({
        templates: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('active');

    const where: any = {};
    
    if (category) {
      where.category = category;
    }
    
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ],
    });

    return NextResponse.json({
      templates,
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if EmailTemplate model exists
    if (!prisma.emailTemplate) {
      return NextResponse.json(
        { error: 'Email templates not supported yet' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const {
      name,
      subject,
      content,
      textContent,
      category = 'custom',
      isSystem = false,
      isActive = true,
    } = body;

    // Validate required fields
    if (!name || !subject || !content) {
      return NextResponse.json(
        { error: 'Name, subject, and content are required' },
        { status: 400 }
      );
    }

    // Check if template name already exists
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: { name },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        content,
        textContent: textContent || null,
        category,
        isSystem,
        isActive,
      },
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error creating email template:', error);
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!prisma.emailTemplate) {
      return NextResponse.json(
        { error: 'Email templates not supported yet' },
        { status: 501 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!prisma.emailTemplate) {
      return NextResponse.json(
        { error: 'Email templates not supported yet' },
        { status: 501 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Check if it's a system template
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (template?.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system templates' },
        { status: 403 }
      );
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Email template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting email template:', error);
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}
