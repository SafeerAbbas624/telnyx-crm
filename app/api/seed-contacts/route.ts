import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    console.log('Creating sample contacts...');

    const sampleContacts = [
      {
        firstName: 'John',
        lastName: 'Smith',
        llcName: 'Smith Properties LLC',
        phone1: '+1234567890',
        phone2: '+1234567891',
        email1: 'john.smith@email.com',
        email2: 'john@smithproperties.com',
        propertyAddress: '123 Main St, Anytown, NY 12345',
        city: 'Anytown',
        state: 'NY',
        propertyCounty: 'Sample County',
        propertyType: 'Single Family',
        bedrooms: 3,
        totalBathrooms: 2.5,
        buildingSqft: 2000,
        effectiveYearBuilt: 1995,
        estValue: 350000,
        estEquity: 200000,
        dealStatus: 'lead',
        notes: 'Interested in selling, needs quick close'
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        llcName: 'Johnson Investments',
        phone1: '+1234567892',
        email1: 'sarah.johnson@email.com',
        propertyAddress: '456 Oak Ave, Springfield, CA 90210',
        city: 'Springfield',
        state: 'CA',
        propertyCounty: 'Los Angeles',
        propertyType: 'Condo',
        bedrooms: 2,
        totalBathrooms: 2,
        buildingSqft: 1200,
        effectiveYearBuilt: 2005,
        estValue: 450000,
        estEquity: 300000,
        dealStatus: 'qualified',
        notes: 'Looking for investment opportunities'
      },
      {
        firstName: 'Michael',
        lastName: 'Davis',
        phone1: '+1234567893',
        phone2: '+1234567894',
        email1: 'michael.davis@email.com',
        propertyAddress: '789 Pine St, Austin, TX 78701',
        city: 'Austin',
        state: 'TX',
        propertyCounty: 'Travis',
        propertyType: 'Townhouse',
        bedrooms: 4,
        totalBathrooms: 3,
        buildingSqft: 2500,
        effectiveYearBuilt: 2010,
        estValue: 520000,
        estEquity: 350000,
        dealStatus: 'proposal',
        notes: 'Motivated seller, relocating for work'
      },
      {
        firstName: 'Emily',
        lastName: 'Wilson',
        llcName: 'Wilson Real Estate Group',
        phone1: '+1234567895',
        email1: 'emily.wilson@email.com',
        email2: 'emily@wilsonrealestate.com',
        propertyAddress: '321 Elm Dr, Miami, FL 33101',
        city: 'Miami',
        state: 'FL',
        propertyCounty: 'Miami-Dade',
        propertyType: 'Single Family',
        bedrooms: 5,
        totalBathrooms: 4,
        buildingSqft: 3200,
        effectiveYearBuilt: 2015,
        estValue: 750000,
        estEquity: 500000,
        dealStatus: 'negotiation',
        notes: 'High-end property, cash preferred'
      },
      {
        firstName: 'David',
        lastName: 'Brown',
        phone1: '+1234567896',
        email1: 'david.brown@email.com',
        propertyAddress: '654 Maple Ln, Seattle, WA 98101',
        city: 'Seattle',
        state: 'WA',
        propertyCounty: 'King',
        propertyType: 'Duplex',
        bedrooms: 6,
        totalBathrooms: 4,
        buildingSqft: 2800,
        effectiveYearBuilt: 1985,
        estValue: 680000,
        estEquity: 400000,
        dealStatus: 'lead',
        notes: 'Investment property, good rental income'
      },
      {
        firstName: 'Lisa',
        lastName: 'Garcia',
        llcName: 'Garcia Holdings',
        phone1: '+1234567897',
        phone2: '+1234567898',
        email1: 'lisa.garcia@email.com',
        propertyAddress: '987 Cedar St, Denver, CO 80201',
        city: 'Denver',
        state: 'CO',
        propertyCounty: 'Denver',
        propertyType: 'Single Family',
        bedrooms: 3,
        totalBathrooms: 2,
        buildingSqft: 1800,
        effectiveYearBuilt: 2000,
        estValue: 420000,
        estEquity: 250000,
        dealStatus: 'qualified',
        notes: 'First-time seller, needs guidance'
      },
      {
        firstName: 'Robert',
        lastName: 'Miller',
        phone1: '+1234567899',
        email1: 'robert.miller@email.com',
        propertyAddress: '147 Birch Ave, Phoenix, AZ 85001',
        city: 'Phoenix',
        state: 'AZ',
        propertyCounty: 'Maricopa',
        propertyType: 'Ranch',
        bedrooms: 4,
        totalBathrooms: 3,
        buildingSqft: 2200,
        effectiveYearBuilt: 1990,
        estValue: 380000,
        estEquity: 200000,
        dealStatus: 'lead',
        notes: 'Inherited property, wants quick sale'
      },
      {
        firstName: 'Jennifer',
        lastName: 'Taylor',
        llcName: 'Taylor Properties',
        phone1: '+1234567800',
        email1: 'jennifer.taylor@email.com',
        email2: 'jen@taylorproperties.com',
        propertyAddress: '258 Willow St, Boston, MA 02101',
        city: 'Boston',
        state: 'MA',
        propertyCounty: 'Suffolk',
        propertyType: 'Condo',
        bedrooms: 2,
        totalBathrooms: 1,
        buildingSqft: 900,
        effectiveYearBuilt: 1920,
        estValue: 550000,
        estEquity: 400000,
        dealStatus: 'closed_won',
        notes: 'Historic building, great location'
      },
      {
        firstName: 'Christopher',
        lastName: 'Anderson',
        phone1: '+1234567801',
        phone2: '+1234567802',
        email1: 'chris.anderson@email.com',
        propertyAddress: '369 Spruce Rd, Portland, OR 97201',
        city: 'Portland',
        state: 'OR',
        propertyCounty: 'Multnomah',
        propertyType: 'Single Family',
        bedrooms: 3,
        totalBathrooms: 2,
        buildingSqft: 1600,
        effectiveYearBuilt: 1975,
        estValue: 480000,
        estEquity: 300000,
        dealStatus: 'proposal',
        notes: 'Eco-friendly features, solar panels'
      },
      {
        firstName: 'Amanda',
        lastName: 'White',
        phone1: '+1234567803',
        email1: 'amanda.white@email.com',
        propertyAddress: '741 Aspen Way, Nashville, TN 37201',
        city: 'Nashville',
        state: 'TN',
        propertyCounty: 'Davidson',
        propertyType: 'Single Family',
        bedrooms: 4,
        totalBathrooms: 3,
        buildingSqft: 2400,
        effectiveYearBuilt: 2008,
        estValue: 390000,
        estEquity: 220000,
        dealStatus: 'negotiation',
        notes: 'Recently renovated, move-in ready'
      }
    ];

    // Create contacts
    const createdContacts = await Promise.all(
      sampleContacts.map(contact => 
        prisma.contact.create({ data: contact })
      )
    );

    console.log(`Created ${createdContacts.length} sample contacts`);

    return NextResponse.json({
      success: true,
      message: `Created ${createdContacts.length} sample contacts`,
      contacts: createdContacts.map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        phone: c.phone1,
        email: c.email1
      }))
    });

  } catch (error) {
    console.error('Error creating sample contacts:', error);
    return NextResponse.json(
      { error: 'Failed to create sample contacts' },
      { status: 500 }
    );
  }
}
