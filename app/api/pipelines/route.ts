import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isLoanPipeline = searchParams.get('isLoanPipeline');
    const includeStages = searchParams.get('includeStages') !== 'false';

    // Build where clause
    const where: any = {};
    if (isLoanPipeline !== null && isLoanPipeline !== undefined) {
      where.isLoanPipeline = isLoanPipeline === 'true';
    }

    const pipelines = await prisma.pipeline.findMany({
      where,
      include: includeStages ? {
        stages: {
          orderBy: { orderIndex: 'asc' }
        }
      } : undefined,
      orderBy: { displayOrder: 'asc' }
    });

    // Transform to frontend format
    const transformedPipelines = pipelines.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      icon: p.icon,
      isDefault: p.isDefault,
      isLoanPipeline: p.isLoanPipeline,
      createdAt: p.createdAt.toISOString(),
      stages: p.stages?.map(s => ({
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
      })) || []
    }));

    return NextResponse.json({
      success: true,
      pipelines: transformedPipelines
    });

  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipelines', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon, isLoanPipeline, stages } = body;

    // Get max display order
    const maxOrder = await prisma.pipeline.aggregate({
      _max: { displayOrder: true }
    });

    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        description,
        color: color || '#6366F1',
        icon: icon || 'briefcase',
        isLoanPipeline: isLoanPipeline || false,
        displayOrder: (maxOrder._max.displayOrder || 0) + 1,
        stages: stages ? {
          create: stages.map((s: any, index: number) => ({
            key: s.key,
            label: s.label || s.name,
            orderIndex: index,
            defaultProbability: s.defaultProbability || 0,
            isClosedStage: s.isClosedStage || false,
            isLostStage: s.isLostStage || false,
            color: s.color || '#e5e7eb',
          }))
        } : undefined
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
    console.error('Error creating pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to create pipeline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

