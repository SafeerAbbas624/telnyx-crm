/**
 * Auto-mapping configuration for CSV column headers to internal field keys
 * Normalizes CSV headers (lowercase, trim, remove extra punctuation) for matching
 */

export interface FieldMappingConfig {
  csvNames: string[];
  fieldKey: string;
  required?: boolean;
}

export const AUTO_FIELD_MAPPINGS: FieldMappingConfig[] = [
  // Contact identity fields
  {
    csvNames: ['name (formatted)', 'full name', 'name', 'contact name'],
    fieldKey: 'fullName',
    required: true,
  },
  {
    csvNames: ['first name', 'firstname'],
    fieldKey: 'firstName',
  },
  {
    csvNames: ['last name', 'lastname'],
    fieldKey: 'lastName',
  },
  // Phone mappings
  {
    csvNames: ['phone', 'primary phone', 'phone number', 'cell', 'mobile', 'contact number', 'phone1', 'cell phone', 'mobile phone'],
    fieldKey: 'phone1',
    required: true,
  },
  // Email mappings
  {
    csvNames: ['email', 'primary email', 'email address', 'contact email1', 'email1'],
    fieldKey: 'email1',
  },
  {
    csvNames: ['contact email2', 'email2', 'secondary email'],
    fieldKey: 'email2',
  },
  {
    csvNames: ['contact email3', 'email3'],
    fieldKey: 'email3',
  },
  // Property address fields
  {
    csvNames: ['address', 'property address', 'street address', 'property street'],
    fieldKey: 'propertyAddress',
  },
  {
    csvNames: ['city', 'property city'],
    fieldKey: 'city',
  },
  {
    csvNames: ['state', 'property state'],
    fieldKey: 'state',
  },
  {
    csvNames: ['zip', 'zip code', 'postal code', 'zipcode', 'property zip'],
    fieldKey: 'zipCode',
  },
  {
    csvNames: ['county', 'property county'],
    fieldKey: 'propertyCounty',
  },
  // LLC/Owner fields
  {
    csvNames: ['llc name', 'owner 1 last name', 'owner name', 'owner', 'company name', 'entity name'],
    fieldKey: 'llcName',
  },
  // Contact home address fields
  {
    csvNames: ['contact address (street)', 'mailing address', 'home address', 'mailing street', 'contact street'],
    fieldKey: 'contactAddress',
  },
  {
    csvNames: ['contact address (city, state)', 'contact address (city, state, zip)', 'mailing city state', 'contact city state zip'],
    fieldKey: 'contactCityStateZip',
  },
  // Property details
  {
    csvNames: ['property type', 'type', 'propertytype'],
    fieldKey: 'propertyType',
  },
  {
    csvNames: ['bedrooms', 'beds', 'bed'],
    fieldKey: 'bedrooms',
  },
  {
    csvNames: ['total bathrooms', 'bathrooms', 'baths', 'bath'],
    fieldKey: 'totalBathrooms',
  },
  {
    csvNames: ['building sqft', 'square feet', 'sqft', 'square footage', 'living area'],
    fieldKey: 'buildingSqft',
  },
  {
    csvNames: ['lot size sqft', 'lot size', 'lot sqft', 'lot area'],
    fieldKey: 'lotSizeSqft',
  },
  {
    csvNames: ['effective year built', 'year built', 'year'],
    fieldKey: 'effectiveYearBuilt',
  },
  // Financial fields
  {
    csvNames: ['last sale recording date', 'last sale date', 'sale date'],
    fieldKey: 'lastSaleDate',
  },
  {
    csvNames: ['last sale amount', 'sale amount', 'sale price'],
    fieldKey: 'lastSaleAmount',
  },
  {
    csvNames: ['est. remaining balance of open loans', 'remaining balance', 'mortgage balance', 'loan balance'],
    fieldKey: 'estRemainingBalance',
  },
  {
    csvNames: ['est. value', 'estimated value', 'property value', 'value'],
    fieldKey: 'estValue',
  },
  {
    csvNames: ['est. equity', 'estimated equity', 'equity'],
    fieldKey: 'estEquity',
  },
  // MLS fields
  {
    csvNames: ['mls status', 'listing status'],
    fieldKey: 'mlsStatus',
  },
  {
    csvNames: ['mls date', 'listing date'],
    fieldKey: 'mlsDate',
  },
  {
    csvNames: ['mls amount', 'list price', 'listing price'],
    fieldKey: 'mlsAmount',
  },
  {
    csvNames: ['lien amount', 'liens'],
    fieldKey: 'lienAmount',
  },
  {
    csvNames: ['units', 'unit count'],
    fieldKey: 'units',
  },
  {
    csvNames: ['marketing lists', 'lists'],
    fieldKey: 'marketingLists',
  },
];

/**
 * Normalize a CSV header for comparison
 * - Lowercase
 * - Trim whitespace
 * - Remove extra punctuation
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')  // Replace underscores/dashes with spaces
    .replace(/\s+/g, ' ')    // Normalize multiple spaces
    .replace(/[()[\]{}]/g, match => match) // Keep parentheses for matching
    .trim();
}

/**
 * Find the best field mapping for a given CSV header
 * @returns The fieldKey if found, or null if no mapping exists
 */
export function findFieldMapping(csvHeader: string): string | null {
  const normalizedHeader = normalizeHeader(csvHeader);

  for (const mapping of AUTO_FIELD_MAPPINGS) {
    for (const csvName of mapping.csvNames) {
      if (normalizeHeader(csvName) === normalizedHeader) {
        return mapping.fieldKey;
      }
    }
  }

  return null;
}

/**
 * Get all auto-mappings for a list of CSV headers
 * @returns Map of csvHeader -> fieldKey
 */
export function getAutoMappings(csvHeaders: string[]): Map<string, string> {
  const mappings = new Map<string, string>();
  const usedFieldKeys = new Set<string>();

  // Sort headers to ensure consistent mapping order
  for (const header of csvHeaders) {
    const fieldKey = findFieldMapping(header);
    if (fieldKey && !usedFieldKeys.has(fieldKey)) {
      mappings.set(header, fieldKey);
      usedFieldKeys.add(fieldKey);
    }
  }

  return mappings;
}

/**
 * Get the list of required field keys that must be mapped
 */
export function getRequiredFieldKeys(): string[] {
  return AUTO_FIELD_MAPPINGS
    .filter(m => m.required)
    .map(m => m.fieldKey);
}

/**
 * Check if a set of mappings includes all required fields
 */
export function hasRequiredMappings(mappings: Map<string, string>): boolean {
  const mappedFieldKeys = new Set(mappings.values());
  const requiredKeys = getRequiredFieldKeys();

  // Only phone1 is truly required
  return mappedFieldKeys.has('phone1');
}

// Protected field keys that cannot be deleted
export const PROTECTED_FIELD_KEYS = [
  'phone1',
  'fullName',
  'firstName',
  'lastName',
  'email1',
  'propertyAddress',
  'city',
  'state',
  'zipCode',
  'propertyCounty',
  'llcName',
  'contactAddress',
  'contactCityStateZip',
];

