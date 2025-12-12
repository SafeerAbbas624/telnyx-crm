import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        color: pipeline.color,
        icon: pipeline.icon,
        isDefault: pipeline.isDefault,
        isLoanPipeline: pipeline.isLoanPipeline,
        createdAt: pipeline.createdAt.toISOString(),
        stages: pipeline.stages.map(s => ({
          id: s.id,
          key: s.key,
          name: s.label,
          label: s.label,
          order: s.orderIndex,
          orderIndex: s.orderIndex,
          color: s.color,
          defaultProbability: s.defaultProbability,
          isClosedStage: s.isClosedStage,
          isLostStage: s.isLostStage,
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, icon, isDefault, isLoanPipeline } = body;

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.pipeline.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isLoanPipeline !== undefined && { isLoanPipeline }),
      },
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        color: pipeline.color,
        icon: pipeline.icon,
        isDefault: pipeline.isDefault,
        isLoanPipeline: pipeline.isLoanPipeline,
        createdAt: pipeline.createdAt.toISOString(),
        stages: pipeline.stages.map(s => ({
          id: s.id,
          key: s.key,
          name: s.label,
          label: s.label,
          order: s.orderIndex,
          orderIndex: s.orderIndex,
          color: s.color,
          defaultProbability: s.defaultProbability,
          isClosedStage: s.isClosedStage,
          isLostStage: s.isLostStage,
        }))
      }
    });
  } catch (error) {
    console.error('Error updating pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if pipeline has deals
    const dealsCount = await prisma.deal.count({
      where: { pipelineId: id }
    });

    if (dealsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete pipeline with ${dealsCount} deals. Move or delete deals first.` },
        { status: 400 }
      );
    }

    // Delete stages first
    await prisma.dealPipelineStage.deleteMany({
      where: { pipelineId: id }
    });

    // Delete pipeline
    await prisma.pipeline.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    );
  }
}

