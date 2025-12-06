import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Default lenders for loan processing
const DEFAULT_LENDERS = [
  { name: 'Kiavi', type: 'DSCR Lender' },
  { name: 'Roc Capital', type: 'Private Lender' },
  { name: 'Visio Lending', type: 'DSCR Lender' },
  { name: 'Certain Lending (Vontive)', type: 'DSCR Lender' },
  { name: 'Other Private Lender', type: 'Private Lender' },
];

// Default stages for loan pipeline
const DEFAULT_LOAN_STAGES = [
  { key: 'new_lead', label: 'New Lead', orderIndex: 0, defaultProbability: 10, color: '#e5e7eb' },
  { key: 'qualified', label: 'Qualified', orderIndex: 1, defaultProbability: 25, color: '#c7d2fe' },
  { key: 'application_sent', label: 'Application Sent', orderIndex: 2, defaultProbability: 40, color: '#bfdbfe' },
  { key: 'docs_in', label: 'Docs In', orderIndex: 3, defaultProbability: 55, color: '#fde68a' },
  { key: 'submitted_to_lender', label: 'Submitted to Lender', orderIndex: 4, defaultProbability: 70, color: '#fdba74' },
  { key: 'conditional_approval', label: 'Conditional Approval', orderIndex: 5, defaultProbability: 80, color: '#fca5a5' },
  { key: 'clear_to_close', label: 'Clear to Close', orderIndex: 6, defaultProbability: 95, color: '#86efac' },
  { key: 'closed', label: 'Closed', orderIndex: 7, defaultProbability: 100, isClosedStage: true, color: '#22c55e' },
  { key: 'lost', label: 'Lost', orderIndex: 8, defaultProbability: 0, isLostStage: true, color: '#ef4444' },
];

// Default stages for general deals pipeline
const DEFAULT_DEAL_STAGES = [
  { key: 'lead', label: 'Lead', orderIndex: 0, defaultProbability: 10, color: '#e5e7eb' },
  { key: 'contacted', label: 'Contacted', orderIndex: 1, defaultProbability: 20, color: '#c7d2fe' },
  { key: 'qualified', label: 'Qualified', orderIndex: 2, defaultProbability: 40, color: '#bfdbfe' },
  { key: 'proposal', label: 'Proposal', orderIndex: 3, defaultProbability: 60, color: '#fde68a' },
  { key: 'negotiation', label: 'Negotiation', orderIndex: 4, defaultProbability: 75, color: '#fdba74' },
  { key: 'closing', label: 'Closing', orderIndex: 5, defaultProbability: 90, color: '#fca5a5' },
  { key: 'closed_won', label: 'Closed Won', orderIndex: 6, defaultProbability: 100, isClosedStage: true, color: '#22c55e' },
  { key: 'closed_lost', label: 'Closed Lost', orderIndex: 7, defaultProbability: 0, isLostStage: true, color: '#ef4444' },
];

export async function POST() {
  try {
    console.log('Starting loan pipeline seeding...');

    // 1. Seed Lenders
    console.log('Seeding lenders...');
    const lenderResults = await Promise.all(
      DEFAULT_LENDERS.map(lender =>
        prisma.lender.upsert({
          where: { id: lender.name.toLowerCase().replace(/[^a-z0-9]/g, '-') },
          update: { name: lender.name, type: lender.type },
          create: { name: lender.name, type: lender.type },
        }).catch(() => 
          // If upsert fails due to no unique constraint, try create
          prisma.lender.create({ data: { name: lender.name, type: lender.type } }).catch(() => null)
        )
      )
    );
    console.log(`Seeded ${lenderResults.filter(Boolean).length} lenders`);

    // 2. Get or create Loan Processing Pipeline
    let loanPipeline = await prisma.pipeline.findFirst({
      where: { isLoanPipeline: true }
    });

    if (!loanPipeline) {
      loanPipeline = await prisma.pipeline.create({
        data: {
          name: 'Loan Processing',
          description: 'Pipeline for processing DSCR and private money loans',
          color: '#3B82F6',
          icon: 'building-2',
          isLoanPipeline: true,
          displayOrder: 1,
        }
      });
      console.log('Created Loan Processing pipeline');
    }

    // 3. Seed Loan Pipeline Stages
    console.log('Seeding loan pipeline stages...');
    for (const stage of DEFAULT_LOAN_STAGES) {
      await prisma.dealPipelineStage.upsert({
        where: {
          pipelineId_key: {
            pipelineId: loanPipeline.id,
            key: stage.key
          }
        },
        update: {
          label: stage.label,
          orderIndex: stage.orderIndex,
          defaultProbability: stage.defaultProbability,
          isClosedStage: stage.isClosedStage || false,
          isLostStage: stage.isLostStage || false,
          color: stage.color,
        },
        create: {
          pipelineId: loanPipeline.id,
          key: stage.key,
          label: stage.label,
          orderIndex: stage.orderIndex,
          defaultProbability: stage.defaultProbability,
          isClosedStage: stage.isClosedStage || false,
          isLostStage: stage.isLostStage || false,
          color: stage.color,
        }
      });
    }
    console.log(`Seeded ${DEFAULT_LOAN_STAGES.length} loan pipeline stages`);

    // 4. Get or create Default Deals Pipeline
    let defaultPipeline = await prisma.pipeline.findFirst({
      where: { isDefault: true }
    });

    if (!defaultPipeline) {
      defaultPipeline = await prisma.pipeline.create({
        data: {
          name: 'Default Pipeline',
          description: 'General deals pipeline',
          color: '#6366F1',
          icon: 'briefcase',
          isDefault: true,
          displayOrder: 0,
        }
      });
      console.log('Created Default pipeline');
    }

    // 5. Seed Default Pipeline Stages
    console.log('Seeding default pipeline stages...');
    for (const stage of DEFAULT_DEAL_STAGES) {
      await prisma.dealPipelineStage.upsert({
        where: {
          pipelineId_key: {
            pipelineId: defaultPipeline.id,
            key: stage.key
          }
        },
        update: {
          label: stage.label,
          orderIndex: stage.orderIndex,
          defaultProbability: stage.defaultProbability,
          isClosedStage: stage.isClosedStage || false,
          isLostStage: stage.isLostStage || false,
          color: stage.color,
        },
        create: {
          pipelineId: defaultPipeline.id,
          key: stage.key,
          label: stage.label,
          orderIndex: stage.orderIndex,
          defaultProbability: stage.defaultProbability,
          isClosedStage: stage.isClosedStage || false,
          isLostStage: stage.isLostStage || false,
          color: stage.color,
        }
      });
    }
    console.log(`Seeded ${DEFAULT_DEAL_STAGES.length} default pipeline stages`);

    // Get final counts
    const counts = {
      lenders: await prisma.lender.count(),
      pipelines: await prisma.pipeline.count(),
      stages: await prisma.dealPipelineStage.count(),
    };

    return NextResponse.json({
      success: true,
      message: 'Loan pipeline data seeded successfully!',
      counts,
      pipelines: {
        loan: { id: loanPipeline.id, name: loanPipeline.name },
        default: { id: defaultPipeline.id, name: defaultPipeline.name },
      }
    });

  } catch (error) {
    console.error('Error seeding loan pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to seed loan pipeline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

