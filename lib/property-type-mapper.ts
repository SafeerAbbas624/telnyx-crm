/**
 * Normalizes property type names from various formats to standardized display names
 */

export const PROPERTY_TYPE_MAP: Record<string, string> = {
  // Single Family
  'Single Family Residential': 'Single-family (SFH)',
  'Single Family': 'Single-family (SFH)',
  'SFR': 'Single-family (SFH)',
  'Single-Family': 'Single-family (SFH)',
  
  // Duplex
  'Duplex (2 units, any combination)': 'Duplex',
  'Duplex': 'Duplex',
  '2 Unit': 'Duplex',
  'Two Unit': 'Duplex',
  
  // Triplex
  'Triplex': 'Triplex',
  '3 Unit': 'Triplex',
  'Three Unit': 'Triplex',
  
  // Quadplex
  'Quadplex': 'Quadplex',
  '4 Unit': 'Quadplex',
  'Four Unit': 'Quadplex',
  'Fourplex': 'Quadplex',
  
  // Multi-Family
  'Multi-Family Dwellings (Generic, 2+)': 'Multi-family',
  'Multi-Family': 'Multi-family',
  'Multifamily': 'Multi-family',
  'Multi Family': 'Multi-family',
  'Apartment Building': 'Multi-family',
  'Apartments': 'Multi-family',
  '5+ Units': 'Multi-family',
  
  // Condo
  'Condominium (Residential)': 'Condo',
  'Condominium': 'Condo',
  'Condo': 'Condo',
  
  // Townhouse
  'Townhouse': 'Townhouse',
  'Townhome': 'Townhouse',
  'Town House': 'Townhouse',
  
  // Commercial
  'Commercial': 'Commercial',
  'Commercial Building': 'Commercial',
  'Office': 'Commercial',
  'Retail': 'Commercial',
  'Industrial': 'Commercial',
  
  // Land
  'Land': 'Land',
  'Vacant Land': 'Land',
  'Lot': 'Land',
  
  // Mobile Home
  'Mobile Home': 'Mobile Home',
  'Manufactured Home': 'Mobile Home',
  'Trailer': 'Mobile Home',
};

/**
 * Normalizes a property type string to a standardized format
 * @param rawType - The raw property type string from data source
 * @returns Normalized property type string
 */
export function normalizePropertyType(rawType: string | null | undefined): string {
  if (!rawType) return '';
  
  // Trim whitespace
  const trimmed = rawType.trim();
  
  // Check for exact match (case-insensitive)
  const exactMatch = Object.keys(PROPERTY_TYPE_MAP).find(
    key => key.toLowerCase() === trimmed.toLowerCase()
  );
  
  if (exactMatch) {
    return PROPERTY_TYPE_MAP[exactMatch];
  }
  
  // Check for partial match
  const partialMatch = Object.keys(PROPERTY_TYPE_MAP).find(
    key => trimmed.toLowerCase().includes(key.toLowerCase()) || 
           key.toLowerCase().includes(trimmed.toLowerCase())
  );
  
  if (partialMatch) {
    return PROPERTY_TYPE_MAP[partialMatch];
  }
  
  // Return original if no match found
  return trimmed;
}

/**
 * Gets all unique normalized property types
 * @returns Array of standardized property type names
 */
export function getStandardPropertyTypes(): string[] {
  return Array.from(new Set(Object.values(PROPERTY_TYPE_MAP))).sort();
}

/**
 * Gets property type icon/emoji based on type
 * @param propertyType - Normalized property type
 * @returns Emoji or icon character
 */
export function getPropertyTypeIcon(propertyType: string): string {
  const iconMap: Record<string, string> = {
    'Single-family (SFH)': '🏠',
    'Duplex': '🏘️',
    'Triplex': '🏘️',
    'Quadplex': '🏘️',
    'Multi-family': '🏢',
    'Condo': '🏬',
    'Townhouse': '🏘️',
    'Commercial': '🏪',
    'Land': '🌳',
    'Mobile Home': '🚐',
  };
  
  return iconMap[propertyType] || '🏠';
}

/**
 * Gets property type color for badges
 * @param propertyType - Normalized property type
 * @returns Tailwind color class
 */
export function getPropertyTypeColor(propertyType: string): string {
  const colorMap: Record<string, string> = {
    'Single-family (SFH)': 'bg-blue-500',
    'Duplex': 'bg-green-500',
    'Triplex': 'bg-green-600',
    'Quadplex': 'bg-green-700',
    'Multi-family': 'bg-purple-500',
    'Condo': 'bg-orange-500',
    'Townhouse': 'bg-yellow-500',
    'Commercial': 'bg-red-500',
    'Land': 'bg-emerald-500',
    'Mobile Home': 'bg-gray-500',
  };
  
  return colorMap[propertyType] || 'bg-gray-500';
}

