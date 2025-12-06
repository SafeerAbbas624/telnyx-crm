/**
 * Central configuration for all template variables used in SMS and Email templates.
 * This ensures consistent variable naming across the application.
 */

export interface TemplateVariable {
  name: string;
  label: string;
  description: string;
  category: 'Contact' | 'Property' | 'Loan' | 'System';
}

/**
 * All available template variables organized by category.
 * When a user clicks to insert a variable, the format {variableName} is used.
 */
export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Contact Variables
  { name: 'firstName', label: 'First Name', description: 'Contact first name', category: 'Contact' },
  { name: 'lastName', label: 'Last Name', description: 'Contact last name', category: 'Contact' },
  { name: 'fullName', label: 'Full Name', description: 'Full name (first + last)', category: 'Contact' },
  { name: 'email', label: 'Email', description: 'Primary email address', category: 'Contact' },
  { name: 'email1', label: 'Email 1', description: 'Primary email', category: 'Contact' },
  { name: 'email2', label: 'Email 2', description: 'Secondary email', category: 'Contact' },
  { name: 'email3', label: 'Email 3', description: 'Third email', category: 'Contact' },
  { name: 'phone', label: 'Phone', description: 'Primary phone number', category: 'Contact' },
  { name: 'phone1', label: 'Phone 1', description: 'Primary phone', category: 'Contact' },
  { name: 'phone2', label: 'Phone 2', description: 'Secondary phone', category: 'Contact' },
  { name: 'phone3', label: 'Phone 3', description: 'Third phone', category: 'Contact' },
  { name: 'llcName', label: 'LLC Name', description: 'LLC/Company name', category: 'Contact' },
  
  // Property Variables (Primary/Legacy)
  { name: 'propertyAddress', label: 'Property Address', description: 'Primary property address', category: 'Property' },
  { name: 'contactAddress', label: 'Contact Address', description: 'Contact mailing address', category: 'Property' },
  { name: 'city', label: 'City', description: 'Property city', category: 'Property' },
  { name: 'state', label: 'State', description: 'Property state', category: 'Property' },
  { name: 'zipCode', label: 'ZIP Code', description: 'Property ZIP code', category: 'Property' },
  { name: 'propertyType', label: 'Property Type', description: 'Type of property', category: 'Property' },
  { name: 'propertyCounty', label: 'Property County', description: 'County where property is located', category: 'Property' },
  { name: 'bedrooms', label: 'Bedrooms', description: 'Number of bedrooms', category: 'Property' },
  { name: 'totalBathrooms', label: 'Bathrooms', description: 'Number of bathrooms', category: 'Property' },
  { name: 'buildingSqft', label: 'Square Footage', description: 'Building square footage', category: 'Property' },
  { name: 'lotSizeSqft', label: 'Lot Size', description: 'Lot size in sq ft', category: 'Property' },
  { name: 'effectiveYearBuilt', label: 'Year Built', description: 'Year property was built', category: 'Property' },
  { name: 'lastSaleDate', label: 'Last Sale Date', description: 'Date of last sale', category: 'Property' },
  { name: 'lastSaleAmount', label: 'Last Sale Amount', description: 'Amount of last sale', category: 'Property' },
  { name: 'estValue', label: 'Estimated Value', description: 'Estimated property value', category: 'Property' },
  { name: 'estEquity', label: 'Estimated Equity', description: 'Estimated equity', category: 'Property' },
  
  // Numbered Property Variables (for multi-property contacts)
  { name: 'propertyAddress1', label: 'Property 1 Address', description: 'First property address', category: 'Property' },
  { name: 'city1', label: 'Property 1 City', description: 'First property city', category: 'Property' },
  { name: 'state1', label: 'Property 1 State', description: 'First property state', category: 'Property' },
  { name: 'zipCode1', label: 'Property 1 ZIP', description: 'First property ZIP code', category: 'Property' },
  { name: 'llcName1', label: 'Property 1 LLC', description: 'First property LLC name', category: 'Property' },
  { name: 'estValue1', label: 'Property 1 Value', description: 'First property estimated value', category: 'Property' },
  { name: 'estEquity1', label: 'Property 1 Equity', description: 'First property estimated equity', category: 'Property' },
  
  { name: 'propertyAddress2', label: 'Property 2 Address', description: 'Second property address', category: 'Property' },
  { name: 'city2', label: 'Property 2 City', description: 'Second property city', category: 'Property' },
  { name: 'state2', label: 'Property 2 State', description: 'Second property state', category: 'Property' },
  { name: 'zipCode2', label: 'Property 2 ZIP', description: 'Second property ZIP code', category: 'Property' },
  { name: 'llcName2', label: 'Property 2 LLC', description: 'Second property LLC name', category: 'Property' },
  { name: 'estValue2', label: 'Property 2 Value', description: 'Second property estimated value', category: 'Property' },
  { name: 'estEquity2', label: 'Property 2 Equity', description: 'Second property estimated equity', category: 'Property' },
  
  { name: 'propertyAddress3', label: 'Property 3 Address', description: 'Third property address', category: 'Property' },
  { name: 'city3', label: 'Property 3 City', description: 'Third property city', category: 'Property' },
  { name: 'state3', label: 'Property 3 State', description: 'Third property state', category: 'Property' },
  { name: 'zipCode3', label: 'Property 3 ZIP', description: 'Third property ZIP code', category: 'Property' },
  { name: 'llcName3', label: 'Property 3 LLC', description: 'Third property LLC name', category: 'Property' },
  { name: 'estValue3', label: 'Property 3 Value', description: 'Third property estimated value', category: 'Property' },
  { name: 'estEquity3', label: 'Property 3 Equity', description: 'Third property estimated equity', category: 'Property' },
  
  // Loan Variables
  { name: 'loanProgram', label: 'Loan Program', description: 'Type of loan program', category: 'Loan' },
  { name: 'loanAmount', label: 'Loan Amount', description: 'Requested loan amount', category: 'Loan' },
  { name: 'interestRate', label: 'Interest Rate', description: 'Current interest rate', category: 'Loan' },
  
  // System Variables
  { name: 'currentDate', label: 'Current Date', description: 'Today\'s date', category: 'System' },
  { name: 'companyName', label: 'Company Name', description: 'Your company name', category: 'System' },
  { name: 'agentName', label: 'Agent Name', description: 'Name of the assigned agent', category: 'System' },
  { name: 'agentPhone', label: 'Agent Phone', description: 'Phone number of the assigned agent', category: 'System' },
  { name: 'agentEmail', label: 'Agent Email', description: 'Email of the assigned agent', category: 'System' },
];

