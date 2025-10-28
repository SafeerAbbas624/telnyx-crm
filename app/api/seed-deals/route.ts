import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    console.log('Starting deals and loans seeding...');

    // First, get or create some contacts
    const existingContacts = await prisma.contact.findMany({
      take: 5,
      select: { id: true, firstName: true, lastName: true }
    });

    if (existingContacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found. Please create contacts first.' },
        { status: 400 }
      );
    }

    // Create sample deals with loan data
    const sampleDeals = [
      {
        contact_id: existingContacts[0].id,
        name: 'Downtown Office Building',
        stage: 'qualified' as const,
        value: 850000,
        probability: 75,
        expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        source: 'referral',
        campaign: 'Q4 2025',
        lead_score: 85,
        pipeline: 'default',
        notes: 'Strong buyer, motivated to close',
        custom_fields: {
          loanData: {
            borrowerEmail: existingContacts[0].firstName?.toLowerCase() + '@email.com',
            borrowerPhone: '+1234567890',
            propertyAddress: '123 Main St, Austin, TX 78701',
            loanAmount: 680000,
            propertyValue: 850000,
            ltv: 80,
            loanType: 'Commercial',
            interestRate: 6.5,
            dscr: 1.35,
            monthlyRent: 8500,
            annualTaxes: 12000,
            annualInsurance: 8000,
            annualHOA: 0,
            monthlyManagementFee: 850,
            lender: 'Wells Fargo',
            status: 'in_review'
          }
        }
      },
      {
        contact_id: existingContacts[1].id,
        name: 'Residential Multi-Family Complex',
        stage: 'proposal' as const,
        value: 1200000,
        probability: 60,
        expected_close_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        source: 'cold_call',
        campaign: 'Q4 2025',
        lead_score: 72,
        pipeline: 'default',
        notes: 'Needs financing approval',
        custom_fields: {
          loanData: {
            borrowerEmail: existingContacts[1].firstName?.toLowerCase() + '@email.com',
            borrowerPhone: '+1234567891',
            propertyAddress: '456 Oak Ave, Springfield, CA 90210',
            loanAmount: 960000,
            propertyValue: 1200000,
            ltv: 80,
            loanType: 'Residential',
            interestRate: 6.25,
            dscr: 1.42,
            monthlyRent: 12000,
            annualTaxes: 18000,
            annualInsurance: 12000,
            annualHOA: 2400,
            monthlyManagementFee: 1200,
            lender: 'Chase Bank',
            status: 'pending_docs'
          }
        }
      },
      {
        contact_id: existingContacts[2].id,
        name: 'Industrial Warehouse',
        stage: 'negotiation' as const,
        value: 2500000,
        probability: 45,
        expected_close_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        source: 'broker',
        campaign: 'Q4 2025',
        lead_score: 68,
        pipeline: 'default',
        notes: 'Negotiating terms',
        custom_fields: {
          loanData: {
            borrowerEmail: existingContacts[2].firstName?.toLowerCase() + '@email.com',
            borrowerPhone: '+1234567892',
            propertyAddress: '789 Industrial Blvd, Houston, TX 77001',
            loanAmount: 1875000,
            propertyValue: 2500000,
            ltv: 75,
            loanType: 'Commercial',
            interestRate: 6.75,
            dscr: 1.28,
            monthlyRent: 18000,
            annualTaxes: 30000,
            annualInsurance: 20000,
            annualHOA: 0,
            monthlyManagementFee: 1800,
            lender: 'Bank of America',
            status: 'under_review'
          }
        }
      },
      {
        contact_id: existingContacts[3].id,
        name: 'Retail Shopping Center',
        stage: 'lead' as const,
        value: 3500000,
        probability: 30,
        expected_close_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        source: 'website',
        campaign: 'Q1 2026',
        lead_score: 55,
        pipeline: 'default',
        notes: 'Initial inquiry',
        custom_fields: {
          loanData: {
            borrowerEmail: existingContacts[3].firstName?.toLowerCase() + '@email.com',
            borrowerPhone: '+1234567893',
            propertyAddress: '321 Commerce St, Miami, FL 33101',
            loanAmount: 2625000,
            propertyValue: 3500000,
            ltv: 75,
            loanType: 'Commercial',
            interestRate: 6.9,
            dscr: 1.15,
            monthlyRent: 28000,
            annualTaxes: 42000,
            annualInsurance: 28000,
            annualHOA: 0,
            monthlyManagementFee: 2800,
            lender: 'Citibank',
            status: 'new'
          }
        }
      },
      {
        contact_id: existingContacts[4].id,
        name: 'Mixed-Use Development',
        stage: 'contract' as const,
        value: 4200000,
        probability: 85,
        expected_close_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        source: 'referral',
        campaign: 'Q4 2025',
        lead_score: 92,
        pipeline: 'default',
        notes: 'Ready to close',
        custom_fields: {
          loanData: {
            borrowerEmail: existingContacts[4].firstName?.toLowerCase() + '@email.com',
            borrowerPhone: '+1234567894',
            propertyAddress: '555 Development Way, Denver, CO 80202',
            loanAmount: 3150000,
            propertyValue: 4200000,
            ltv: 75,
            loanType: 'Commercial',
            interestRate: 6.4,
            dscr: 1.52,
            monthlyRent: 35000,
            annualTaxes: 50000,
            annualInsurance: 35000,
            annualHOA: 0,
            monthlyManagementFee: 3500,
            lender: 'Wells Fargo',
            status: 'approved'
          }
        }
      }
    ];

    // Create deals
    const createdDeals = await Promise.all(
      sampleDeals.map(deal =>
        prisma.deal.create({
          data: {
            contact_id: deal.contact_id,
            name: deal.name,
            stage: deal.stage,
            value: deal.value,
            probability: deal.probability,
            expected_close_date: deal.expected_close_date,
            source: deal.source,
            campaign: deal.campaign,
            lead_score: deal.lead_score,
            pipeline: deal.pipeline,
            notes: deal.notes,
            custom_fields: deal.custom_fields
          }
        })
      )
    );

    console.log(`Created ${createdDeals.length} sample deals with loan data`);

    // Get counts
    const counts = {
      deals: await prisma.deal.count(),
      contacts: await prisma.contact.count()
    };

    return NextResponse.json({
      success: true,
      message: `Created ${createdDeals.length} sample deals with loan data`,
      deals: createdDeals.map(d => ({
        id: d.id,
        name: d.name,
        stage: d.stage,
        value: d.value,
        probability: d.probability
      })),
      counts
    });

  } catch (error) {
    console.error('Error seeding deals:', error);
    return NextResponse.json(
      { error: 'Failed to seed deals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const counts = {
      deals: await prisma.deal.count(),
      contacts: await prisma.contact.count()
    };

    return NextResponse.json({
      success: true,
      message: 'Current database counts',
      counts
    });
  } catch (error) {
    console.error('Error getting counts:', error);
    return NextResponse.json(
      { error: 'Failed to get counts' },
      { status: 500 }
    );
  }
}

