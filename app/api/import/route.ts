import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import type { Contact, ImportHistory, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { formatPhoneNumberForTelnyx, last10Digits } from '@/lib/phone-utils';

interface CsvRecord {
  [key: string]: string | undefined;
}

interface ImportResult {
  id: string;
  fileName: string;
  importedAt: Date;
  totalRecords: number;
  importedCount: number;
  duplicateCount: number;
  missingPhoneCount: number;
  errors: Array<{ row: number; error: string }>;
}

// Normalize property type values
function normalizePropertyType(type: string | undefined): string {
  if (!type) return '';
  
  const typeLower = type.toLowerCase().trim();
  
  if (typeLower.includes('single') && typeLower.includes('family')) return 'Single Family';
  if (typeLower.includes('duplex') || typeLower.includes('2 unit')) return 'Duplex';
  if (typeLower.includes('triplex') || typeLower.includes('3 unit')) return 'Triplex';
  if (typeLower.includes('quadruplex') || typeLower.includes('4 unit')) return 'Quadplex';
  if (typeLower.includes('multi') || typeLower.includes('5+')) return 'Multi Family 5+';
  
  return type; // Return original if no match found
}

// Split full name into first and last name
function splitFullName(fullName: string | undefined): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  
  const lastName = parts.pop() || '';
  const firstName = parts.join(' ');
  
  return { firstName, lastName };
}

