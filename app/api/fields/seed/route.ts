import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/fields/seed - Seed default system fields
export async function POST() {
  try {
    // Fields to delete (they should not exist)
    const fieldsToDelete = [
      'phone2', 'phone3', 'email2', 'email3',  // Alternate phones/emails
      'dealStatus', 'dnc', 'dncReason', 'notes'  // Other fields to remove
    ];

    // Delete unwanted fields
    await prisma.fieldDefinition.deleteMany({
      where: { fieldKey: { in: fieldsToDelete } }
    });

    const systemFields = [
      // Basic Information - Full Name is required, First/Last Name are auto-derived
      { name: 'Full Name', fieldKey: 'fullName', fieldType: 'text', category: 'Basic Information', isSystem: true, isRequired: true, displayOrder: 1 },
      { name: 'First Name', fieldKey: 'firstName', fieldType: 'text', category: 'Basic Information', isSystem: true, displayOrder: 2 },
      { name: 'Last Name', fieldKey: 'lastName', fieldType: 'text', category: 'Basic Information', isSystem: true, displayOrder: 3 },
      { name: 'LLC Name', fieldKey: 'llcName', fieldType: 'text', category: 'Basic Information', isSystem: true, displayOrder: 4 },

      // Contact Information - Only Primary Phone and Primary Email
      { name: 'Primary Phone', fieldKey: 'phone1', fieldType: 'phone', category: 'Contact Information', isSystem: true, isRequired: true, displayOrder: 10 },
      { name: 'Primary Email', fieldKey: 'email1', fieldType: 'email', category: 'Contact Information', isSystem: true, displayOrder: 11 },
      { name: 'Contact Address (Street)', fieldKey: 'contactAddress', fieldType: 'text', category: 'Contact Information', isSystem: true, displayOrder: 12 },
      { name: 'Contact Address (City, State, Zip)', fieldKey: 'contactCityStateZip', fieldType: 'text', category: 'Contact Information', isSystem: true, displayOrder: 13 },

      // Property Address
      { name: 'Property Address', fieldKey: 'propertyAddress', fieldType: 'text', category: 'Property Address', isSystem: true, displayOrder: 20 },
      { name: 'City', fieldKey: 'city', fieldType: 'text', category: 'Property Address', isSystem: true, displayOrder: 21 },
      { name: 'State', fieldKey: 'state', fieldType: 'text', category: 'Property Address', isSystem: true, displayOrder: 22 },
      { name: 'Zip Code', fieldKey: 'zipCode', fieldType: 'text', category: 'Property Address', isSystem: true, displayOrder: 23 },
      { name: 'County', fieldKey: 'propertyCounty', fieldType: 'text', category: 'Property Address', isSystem: true, displayOrder: 24 },

      // Property Details
      { name: 'Property Type', fieldKey: 'propertyType', fieldType: 'select', category: 'Property Details', isSystem: true, displayOrder: 30,
        options: ['Single-family (SFR)', 'Duplex', 'Triplex', 'Quadplex', 'Townhouse', 'Condominium (Condo)', 'Multifamily (5+ units)'] },
      { name: 'Bedrooms', fieldKey: 'bedrooms', fieldType: 'number', category: 'Property Details', isSystem: true, displayOrder: 31 },
      { name: 'Bathrooms', fieldKey: 'totalBathrooms', fieldType: 'decimal', category: 'Property Details', isSystem: true, displayOrder: 32 },
      { name: 'Square Footage', fieldKey: 'buildingSqft', fieldType: 'number', category: 'Property Details', isSystem: true, displayOrder: 33 },
      { name: 'Lot Size Sqft', fieldKey: 'lotSizeSqft', fieldType: 'number', category: 'Property Details', isSystem: true, displayOrder: 34 },
      { name: 'Year Built', fieldKey: 'effectiveYearBuilt', fieldType: 'number', category: 'Property Details', isSystem: true, displayOrder: 35 },
      { name: 'Units', fieldKey: 'units', fieldType: 'number', category: 'Property Details', isSystem: true, displayOrder: 36 },

      // Financial Information
      { name: 'Last Sale Date', fieldKey: 'lastSaleDate', fieldType: 'date', category: 'Financial Information', isSystem: true, displayOrder: 40 },
      { name: 'Last Sale Amount', fieldKey: 'lastSaleAmount', fieldType: 'currency', category: 'Financial Information', isSystem: true, displayOrder: 41 },
      { name: 'Est. Remaining Balance', fieldKey: 'estRemainingBalance', fieldType: 'currency', category: 'Financial Information', isSystem: true, displayOrder: 42 },
      { name: 'Estimated Value', fieldKey: 'estValue', fieldType: 'currency', category: 'Financial Information', isSystem: true, displayOrder: 43 },
      { name: 'Estimated Equity', fieldKey: 'estEquity', fieldType: 'currency', category: 'Financial Information', isSystem: true, displayOrder: 44 },
    ];

    const results = [];
    for (const field of systemFields) {
      const existing = await prisma.fieldDefinition.findUnique({
        where: { fieldKey: field.fieldKey }
      });

      if (!existing) {
        const created = await prisma.fieldDefinition.create({
          data: field as any
        });
        results.push({ action: 'created', ...created });
      } else {
        // Update existing field with new values
        const updated = await prisma.fieldDefinition.update({
          where: { fieldKey: field.fieldKey },
          data: {
            name: field.name,
            fieldType: field.fieldType as any,
            category: field.category,
            isSystem: field.isSystem,
            isRequired: field.isRequired || false,
            displayOrder: field.displayOrder,
            options: field.options || null,
          }
        });
        results.push({ action: 'updated', ...updated });
      }
    }

    // Update Contact Address name if it exists
    await prisma.fieldDefinition.updateMany({
      where: { fieldKey: 'contactAddress' },
      data: { name: 'Contact Address (Street)' }
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} system fields`,
      fields: results
    });
  } catch (error) {
    console.error('Error seeding fields:', error);
    return NextResponse.json(
      { error: 'Failed to seed fields', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