/**
 * Get variables filtered by category
 */
export function getVariablesByCategory(category: TemplateVariable['category']): TemplateVariable[] {
  return TEMPLATE_VARIABLES.filter(v => v.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): TemplateVariable['category'][] {
  return ['Contact', 'Property', 'Loan', 'System'];
}

/**
 * Get variables grouped by category
 */
export function getVariablesGroupedByCategory(): Record<string, TemplateVariable[]> {
  return TEMPLATE_VARIABLES.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, TemplateVariable[]>);
}

/**
 * Format a variable name for insertion into templates
 * @param variableName The variable name (e.g., 'firstName')
 * @returns The formatted variable string (e.g., '{firstName}')
 */
export function formatVariableForInsertion(variableName: string): string {
  return `{${variableName}}`;
}

/**
 * Extract variable names from a template string
 * @param template The template string
 * @returns Array of variable names found in the template
 */
export function extractVariablesFromTemplate(template: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const matches = Array.from(template.matchAll(regex));
  return [...new Set(matches.map(m => m[1]))];
}

/**
 * Validate that all variables in a template are valid
 * @param template The template string
 * @returns Object with valid and invalid variable names
 */
export function validateTemplateVariables(template: string): {
  valid: string[];
  invalid: string[];
} {
  const usedVariables = extractVariablesFromTemplate(template);
  const validNames = new Set(TEMPLATE_VARIABLES.map(v => v.name));
  
  const valid: string[] = [];
  const invalid: string[] = [];
  
  usedVariables.forEach(name => {
    if (validNames.has(name)) {
      valid.push(name);
    } else {
      invalid.push(name);
    }
  });
  
  return { valid, invalid };
}

