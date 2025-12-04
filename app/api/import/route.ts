import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import type { Contact, ImportHistory, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { formatPhoneNumberForTelnyx, last10Digits } from '@/lib/phone-utils';
import { redisClient } from '@/lib/cache/redis-client';
import { elasticsearchClient } from '@/lib/search/elasticsearch-client';

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

// Strict property type normalization to allowed labels only
function normalizePropertyTypeStrict(input: string | undefined): string | null {
  if (!input) return null;
  const s = input.toLowerCase().trim();

  const hasAll = (tokens: string[]) => tokens.every(t => s.includes(t));
  const any = (tokens: string[]) => tokens.some(t => s.includes(t));

  // Duplex/Triplex/Quad first to avoid matching generic multi-family
  // "Duplex (2 units, any combination)" -> "Duplex"
  if (any(['duplex', 'two-family', 'two family', '2 unit', 'semi-detached', 'twin home', 'double house', '(2 units']))
    return 'Duplex';
  if (any(['triplex', 'three-family', 'three family', '3 unit', 'three-flat', 'triple-decker']))
    return 'Triplex';
  if (any(['quadplex', 'quadruplex', 'fourplex', 'four-family', 'four family', '4 unit', 'four-flat']))
    return 'Quadplex';

  // Townhouse
  if (any(['townhouse', 'townhome', 'row house', 'rowhouse', 'rowhome', 'terraced house', 'attached house']))
    return 'Townhouse';

  // Condominium (Condo)
  // "Condominium (Residential)" -> "Condo"
  if (any(['condominium', 'condo', 'condo unit', 'strata title', 'co-op', 'cooperative']) || (s.includes('apartment') && !s.includes('building') && !s.includes('complex')))
    return 'Condo';

  // Multi-family (2+ units) - Generic multi-family dwellings
  // "Multi-Family Dwellings (Generic, 2+)" -> "Multi-Family 2+ units"
  if (any(['multi-family dwellings', 'multi family dwellings', 'generic, 2+', 'generic 2+']) ||
      (s.includes('multi') && s.includes('family') && (s.includes('2+') || s.includes('generic'))))
    return 'Multi-Family 2+ units';

  // Multi-family (5+ units)
  if (any(['apartment building', 'apartment complex', 'multi-dwelling', 'residential complex', 'high-rise', 'high rise', 'mid-rise', 'mid rise', 'walk-up', 'tenement']) ||
      (s.includes('multi') && s.includes('family') && (s.includes('5') || s.includes('5+'))))
    return 'Multifamily (5+ units)';

  // Single-family (SFR)
  // "Single Family Residential" -> "Single-Fam"
  if (hasAll(['single','family']) || any(['single-family','sfr','single-family dwelling','sfd','detached house','standalone house','single-detached','single family residential','single-family residence']))
    return 'Single-Fam';

  return null;
}

// Split: first token = firstName; everything after = lastName (middle names go to lastName)
function splitFullName(fullName: string | undefined): { firstName: string; lastName: string } {
  const raw = (fullName || '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

// Parse bathrooms into a safe Decimal(4,2) range [0, 99.99]
function parseBathroomsDecimal(raw: string | undefined | null): Decimal | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  let n = parseFloat(cleaned);
  if (!isFinite(n)) return null;
  if (n < 0) n = 0;
  if (n > 99.99) n = 99.99; // prevent Prisma Decimal(4,2) overflow
  const rounded = Math.round(n * 100) / 100; // 2-decimal rounding
  return new Decimal(rounded);
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

    // Build inverted mapping (field ID -> CSV column header)
    const invertedMapping: { [key:string]: string } = {};
    for (const key in mapping) {
      invertedMapping[mapping[key]] = key;
    }

    // Parse per-file tags once and create/find Tag records
    // Split by comma only (not spaces), since tags can contain spaces
    const tagNames = Array.from(new Set(
      rawTags
        .split(',')
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

    // Check if there's a "tags" column mapped in the CSV
    const tagsColumnHeader = invertedMapping['tags'] || null;

    // Cache contacts by normalized phone for this import run to reduce DB lookups
    const processedIds = new Set<string>();

    const contactCache = new Map<string, Contact | null>();

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

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // +2 for 1-based index and header row

      try {
        const { firstName, lastName } = splitFullName(record[invertedMapping.fullName]);

        const rawPhones = [
          record[invertedMapping.phone1] || '',
          record[invertedMapping.phone2] || '',
          record[invertedMapping.phone3] || '',
        ];
        const normalizedPhones = rawPhones
          .map(p => formatPhoneNumberForTelnyx(p))
          .filter((p): p is string => !!p);
        const uniquePhones = Array.from(new Set(normalizedPhones));
        const phone1 = uniquePhones[0] || '';
        const phone2 = uniquePhones[1] || null;
        const phone3 = uniquePhones[2] || null;

        if (!phone1) {
          result.missingPhoneCount++;
          skippedRecords.push({ row: rowNumber, reason: 'Missing phone number' });
          continue;
        }

        const propertyAddress = record[invertedMapping.propertyStreet] || record[invertedMapping.propertyAddress] || null;

        // Try cache first, then DB
        let existingContact = contactCache.get(phone1) || null;
        if (existingContact === undefined || existingContact === null) {
          existingContact = await findExistingContactByPhone(phone1);
          contactCache.set(phone1, existingContact);
        }

        // Parse property details once
        const parsedBedrooms = record[invertedMapping.bedrooms] ? parseInt(record[invertedMapping.bedrooms]!.replace(/[^0-9.]/g, ''), 10) : null;
        const parsedBathroomsInt = record[invertedMapping.bathrooms]
          ? Math.round(parseFloat(record[invertedMapping.bathrooms]!.replace(/[^0-9.]/g, '') || '0'))
          : null;
        const parsedBuildingSqft = record[invertedMapping.buildingSqft] ? parseInt(record[invertedMapping.buildingSqft]!.replace(/[^0-9.]/g, ''), 10) : null;
        const parsedYearBuilt = record[invertedMapping.yearBuilt] ? parseInt(record[invertedMapping.yearBuilt]!.replace(/[^0-9]/g, ''), 10) : null;
        const parsedEstValueInt = record[invertedMapping.estimatedValue]
          ? Math.round(parseFloat(record[invertedMapping.estimatedValue]!.replace(/[^0-9.]/g, '') || '0'))
          : null;
        const parsedEstEquityInt = record[invertedMapping.estimatedEquity]
          ? Math.round(parseFloat(record[invertedMapping.estimatedEquity]!.replace(/[^0-9.]/g, '') || '0'))
          : null;
        const normalizedPropType = normalizePropertyTypeStrict(record[invertedMapping.propertyType] || undefined);

        if (existingContact) {
          // Rule 5: If row name is Unknown, update the existing (likely placeholder) contact with available details
          const rowFirstIsUnknown = (firstName || '').trim().toLowerCase().startsWith('unknown');
          if (rowFirstIsUnknown) {
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                // Do not overwrite names if the row is "Unknown"; update other details
                llcName: record[invertedMapping.llcName] || existingContact.llcName,
                email1: record[invertedMapping.email1] || existingContact.email1,
                email2: record[invertedMapping.email2] || existingContact.email2,
                email3: record[invertedMapping.email3] || existingContact.email3,
                contactAddress: record[invertedMapping.contactAddress] || existingContact.contactAddress,
                dnc: record[invertedMapping.dnc] ? record[invertedMapping.dnc]!.toLowerCase() === 'true' : existingContact.dnc,
                dncReason: record[invertedMapping.dncReason] || existingContact.dncReason,
                avatarUrl: record[invertedMapping.avatarUrl] || existingContact.avatarUrl,
              },
            });
            processedIds.add(existingContact.id);
          }

          // Collect all tags to attach: bulk tags + CSV-mapped tags
          const allTagsToAttach = [...tagRecords];

          // Process CSV-mapped tags if a tags column is mapped
          if (tagsColumnHeader && record[tagsColumnHeader]) {
            const csvTagNames = Array.from(new Set(
              record[tagsColumnHeader]!
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
            ));

            if (csvTagNames.length > 0) {
              const csvTagRecords = await Promise.all(
                csvTagNames.map((name) =>
                  prisma.tag.upsert({
                    where: { name },
                    update: {},
                    create: { name },
                  })
                )
              );
              allTagsToAttach.push(...csvTagRecords);
            }
          }

          // Attach all tags to the existing contact
          if (allTagsToAttach.length > 0) {
            await prisma.contactTag.createMany({
              data: allTagsToAttach.map(t => ({ contact_id: existingContact.id, tag_id: t.id })),
              skipDuplicates: true,
            });
            processedIds.add(existingContact.id);
          }

          // If there's a property address, add as additional property if not already present
          // LLC for this property row
          const rowLlcName = record[invertedMapping.llcName] || null;

          if (propertyAddress) {
            const already = await prisma.contactProperty.findFirst({
              where: { contactId: existingContact.id, address: propertyAddress },
            });
            if (!already) {
              await prisma.contactProperty.create({
                data: {
                  contactId: existingContact.id,
                  address: propertyAddress,
                  city: record[invertedMapping.propertyCity] || null,
                  state: record[invertedMapping.propertyState] || null,
                  county: record[invertedMapping.propertyCounty] || null,
                  llcName: rowLlcName,
                  propertyType: normalizedPropType,
                  bedrooms: parsedBedrooms,
                  totalBathrooms: parsedBathroomsInt,
                  buildingSqft: parsedBuildingSqft,
                  effectiveYearBuilt: parsedYearBuilt,
                  estValue: parsedEstValueInt,
                  estEquity: parsedEstEquityInt,
                },
              });

              // Check if this contact now has multiple properties
              const propertyCount = await prisma.contactProperty.count({
                where: { contactId: existingContact.id },
              });

              // If contact has multiple properties, add "Multiple property" tag
              if (propertyCount > 1) {
                const multiPropTag = await prisma.tag.upsert({
                  where: { name: 'Multiple property' },
                  update: {},
                  create: { name: 'Multiple property' },
                });

                await prisma.contactTag.create({
                  data: {
                    contact_id: existingContact.id,
                    tag_id: multiPropTag.id,
                  },
                  skipDuplicates: true,
                });
              }

              // DO NOT update the contact's main property fields
              // Keep the original property information intact
              // Additional properties are stored in the ContactProperty table
              processedIds.add(existingContact.id);

              result.importedCount++;
            } else {
              result.duplicateCount++;
              skippedRecords.push({ row: rowNumber, reason: 'Duplicate property for contact' });
              continue;
            }
          } else {
            // No property in this row; treat as duplicate (we may have updated details/tags above)
            result.duplicateCount++;
            skippedRecords.push({ row: rowNumber, reason: 'Duplicate contact (no new property)' });
            continue;
          }
        } else {
          // New contact (keep contact property fields for backwards-compat)
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
            propertyType: normalizedPropType,
            bedrooms: parsedBedrooms,
            totalBathrooms: record[invertedMapping.bathrooms]
              ? parseBathroomsDecimal(record[invertedMapping.bathrooms]!)
              : null,
            buildingSqft: parsedBuildingSqft,
            effectiveYearBuilt: parsedYearBuilt,
            estValue: record[invertedMapping.estimatedValue]
              ? new Decimal(parseFloat(record[invertedMapping.estimatedValue]!.replace(/[^0-9.]/g, '') || '0'))
              : null,
            estEquity: record[invertedMapping.estimatedEquity]
              ? new Decimal(parseFloat(record[invertedMapping.estimatedEquity]!.replace(/[^0-9.]/g, '') || '0'))
              : null,
            dnc: record[invertedMapping.dnc] ? record[invertedMapping.dnc]!.toLowerCase() === 'true' : false,
            dncReason: record[invertedMapping.dncReason] || null,
            dealStatus: 'lead',
            avatarUrl: record[invertedMapping.avatarUrl] || null,
          };

          const created = await prisma.contact.create({ data: contactData });
          contactCache.set(phone1, created);

          // Collect all tags to attach: bulk tags + CSV-mapped tags
          const allTagsToAttach = [...tagRecords];

          // Process CSV-mapped tags if a tags column is mapped
          if (tagsColumnHeader && record[tagsColumnHeader]) {
            const csvTagNames = Array.from(new Set(
              record[tagsColumnHeader]!
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
            ));

            if (csvTagNames.length > 0) {
              const csvTagRecords = await Promise.all(
                csvTagNames.map((name) =>
                  prisma.tag.upsert({
                    where: { name },
                    update: {},
                    create: { name },
                  })
                )
              );
              allTagsToAttach.push(...csvTagRecords);
            }
          }

          // Attach all tags to the new contact
          if (allTagsToAttach.length > 0) {
            await prisma.contactTag.createMany({
              data: allTagsToAttach.map(t => ({ contact_id: created.id, tag_id: t.id })),
              skipDuplicates: true,
            });
          }

          // Also create a ContactProperty row if address present
          // LLC for this property row (for new contacts)
          const newContactLlcName = record[invertedMapping.llcName] || null;

          if (propertyAddress) {
            await prisma.contactProperty.create({
              data: {
                contactId: created.id,
                address: propertyAddress,
                city: record[invertedMapping.propertyCity] || null,
                state: record[invertedMapping.propertyState] || null,
                county: record[invertedMapping.propertyCounty] || null,
                llcName: newContactLlcName,
                propertyType: normalizedPropType,
                bedrooms: parsedBedrooms,
                totalBathrooms: parsedBathroomsInt,
                buildingSqft: parsedBuildingSqft,
                effectiveYearBuilt: parsedYearBuilt,
                estValue: parsedEstValueInt,
                estEquity: parsedEstEquityInt,
              },
            });

          }

          result.importedCount++;
          processedIds.add(created.id);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown processing error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`Error processing row ${rowNumber}:`, errorMsg);
        console.error(`Stack trace:`, errorStack);
        console.error(`Record data:`, record);
        result.errors.push({
          row: rowNumber,
          error: errorMsg,
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

    // After import: reindex in Elasticsearch and invalidate caches so UI totals update immediately
    try {
      const ids = Array.from(processedIds)
      if (ids.length > 0) {
        const toIndex = await prisma.contact.findMany({
          where: { id: { in: ids } },
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
            contactAddress: true,
            city: true,
            state: true,
            propertyCounty: true,
            propertyType: true,
            dealStatus: true,
            estValue: true,
            estEquity: true,
            dnc: true,
            createdAt: true,
            updatedAt: true,
          }
        })

        const docs = toIndex.map((c: any) => ({
          id: c.id,
          firstName: c.firstName || undefined,
          lastName: c.lastName || undefined,
          llcName: c.llcName || undefined,
          phone1: c.phone1 || undefined,
          phone2: c.phone2 || undefined,
          phone3: c.phone3 || undefined,
          email1: c.email1 || undefined,
          email2: c.email2 || undefined,
          email3: c.email3 || undefined,
          propertyAddress: c.propertyAddress || undefined,
          contactAddress: c.contactAddress || undefined,
          city: c.city || undefined,
          state: c.state || undefined,
          propertyCounty: c.propertyCounty || undefined,
          propertyType: c.propertyType || undefined,
          dealStatus: c.dealStatus || undefined,
          estValue: c.estValue != null ? Number(c.estValue) : undefined,
          estEquity: c.estEquity != null ? Number(c.estEquity) : undefined,
          dnc: c.dnc ?? false,
          createdAt: c.createdAt?.toISOString?.() || new Date().toISOString(),
          updatedAt: c.updatedAt?.toISOString?.()
        }))

        await elasticsearchClient.bulkIndexContacts(docs as any)
      }

      // Clear list and search caches so totals and lists reflect new imports immediately
      await redisClient.invalidateContactsListCache()
      await redisClient.invalidateSearchCache()
      await redisClient.invalidateStatsCache()
    } catch (e) {
      console.warn('Post-import indexing/cache invalidation failed:', e)
    }

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
