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
        importedAt: true,
        totalRecords: true,
        importedCount: true,
        duplicateCount: true,
        missingPhoneCount: true,
        errors: true
      }
    });

    // Format the response to include calculated fields
    const formattedHistory = history.map(record => {
      // Calculate skipped count, ensuring it's never negative
      const calculatedSkipped = Math.max(0, 
        record.totalRecords - record.importedCount - (record.duplicateCount || 0) - (record.missingPhoneCount || 0)
      );
      
      return {
        id: record.id,
        fileName: record.fileName,
        importedAt: record.importedAt,
        totalRecords: record.totalRecords,
        imported: record.importedCount,
        duplicates: record.duplicateCount || 0,
        missingPhones: record.missingPhoneCount || 0,
        skipped: calculatedSkipped,
        errorCount: Array.isArray(record.errors) ? record.errors.length : 0,
        firstFewErrors: Array.isArray(record.errors) ? record.errors.slice(0, 5) : []
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
