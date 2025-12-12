import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id, stageId } = await params;
    const body = await request.json();
    const { key, label, color, orderIndex, defaultProbability, isClosedStage, isLostStage } = body;

    const stage = await prisma.dealPipelineStage.update({
      where: { id: stageId, pipelineId: id },
      data: {
        ...(key !== undefined && { key }),
        ...(label !== undefined && { label }),
        ...(color !== undefined && { color }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(defaultProbability !== undefined && { defaultProbability }),
        ...(isClosedStage !== undefined && { isClosedStage }),
        ...(isLostStage !== undefined && { isLostStage }),
      }
    });

    return NextResponse.json({
      success: true,
      stage: {
        id: stage.id,
        key: stage.key,
        name: stage.label,
        label: stage.label,
        order: stage.orderIndex,
        orderIndex: stage.orderIndex,
        color: stage.color,
        defaultProbability: stage.defaultProbability,
        isClosedStage: stage.isClosedStage,
        isLostStage: stage.isLostStage,
      }
    });
  } catch (error) {
    console.error('Error updating stage:', error);
    return NextResponse.json(
      { error: 'Failed to update stage' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id, stageId } = await params;

    // Check if any deals are in this stage
    const dealsCount = await prisma.deal.count({
      where: { stageId }
    });

    if (dealsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete stage with ${dealsCount} deals. Move deals to another stage first.` },
        { status: 400 }
      );
    }

    await prisma.dealPipelineStage.delete({
      where: { id: stageId, pipelineId: id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stage:', error);
    return NextResponse.json(
      { error: 'Failed to delete stage' },
      { status: 500 }
    );
  }
}

