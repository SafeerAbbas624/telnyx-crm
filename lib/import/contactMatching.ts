/**
 * Contact matching utilities for import enrichment
 * Provides fallback matching when phone is not available
 */

import { prisma } from '@/lib/db';
import type { Contact } from '@prisma/client';

export type MatchResult = Contact | null | 'AMBIGUOUS';

/**
 * Parse city and state from a combined city/state/zip string
 * Examples:
 *  - "MIAMI, FL 33167" -> { city: "MIAMI", state: "FL" }
 *  - "Miami, FL" -> { city: "Miami", state: "FL" }
 *  - "Miami FL" -> { city: "Miami", state: "FL" }
 *  - "Miami, Florida 33167" -> { city: "Miami", state: "Florida" }
 */
export function parseCityState(input: string): { city: string; state: string } | null {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Remove zip code (5 digits or 5+4 format at the end)
  const withoutZip = trimmed.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
  
  // Try comma-separated: "City, State"
  const commaMatch = withoutZip.match(/^(.+?),\s*([A-Za-z]{2,})$/);
  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      state: commaMatch[2].trim(),
    };
  }
  
  // Try space-separated: "City State" (state is 2-letter abbreviation at end)
  const spaceMatch = withoutZip.match(/^(.+?)\s+([A-Z]{2})$/i);
  if (spaceMatch) {
    return {
      city: spaceMatch[1].trim(),
      state: spaceMatch[2].trim().toUpperCase(),
    };
  }
  
  return null;
}

/**
 * Normalize a full name for comparison
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Convert to lowercase
 */
export function normalizeFullName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Find a contact by full name and contact home city/state
 * 
 * @returns 
 *  - null if no matches
 *  - The single matching Contact if exactly one match
 *  - 'AMBIGUOUS' if more than one contact matches
 */
export async function findContactByNameAndCityState(
  fullName: string,
  contactCityState: string
): Promise<MatchResult> {
  const normalizedName = normalizeFullName(fullName);
  if (!normalizedName) return null;
  
  const parsed = parseCityState(contactCityState);
  if (!parsed) return null;
  
  const { city, state } = parsed;
  const cityLower = city.toLowerCase();
  const stateLower = state.toLowerCase();
  
  try {
    // Query contacts matching the normalized full name AND city/state
    // We check both firstName+lastName combination and the contactCityStateZip field
    const matches: Contact[] = await prisma.$queryRaw`
      SELECT * FROM contacts
      WHERE 
        deleted_at IS NULL
        AND (
          -- Match fullName if stored
          LOWER(TRIM(COALESCE(full_name, ''))) = ${normalizedName}
          OR
          -- Match firstName + lastName concatenated
          LOWER(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) = ${normalizedName}
        )
        AND (
          -- Match contactCityStateZip field (contains city and state)
          (
            LOWER(COALESCE(contact_city_state_zip, '')) LIKE ${`%${cityLower}%`}
            AND LOWER(COALESCE(contact_city_state_zip, '')) LIKE ${`%${stateLower}%`}
          )
        )
      LIMIT 10
    `;
    
    if (!matches || matches.length === 0) {
      return null;
    }
    
    if (matches.length === 1) {
      return matches[0];
    }
    
    // More than one match - ambiguous
    return 'AMBIGUOUS';
    
  } catch (error) {
    console.error('findContactByNameAndCityState error:', error);
    return null;
  }
}

