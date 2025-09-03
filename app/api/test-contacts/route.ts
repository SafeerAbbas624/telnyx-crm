import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const contactCount = await prisma.contact.count();
    console.log(`Total contacts in database: ${contactCount}`);
    
    // Get first few contacts with all fields
    const contacts = await prisma.contact.findMany({
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        llcName: true,
        phone1: true,
        phone2: true,
        phone3: true,
        email1: true,
        email2: true,
        email3: true,
        propertyAddress: true,
        city: true,
        state: true,
        propertyCounty: true,
        propertyType: true,
        bedrooms: true,
        totalBathrooms: true,
        buildingSqft: true,
        effectiveYearBuilt: true,
        estValue: true,
        estEquity: true,
        dnc: true,
        dncReason: true,
        dealStatus: true,
        notes: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    console.log('Sample contacts:', contacts);
    
    return NextResponse.json({
      success: true,
      totalContacts: contactCount,
      sampleContacts: contacts,
      message: `Found ${contactCount} contacts in database`
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
