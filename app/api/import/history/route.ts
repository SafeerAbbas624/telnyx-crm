import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET endpoint to retrieve import history
export async function GET() {
  try {
    const history = await prisma.importHistory.findMany({
      orderBy: { importedAt: 'desc' },
      take: 50, // Limit to 50 most recent imports
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        tags: true,
        importedAt: true,
        totalRecords: true,
        importedCount: true,
        newContactsCount: true,
        existingContactsNewProperties: true,
        noPhoneEnrichedCount: true,
        ambiguousMatchCount: true,
        duplicateCount: true,
        missingPhoneCount: true,
        skippedOtherCount: true,
        errors: true
      }
    });

    // Format the response to include calculated fields
    const formattedHistory = history.map(record => {
      // Parse errors from JSON string if needed
      let parsedErrors: any[] = [];
      if (record.errors) {
        try {
          parsedErrors = typeof record.errors === 'string'
            ? JSON.parse(record.errors)
            : Array.isArray(record.errors)
            ? record.errors
            : [];
        } catch (e) {
          console.error('Error parsing errors JSON:', e);
          parsedErrors = [];
        }
      }

      // Use stored skippedOtherCount if available, otherwise calculate
      const skipped = record.skippedOtherCount ?? Math.max(0,
        (record.totalRecords || 0) - (record.importedCount || 0) - (record.duplicateCount || 0) - (record.missingPhoneCount || 0)
      );

      return {
        id: record.id,
        fileName: record.fileName,
        fileUrl: record.fileUrl,
        tags: record.tags || [],
        importedAt: record.importedAt,
        totalRecords: record.totalRecords || 0,
        imported: record.importedCount || 0,
        newContacts: record.newContactsCount || 0,
        existingContactsNewProperties: record.existingContactsNewProperties || 0,
        noPhoneEnriched: record.noPhoneEnrichedCount || 0,
        ambiguousMatches: record.ambiguousMatchCount || 0,
        duplicates: record.duplicateCount || 0,
        missingPhones: record.missingPhoneCount || 0,
        skipped: skipped,
        errorCount: parsedErrors.length,
        firstFewErrors: parsedErrors.slice(0, 5)
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

// DELETE endpoint to delete specific import history records or clear all
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids, clearAll } = body;

    if (clearAll) {
      // Delete all import history records
      const result = await prisma.importHistory.deleteMany({});
      return NextResponse.json({
        success: true,
        message: `Cleared all import history (${result.count} records deleted)`,
        deletedCount: result.count
      });
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific records by ID
      const result = await prisma.importHistory.deleteMany({
        where: {
          id: { in: ids }
        }
      });
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} import history record(s)`,
        deletedCount: result.count
      });
    } else {
      return NextResponse.json(
        { error: 'Must provide either "ids" array or "clearAll: true"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error deleting import history:', error);
    return NextResponse.json(
      { error: 'Failed to delete import history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
