import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
      include: {
        dealStage: true,
        lender: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            phone1: true,
            email1: true,
          }
        }
      }
    });

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deal: {
        id: deal.id,
        title: deal.name,
        value: Number(deal.value),
        contactId: deal.contact_id,
        contactName: deal.contact?.fullName || `${deal.contact?.firstName || ''} ${deal.contact?.lastName || ''}`.trim(),
        contactPhone: deal.contact?.phone1,
        contactEmail: deal.contact?.email1,
        stage: deal.stage,
        stageId: deal.stageId,
        stageName: deal.dealStage?.label,
        stageColor: deal.dealStage?.color,
        probability: deal.probability || 0,
        expectedCloseDate: deal.expected_close_date?.toISOString().split('T')[0] || '',
        notes: deal.notes || '',
        pipeline: deal.pipeline,
        createdAt: deal.created_at.toISOString(),
        updatedAt: deal.updated_at?.toISOString() || '',
        // Loan-specific fields
        isLoanDeal: deal.isLoanDeal,
        lenderId: deal.lenderId,
        lenderName: deal.lender?.name,
        llcName: deal.llcName,
        propertyAddress: deal.propertyAddress,
        loanAmount: deal.loanAmount ? Number(deal.loanAmount) : null,
        propertyValue: deal.propertyValue ? Number(deal.propertyValue) : null,
        ltv: deal.ltv ? Number(deal.ltv) : null,
        loanType: deal.loanType,
        interestRate: deal.interestRate ? Number(deal.interestRate) : null,
        dscr: deal.dscr ? Number(deal.dscr) : null,
        loanCopilotData: deal.loanCopilotData,
      }
    });
  } catch (error) {
    console.error('Error fetching deal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deal' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      stage,
      stageId,
      value,
      probability,
      contact_id,
      expected_close_date,
      notes,
      // Loan-specific fields
      isLoanDeal,
      lenderId,
      llcName,
      propertyAddress,
      loanAmount,
      propertyValue,
      ltv,
      loanType,
      interestRate,
      dscr,
    } = body;

    // If stageId is provided, get the stage key
    let stageKey = stage;
    if (stageId) {
      const pipelineStage = await prisma.dealPipelineStage.findUnique({
        where: { id: stageId }
      });
      if (pipelineStage) {
        stageKey = pipelineStage.key;
      }
    }

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        name,
        stage: stageKey,
        stageId: stageId || undefined,
        value: value !== undefined ? parseFloat(value) : undefined,
        probability: probability !== undefined ? parseInt(probability) : undefined,
        contact_id,
        expected_close_date: expected_close_date ? new Date(expected_close_date) : null,
        notes,
        // Loan-specific fields
        isLoanDeal: isLoanDeal !== undefined ? isLoanDeal : undefined,
        lenderId: lenderId !== undefined ? lenderId : undefined,
        llcName: llcName !== undefined ? llcName : undefined,
        propertyAddress: propertyAddress !== undefined ? propertyAddress : undefined,
        loanAmount: loanAmount !== undefined ? parseFloat(loanAmount) : undefined,
        propertyValue: propertyValue !== undefined ? parseFloat(propertyValue) : undefined,
        ltv: ltv !== undefined ? parseFloat(ltv) : undefined,
        loanType: loanType !== undefined ? loanType : undefined,
        interestRate: interestRate !== undefined ? parseFloat(interestRate) : undefined,
        dscr: dscr !== undefined ? parseFloat(dscr) : undefined,
      },
      include: {
        dealStage: true,
        lender: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            phone1: true,
            email1: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      deal: {
        id: deal.id,
        title: deal.name,
        value: Number(deal.value),
        contactId: deal.contact_id,
        contactName: deal.contact?.fullName || `${deal.contact?.firstName || ''} ${deal.contact?.lastName || ''}`.trim(),
        stage: deal.stage,
        stageId: deal.stageId,
        stageName: deal.dealStage?.label,
        probability: deal.probability || 0,
        expectedCloseDate: deal.expected_close_date?.toISOString().split('T')[0] || '',
        notes: deal.notes || '',
        // Loan-specific fields
        isLoanDeal: deal.isLoanDeal,
        lenderId: deal.lenderId,
        lenderName: deal.lender?.name,
        llcName: deal.llcName,
        propertyAddress: deal.propertyAddress,
        loanAmount: deal.loanAmount ? Number(deal.loanAmount) : null,
        propertyValue: deal.propertyValue ? Number(deal.propertyValue) : null,
        ltv: deal.ltv ? Number(deal.ltv) : null,
        loanType: deal.loanType,
        interestRate: deal.interestRate ? Number(deal.interestRate) : null,
        dscr: deal.dscr ? Number(deal.dscr) : null,
      }
    });
  } catch (error) {
    console.error('Error updating deal:', error);
    return NextResponse.json(
      { error: 'Failed to update deal' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.deal.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Deal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deal:', error);
    return NextResponse.json(
      { error: 'Failed to delete deal' },
      { status: 500 }
    );
  }
}