// Check if a contact already exists in the database by phone (normalized)
async function findExistingContactByPhone(phone: string) {
  const normalized = formatPhoneNumberForTelnyx(phone || '')
  const last10 = last10Digits(phone)

  // Try exact match across phone1..3
  if (normalized) {
    const byExact = await prisma.contact.findFirst({
      where: { OR: [{ phone1: normalized }, { phone2: normalized }, { phone3: normalized }] }
    })
    if (byExact) return byExact
  }

  // Fallback: DB-side digits-only ends-with (handles messy stored formats)
  if (last10 && prisma.$queryRaw) {
    try {
      const rows: Array<{ id: string }> = await prisma.$queryRaw`
        SELECT id FROM contacts
        WHERE regexp_replace(COALESCE(phone1, ''), '\\D', '', 'g') LIKE ${'%' + last10}
           OR regexp_replace(COALESCE(phone2, ''), '\\D', '', 'g') LIKE ${'%' + last10}
           OR regexp_replace(COALESCE(phone3, ''), '\\D', '', 'g') LIKE ${'%' + last10}
        LIMIT 1`
      if (rows && rows.length > 0) {
        const found = await prisma.contact.findUnique({ where: { id: rows[0].id } })
        if (found) return found
      }
    } catch (e) {
      console.warn('Digits-only import lookup failed:', e)
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mapping = JSON.parse(formData.get('mapping') as string) as Record<string, string>;
    const rawTags = (formData.get('tags') as string | null) || "";

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(buffer);

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRecord[];
    
    // Parse per-file tags once and create/find Tag records
    const tagNames = Array.from(new Set(
      rawTags
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(Boolean)
    ));

    const tagRecords = tagNames.length > 0
      ? await Promise.all(
          tagNames.map((name) =>
            prisma.tag.upsert({
              where: { name },
              update: {},
              create: { name },
            })
          )
        )
      : [];

    const importId = uuidv4();
    const result: ImportResult = {
      id: importId,
      fileName: file.name,
      importedAt: new Date(),
      totalRecords: records.length,
      importedCount: 0,
      duplicateCount: 0,
      missingPhoneCount: 0,
      errors: [],
    };

    const skippedRecords: {row: number; reason: string}[] = [];

    const invertedMapping: { [key:string]: string } = {};
    for (const key in mapping) {
      invertedMapping[mapping[key]] = key;
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 for 1-based index and header row
      
      try {
                const { firstName, lastName } = splitFullName(record[invertedMapping.fullName]);
        const rawPhone1 = record[invertedMapping.phone1] || '';
        const rawPhone2 = record[invertedMapping.phone2] || '';
        const rawPhone3 = record[invertedMapping.phone3] || '';

        const phone1 = formatPhoneNumberForTelnyx(rawPhone1) || '';
        const phone2 = formatPhoneNumberForTelnyx(rawPhone2) || null;
        const phone3 = formatPhoneNumberForTelnyx(rawPhone3) || null;

        if (!phone1) {
          result.missingPhoneCount++;
          skippedRecords.push({ row: rowNumber, reason: 'Missing phone number' });
          continue;
        }

        const propertyAddress = record[invertedMapping.propertyStreet] || record[invertedMapping.propertyAddress] || null;
        const existingContact = await findExistingContactByPhone(phone1);

        if (existingContact) {
          // Check if property address is different
          if (propertyAddress && existingContact.propertyAddress !== propertyAddress) {
            // Update existing contact with new property address (person has multiple properties)
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                propertyAddress: propertyAddress,
                city: record[invertedMapping.propertyCity] || existingContact.city,
                state: record[invertedMapping.propertyState] || existingContact.state,
                propertyCounty: record[invertedMapping.propertyCounty] || existingContact.propertyCounty,
                propertyType: normalizePropertyType(record[invertedMapping.propertyType] || '') || existingContact.propertyType,
                bedrooms: record[invertedMapping.bedrooms] ? parseInt(record[invertedMapping.bedrooms]!.replace(/[^0-9.]/g, ''), 10) : existingContact.bedrooms,
                totalBathrooms: record[invertedMapping.bathrooms] ? new Decimal(parseFloat(record[invertedMapping.bathrooms]!.replace(/[^0-9.]/g, '') || '0')) : existingContact.totalBathrooms,
                buildingSqft: record[invertedMapping.buildingSqft] ? parseInt(record[invertedMapping.buildingSqft]!.replace(/[^0-9.]/g, ''), 10) : existingContact.buildingSqft,
                effectiveYearBuilt: record[invertedMapping.yearBuilt] ? parseInt(record[invertedMapping.yearBuilt]!.replace(/[^0-9]/g, ''), 10) : existingContact.effectiveYearBuilt,
                estValue: record[invertedMapping.estimatedValue] ? new Decimal(parseFloat(record[invertedMapping.estimatedValue]!.replace(/[^0-9.]/g, '') || '0')) : existingContact.estValue,
                estEquity: record[invertedMapping.estimatedEquity] ? new Decimal(parseFloat(record[invertedMapping.estimatedEquity]!.replace(/[^0-9.]/g, '') || '0')) : existingContact.estEquity,
                // Update contact address if provided
                contactAddress: record[invertedMapping.contactAddress] || existingContact.contactAddress,
              },
            });
            // Attach per-file tags to the existing contact
            if (tagRecords.length > 0) {
              await prisma.contactTag.createMany({
                data: tagRecords.map(t => ({ contact_id: existingContact.id, tag_id: t.id })),
                skipDuplicates: true,
              });
            }
            result.importedCount++;
          } else {
            // Same person, same property - this is a true duplicate
            // Still attach per-file tags to the existing contact
            if (tagRecords.length > 0) {
              await prisma.contactTag.createMany({
                data: tagRecords.map(t => ({ contact_id: existingContact.id, tag_id: t.id })),
                skipDuplicates: true,
              });
            }
            result.duplicateCount++;
            skippedRecords.push({ row: rowNumber, reason: 'Duplicate contact with same property' });
            continue;
          }
        } else {
          // New contact
          const contactData: Prisma.ContactCreateInput = {
            firstName,
            lastName,
            phone1,
            phone2,
            phone3,
            email1: record[invertedMapping.email1] || null,
            email2: record[invertedMapping.email2] || null,
            email3: record[invertedMapping.email3] || null,
            llcName: record[invertedMapping.llcName] || null,
            propertyAddress: propertyAddress,
            contactAddress: record[invertedMapping.contactAddress] || null,
            city: record[invertedMapping.propertyCity] || null,
            state: record[invertedMapping.propertyState] || null,
            propertyCounty: record[invertedMapping.propertyCounty] || null,
            propertyType: normalizePropertyType(record[invertedMapping.propertyType] || ''),
            bedrooms: record[invertedMapping.bedrooms] ? parseInt(record[invertedMapping.bedrooms]!.replace(/[^0-9.]/g, ''), 10) : null,
            totalBathrooms: record[invertedMapping.bathrooms] ? new Decimal(parseFloat(record[invertedMapping.bathrooms]!.replace(/[^0-9.]/g, '') || '0')) : null,
            buildingSqft: record[invertedMapping.buildingSqft] ? parseInt(record[invertedMapping.buildingSqft]!.replace(/[^0-9.]/g, ''), 10) : null,
            effectiveYearBuilt: record[invertedMapping.yearBuilt] ? parseInt(record[invertedMapping.yearBuilt]!.replace(/[^0-9]/g, ''), 10) : null,
            estValue: record[invertedMapping.estimatedValue] ? new Decimal(parseFloat(record[invertedMapping.estimatedValue]!.replace(/[^0-9.]/g, '') || '0')) : null,
            estEquity: record[invertedMapping.estimatedEquity] ? new Decimal(parseFloat(record[invertedMapping.estimatedEquity]!.replace(/[^0-9.]/g, '') || '0')) : null,
            dnc: record[invertedMapping.dnc] ? record[invertedMapping.dnc]!.toLowerCase() === 'true' : false,
            dncReason: record[invertedMapping.dncReason] || null,
            dealStatus: 'lead',
            avatarUrl: record[invertedMapping.avatarUrl] || null,
          };

          const created = await prisma.contact.create({ data: contactData });
          // Attach per-file tags to the new contact
          if (tagRecords.length > 0) {
            await prisma.contactTag.createMany({
              data: tagRecords.map(t => ({ contact_id: created.id, tag_id: t.id })),
              skipDuplicates: true,
            });
          }
          result.importedCount++;
        }

      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown processing error',
        });
      }
    }

    await prisma.importHistory.create({
      data: {
        id: result.id,
        fileName: result.fileName,
        importedAt: result.importedAt,
        totalRecords: result.totalRecords,
        importedCount: result.importedCount,
        duplicateCount: result.duplicateCount,
        missingPhoneCount: result.missingPhoneCount,
        errors: JSON.stringify(result.errors),
      },
    });
    
    return NextResponse.json({
      success: true,
      imported: result.importedCount,
      total: result.totalRecords,
      duplicates: result.duplicateCount,
      missingPhones: result.missingPhoneCount,
      errors: result.errors.length,
      skipped: skippedRecords.length,
      importId,
    });

  } catch (error) {
    console.error('Import error:', error);
    
    const errorMessage = 'Failed to process import';
    const errorDetails = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve import history
export async function GET() {
  try {
    const history = await prisma.importHistory.findMany({
      orderBy: { importedAt: 'desc' },
      take: 50,
    });

    const formattedHistory = history.map((record: ImportHistory) => {
      let errors = [];
      try {
        if (typeof record.errors === 'string') {
          errors = JSON.parse(record.errors);
        } else if (Array.isArray(record.errors)) {
          errors = record.errors;
        }
      } catch (e) {
        // ignore parse error
      }

      return {
        id: record.id,
        fileName: record.fileName,
        importedAt: record.importedAt,
        totalRecords: record.totalRecords,
        imported: record.importedCount,
        duplicates: record.duplicateCount,
        missingPhones: record.missingPhoneCount,
        skipped: record.totalRecords - record.importedCount,
        errorCount: errors.length,
        firstFewErrors: errors.slice(0, 5),
      };
    });

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching import history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
