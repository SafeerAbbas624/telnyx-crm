import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import { formatPhoneNumberForTelnyx, last10Digits } from '@/lib/phone-utils';
import { elasticsearchClient } from '@/lib/search/elasticsearch-client';
import { redisClient } from '@/lib/cache/redis-client';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { normalizePropertyType } from '@/lib/property-type-mapper';

// Increase timeout for large file imports (5 minutes)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Helper function to find existing contact by phone
async function findExistingContactByPhone(phone: string) {
  if (!phone) return null;

  const normalized = last10Digits(phone);
  if (!normalized || normalized.length < 10) return null;

  const contacts = await prisma.contact.findMany({
    where: {
      phone1: { endsWith: normalized }
    },
    include: {
      properties: true
    }
  });

  return contacts.length > 0 ? contacts[0] : null;
}

// Helper to split full name
function splitFullName(fullName: string | undefined) {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mappingStr = formData.get('mapping') as string;
    const tagsStr = formData.get('tags') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!mappingStr) {
      return NextResponse.json({ error: 'No mapping provided' }, { status: 400 });
    }

    const mapping: Record<string, string> = JSON.parse(mappingStr);
    const tags: string[] = tagsStr ? JSON.parse(tagsStr) : [];
    const fileContent = await file.text();

    // Save uploaded file
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${safeFileName}`;
    const filePath = join(process.cwd(), 'public', 'uploads', 'imports', fileName);
    const fileUrl = `/uploads/imports/${fileName}`;

    const buffer = Buffer.from(fileContent);
    await writeFile(filePath, buffer);
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let duplicates = 0;
    let skippedNoPhone = 0;
    let skippedOther = 0;
    const validationErrors: Array<{ row: number; error: string }> = [];

    // Build inverted mapping (fieldKey -> CSV column)
    const invertedMapping: Record<string, string> = {};
    for (const [csvCol, fieldKey] of Object.entries(mapping)) {
      invertedMapping[fieldKey] = csvCol;
    }

    // Integer fields that need conversion
    const integerFields = new Set([
      'bedrooms', 'buildingSqft', 'lotSizeSqft',
      'effectiveYearBuilt', 'estValue', 'estEquity', 'units'
    ]);

    // Decimal fields that need conversion
    const decimalFields = new Set([
      'totalBathrooms', 'lastSaleAmount', 'openMortgageBalance',
      'estRemainingBalance', 'remainingBalance'
    ]);

    // Date fields that need conversion to ISO-8601
    const dateFields = new Set(['lastSaleDate', 'mlsDate']);

    // Known system field keys
    const knownSystemFields = new Set([
      'fullName', 'firstName', 'lastName', 'llcName',
      'phone1', 'email1',
      'propertyAddress', 'fullPropertyAddress', 'contactAddress', 'contactCityStateZip',
      'city', 'state', 'zipCode', 'propertyCounty', 'propertyType',
      'bedrooms', 'totalBathrooms', 'buildingSqft', 'lotSizeSqft',
      'effectiveYearBuilt', 'lastSaleDate', 'lastSaleAmount',
      'estRemainingBalance', 'estValue', 'estEquity',
      'units', 'openMortgageBalance', 'remainingBalance', 'mlsStatus',
      'mlsDate', 'mlsAmount', 'lienAmount', 'marketingLists'
    ]);

	    // Helper function to parse dates - returns ISO-8601 DateTime string for Prisma
	    const parseDate = (dateStr: string): string | null => {
	      const cleaned = dateStr.trim();
	      if (!cleaned) return null;

	      // Skip invalid/placeholder date values
	      const invalidPatterns = [
	        /^00:00/,           // Time-like values: 00:00.0
	        /^nan$/i,           // nan
	        /^none$/i,          // none
	        /^null$/i,          // null
	        /^n\/a$/i,          // n/a
	        /^\d+:\d+/,         // Any time format like 25:43.1
	      ];

	      for (const pattern of invalidPatterns) {
	        if (pattern.test(cleaned)) return null;
	      }

	      const toIsoDateTime = (year: number, month: number, day: number): string => {
	        // Always normalize to midnight UTC to keep behavior consistent
	        const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
	        return d.toISOString();
	      };

	      let year: number, month: number, day: number;

	      // MM/DD/YY or MM/DD/YYYY format
	      const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
	      if (slashMatch) {
	        month = parseInt(slashMatch[1], 10);
	        day = parseInt(slashMatch[2], 10);
	        year = parseInt(slashMatch[3], 10);
	        if (year < 100) {
	          year = year >= 50 ? 1900 + year : 2000 + year;
	        }
	        return toIsoDateTime(year, month, day);
	      }

	      // ISO format YYYY-MM-DD
	      const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	      if (isoMatch) {
	        year = parseInt(isoMatch[1], 10);
	        month = parseInt(isoMatch[2], 10);
	        day = parseInt(isoMatch[3], 10);
	        return toIsoDateTime(year, month, day);
	      }

	      // MM-DD-YY or MM-DD-YYYY format
	      const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
	      if (dashMatch) {
	        month = parseInt(dashMatch[1], 10);
	        day = parseInt(dashMatch[2], 10);
	        year = parseInt(dashMatch[3], 10);
	        if (year < 100) {
	          year = year >= 50 ? 1900 + year : 2000 + year;
	        }
	        return toIsoDateTime(year, month, day);
	      }

	      // If it doesn't match any valid date format, return null (skip it)
	      return null;
	    };

    // Helper function to convert values with validation
    const convertValue = (fieldKey: string, rawValue: string, rowIndex: number): any => {
      const valueLower = rawValue.toLowerCase().trim();
      if (valueLower === 'nan' || valueLower === 'none' || valueLower === '' ||
          valueLower === 'null' || valueLower === 'n/a' || valueLower === 'na') {
        return null;
      }
      if (integerFields.has(fieldKey)) {
        const cleanedValue = rawValue.replace(/[^0-9.-]/g, '');
        const parsed = parseInt(cleanedValue, 10);
        return isNaN(parsed) ? null : parsed;
      }
      if (decimalFields.has(fieldKey)) {
        const cleanedValue = rawValue.replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleanedValue);
        if (isNaN(parsed)) return null;

        // Validate decimal field ranges to prevent database overflow
        if (fieldKey === 'totalBathrooms' && parsed > 9999.99) {
          throw new Error(`Row ${rowIndex}: totalBathrooms value ${parsed} exceeds maximum allowed (9999.99)`);
        }
        if (['lastSaleAmount', 'estRemainingBalance', 'estValue', 'estEquity', 'openMortgageBalance', 'remainingBalance'].includes(fieldKey) && parsed > 9999999999999.99) {
          throw new Error(`Row ${rowIndex}: ${fieldKey} value ${parsed} exceeds maximum allowed (9999999999999.99)`);
        }

        return parsed;
      }
      if (dateFields.has(fieldKey)) {
        return parseDate(rawValue);
      }
      return rawValue;
    };

    // PHASE 1: Validate all rows and prepare data for transactional insert
    const contactsToCreate: Array<{
      rowIndex: number;
      systemData: Record<string, any>;
      customFields: Record<string, any>;
    }> = [];

    // Track contacts that need additional properties added
    const propertiesToAdd: Array<{
      rowIndex: number;
      existingContactId: string;
      propertyData: Record<string, any>;
    }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;

      const rawFullName = record[invertedMapping.fullName] || '';
      const cleanedFullName = rawFullName.trim();
      const { firstName: derivedFirstName, lastName: derivedLastName } = splitFullName(cleanedFullName);

      // Filter out "nan" values from firstName/lastName
      let firstName = record[invertedMapping.firstName] || derivedFirstName;
      let lastName = record[invertedMapping.lastName] || derivedLastName;
      if (firstName && (firstName.toLowerCase() === 'nan' || firstName.toLowerCase() === 'none')) {
        firstName = '';
      }
      if (lastName && (lastName.toLowerCase() === 'nan' || lastName.toLowerCase() === 'none')) {
        lastName = '';
      }

      const fullName = cleanedFullName || `${firstName} ${lastName}`.trim();
      const phone1 = record[invertedMapping.phone1];
      const propertyAddress = record[invertedMapping.propertyAddress];

      // Skip if no phone number
      if (!phone1 || phone1.trim() === '' || phone1.toLowerCase() === 'none' || phone1.toLowerCase() === 'nan') {
        skippedNoPhone++;
        continue;
      }

      // Require at least name OR address
      if (!firstName && !lastName && !propertyAddress) {
        skippedOther++;
        continue;
      }

      // Check for duplicates by phone AND property address in database
      const existing = await findExistingContactByPhone(phone1);
      if (existing) {
        // If phone matches but property address is different, this is a new property for the same contact
        // Add it to ContactProperty table instead of marking as duplicate
        const existingAddress = existing.propertyAddress?.toLowerCase().trim();
        const newAddress = propertyAddress?.toLowerCase().trim();

        if (existingAddress && newAddress && existingAddress !== newAddress) {
          // This is a different property for the same contact
          // Extract property-specific fields to add to ContactProperty table
          const propertyData: Record<string, any> = {};

          // Get property fields from the record
          if (propertyAddress) propertyData.address = propertyAddress;
          if (record[invertedMapping.city]) propertyData.city = record[invertedMapping.city];
          if (record[invertedMapping.state]) propertyData.state = record[invertedMapping.state];
          if (record[invertedMapping.propertyCounty]) propertyData.county = record[invertedMapping.propertyCounty];
          if (record[invertedMapping.propertyType]) propertyData.propertyType = normalizePropertyType(record[invertedMapping.propertyType]);

          // Convert numeric fields
          try {
            if (record[invertedMapping.bedrooms]) {
              const val = convertValue('bedrooms', record[invertedMapping.bedrooms], i + 2);
              if (val !== null) propertyData.bedrooms = val;
            }
            if (record[invertedMapping.totalBathrooms]) {
              const val = convertValue('totalBathrooms', record[invertedMapping.totalBathrooms], i + 2);
              if (val !== null) propertyData.totalBathrooms = Math.floor(val); // ContactProperty expects Int
            }
            if (record[invertedMapping.buildingSqft]) {
              const val = convertValue('buildingSqft', record[invertedMapping.buildingSqft], i + 2);
              if (val !== null) propertyData.buildingSqft = val;
            }
            if (record[invertedMapping.effectiveYearBuilt]) {
              const val = convertValue('effectiveYearBuilt', record[invertedMapping.effectiveYearBuilt], i + 2);
              if (val !== null) propertyData.effectiveYearBuilt = val;
            }
            if (record[invertedMapping.estValue]) {
              const val = convertValue('estValue', record[invertedMapping.estValue], i + 2);
              if (val !== null) propertyData.estValue = val;
            }
            if (record[invertedMapping.estEquity]) {
              const val = convertValue('estEquity', record[invertedMapping.estEquity], i + 2);
              if (val !== null) propertyData.estEquity = val;
            }
          } catch (error) {
            // Skip this property if conversion fails
            validationErrors.push({
              row: i + 2,
              error: `Property field conversion error: ${error instanceof Error ? error.message : String(error)}`
            });
            skippedOther++;
            continue;
          }

          propertiesToAdd.push({
            rowIndex: i + 2,
            existingContactId: existing.id,
            propertyData
          });

          // Don't mark as duplicate - we're adding a new property
          continue;
        } else {
          // Same phone and same (or no) property address = true duplicate
          duplicates++;
          continue;
        }
      }

      // REMOVED: Check for duplicates within the file
      // We now allow multiple rows with the same phone number to be imported
      // The database will handle true duplicates (same phone + same property address)

      // Build system fields data
      const systemData: Record<string, any> = {
        fullName,
        firstName,
        lastName
      };

      // Map all system fields from CSV - skip only bad fields, not the whole contact
      for (const [fieldKey, csvCol] of Object.entries(invertedMapping)) {
        if (!knownSystemFields.has(fieldKey)) continue;
        if (fieldKey === 'firstName' || fieldKey === 'lastName' || fieldKey === 'fullName') continue;

        const rawValue = record[csvCol];
        if (rawValue === undefined || rawValue === null) continue;

        try {
          const value = convertValue(fieldKey, String(rawValue), i + 2);
          if (value === null) continue;
          systemData[fieldKey] = value;
        } catch (error) {
          // Log the error but continue processing other fields
          validationErrors.push({
            row: i + 2,
            error: `Field '${fieldKey}': ${error instanceof Error ? error.message : String(error)}`
          });
          // Set field to null instead of skipping entire contact
          systemData[fieldKey] = null;
        }
      }

      // Normalize phone number
      if (systemData.phone1) systemData.phone1 = formatPhoneNumberForTelnyx(systemData.phone1);

      // Generate Full Property Address from components
      const addressParts: string[] = [];
      if (systemData.propertyAddress) addressParts.push(systemData.propertyAddress);

      const cityState: string[] = [];
      if (systemData.city) cityState.push(systemData.city);
      if (systemData.state) cityState.push(systemData.state);
      if (cityState.length > 0) addressParts.push(cityState.join(', '));

      if (systemData.zip) addressParts.push(systemData.zip);

      if (addressParts.length > 0) {
        systemData.fullPropertyAddress = addressParts.join(' ');
      }

      // Build custom fields data
      const customFields: Record<string, any> = {};
      for (const [fieldKey, csvCol] of Object.entries(invertedMapping)) {
        if (knownSystemFields.has(fieldKey)) continue;

        if (record[csvCol]) {
          const value = record[csvCol];
          const valueLower = typeof value === 'string' ? value.toLowerCase().trim() : '';
          if (valueLower === 'nan' || valueLower === 'none' || valueLower === '' ||
              valueLower === 'null' || valueLower === 'n/a' || valueLower === 'na') {
            continue;
          }
          customFields[fieldKey] = value;
        }
      }

      contactsToCreate.push({
        rowIndex: i + 2,
        systemData,
        customFields
      });
    }

    // PHASE 2: Create contacts in transaction, handle properties separately
    let imported = 0;
    const createdContacts: Array<{ id: string; firstName?: string; lastName?: string; phone1?: string }> = [];

    // Pre-create/find tags OUTSIDE transaction (one-time operation)
    const tagMap = new Map<string, string>();
    if (tags.length > 0) {
      for (const tagName of tags) {
        let tag = await prisma.tag.findFirst({ where: { name: tagName } });
        if (!tag) {
          tag = await prisma.tag.create({ data: { name: tagName, color: '#3b82f6' } });
        }
        tagMap.set(tagName, tag.id);
      }
    }

    // Create contacts in main transaction
    if (contactsToCreate.length > 0) {
      try {
        // Use Prisma transaction for atomic operation - ONLY for new contacts
        await prisma.$transaction(async (tx) => {
          for (const { rowIndex, systemData, customFields } of contactsToCreate) {
            const contact = await tx.contact.create({
              data: {
                ...systemData,
                customFields: Object.keys(customFields).length > 0 ? customFields : undefined
              }
            });

            // Apply tags
            for (const tagName of tags) {
              const tagId = tagMap.get(tagName);
              if (tagId) {
                await tx.contactTag.create({
                  data: { contact_id: contact.id, tag_id: tagId }
                }).catch(() => {}); // Ignore duplicate tag errors
              }
            }

            createdContacts.push({
              id: contact.id,
              firstName: contact.firstName || undefined,
              lastName: contact.lastName || undefined,
              phone1: contact.phone1 || undefined
            });
            imported++;
          }
        }, {
          timeout: 300000 // 5 minute timeout for large imports
        });
      } catch (txError) {
        // Transaction failed - no contacts were created
        console.error('Transaction failed:', txError);
        validationErrors.push({
          row: 0,
          error: `Import failed: ${txError instanceof Error ? txError.message : 'Unknown error'}. No contacts were imported.`
        });
        imported = 0;
      }
    }

    // PHASE 3: Add properties to existing contacts OUTSIDE the main transaction
    // Each property addition is independent - failures don't affect other properties
    if (propertiesToAdd.length > 0) {
      // Ensure "Multiple property" tag exists
      let multiPropTag = await prisma.tag.findFirst({ where: { name: 'Multiple property' } });
      if (!multiPropTag) {
        multiPropTag = await prisma.tag.create({ data: { name: 'Multiple property', color: '#3b82f6' } });
      }

      for (const { rowIndex, existingContactId, propertyData } of propertiesToAdd) {
        try {
          // Check if this property already exists for this contact
          const existingProperty = await prisma.contactProperty.findFirst({
            where: {
              contactId: existingContactId,
              address: propertyData.address
            }
          });

          if (!existingProperty) {
            await prisma.contactProperty.create({
              data: {
                contactId: existingContactId,
                ...propertyData
              }
            });

            // Apply tags to the existing contact
            for (const tagName of tags) {
              const tagId = tagMap.get(tagName);
              if (tagId) {
                await prisma.contactTag.create({
                  data: { contact_id: existingContactId, tag_id: tagId }
                }).catch(() => {}); // Ignore duplicate tag errors
              }
            }

            // Add "Multiple property" tag
            await prisma.contactTag.create({
              data: { contact_id: existingContactId, tag_id: multiPropTag.id }
            }).catch(() => {}); // Ignore duplicate tag errors

            imported++; // Count as imported since we added a new property
          } else {
            duplicates++; // Same contact, same property = duplicate
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          validationErrors.push({
            row: rowIndex,
            error: `Property add error: ${errorMsg}`
          });
          skippedOther++;
        }
      }

      // Index in Elasticsearch AFTER transaction (completely non-critical, outside transaction scope)
      if (createdContacts.length > 0) {
        // Fire and forget - don't await to avoid blocking import response
        (async () => {
          for (const contact of createdContacts) {
            try {
              await elasticsearchClient.indexContact({
                id: contact.id,
                firstName: contact.firstName,
                lastName: contact.lastName,
                fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
                phone1: contact.phone1,
                tags: tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            } catch (esError) {
              // Silently ignore ES errors - import succeeded
              console.warn('Elasticsearch indexing skipped (ES may be down)');
              break; // Stop trying if ES is down
            }
          }
        })().catch(() => {});
      }
    }

    // Invalidate cache
    try {
      await redisClient.invalidateSearchCache();
    } catch (redisError) {
      console.error('Redis error:', redisError);
    }

    // Save import history
    try {
      await prisma.importHistory.create({
        data: {
          fileName: file.name,
          fileUrl: fileUrl,
          tags: tags,
          importedAt: new Date(),
          totalRecords: records.length,
          importedCount: imported,
          duplicateCount: duplicates,
          missingPhoneCount: skippedNoPhone,
          errors: validationErrors.length > 0 ? validationErrors : undefined
        }
      });
    } catch (historyError) {
      console.error('Failed to save import history:', historyError);
    }

    return NextResponse.json({
      success: imported > 0,
      imported,
      duplicates,
      skippedNoPhone,
      skippedOther,
      errors: validationErrors.slice(0, 5),
      totalErrors: validationErrors.length
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

