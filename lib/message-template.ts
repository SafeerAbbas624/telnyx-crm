/**
 * Message template utilities for formatting messages with contact variables
 * Supports numbered property fields: {propertyAddress1}, {propertyAddress2}, etc.
 */

// Use 'any' for flexible compatibility with Prisma's Decimal and other types
export type ContactWithProperties = {
  firstName?: string | null
  lastName?: string | null
  llcName?: string | null
  phone1?: string | null
  phone2?: string | null
  phone3?: string | null
  email1?: string | null
  email2?: string | null
  email3?: string | null
  propertyAddress?: string | null
  contactAddress?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  propertyType?: string | null
  propertyCounty?: string | null
  bedrooms?: any
  totalBathrooms?: any
  buildingSqft?: any
  effectiveYearBuilt?: any
  estValue?: any
  estEquity?: any
  properties?: Array<{
    id?: string
    address?: string | null
    city?: string | null
    state?: string | null
    zipCode?: string | null
    llcName?: string | null
    propertyType?: string | null
    bedrooms?: any
    totalBathrooms?: any
    buildingSqft?: any
    estValue?: any
    estEquity?: any
  }>
}

/**
 * Format message template with contact data
 * Supports all standard fields plus numbered property fields
 */
export function formatMessageTemplate(template: string, contact: ContactWithProperties): string {
  let result = template
    // Name fields
    .replace(/\{firstName\}/g, contact.firstName || '')
    .replace(/\{lastName\}/g, contact.lastName || '')
    .replace(/\{fullName\}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim())
    .replace(/\{llcName\}/g, contact.llcName || '')
    // Phone fields
    .replace(/\{phone1\}/g, contact.phone1 || '')
    .replace(/\{phone2\}/g, contact.phone2 || '')
    .replace(/\{phone3\}/g, contact.phone3 || '')
    .replace(/\{phone\}/g, contact.phone1 || contact.phone2 || contact.phone3 || '')
    // Email fields
    .replace(/\{email1\}/g, contact.email1 || '')
    .replace(/\{email2\}/g, contact.email2 || '')
    .replace(/\{email3\}/g, contact.email3 || '')
    .replace(/\{email\}/g, contact.email1 || contact.email2 || contact.email3 || '')
    // Legacy address fields (primary property)
    .replace(/\{propertyAddress\}/g, contact.propertyAddress || '')
    .replace(/\{contactAddress\}/g, contact.contactAddress || '')
    .replace(/\{city\}/g, contact.city || '')
    .replace(/\{state\}/g, contact.state || '')
    .replace(/\{zipCode\}/g, contact.zipCode || '')
    // Property fields (primary)
    .replace(/\{propertyType\}/g, contact.propertyType || '')
    .replace(/\{propertyCounty\}/g, contact.propertyCounty || '')
    .replace(/\{bedrooms\}/g, contact.bedrooms ? contact.bedrooms.toString() : '')
    .replace(/\{totalBathrooms\}/g, contact.totalBathrooms ? contact.totalBathrooms.toString() : '')
    .replace(/\{buildingSqft\}/g, contact.buildingSqft ? contact.buildingSqft.toString() : '')
    .replace(/\{effectiveYearBuilt\}/g, contact.effectiveYearBuilt ? contact.effectiveYearBuilt.toString() : '')
    // Financial fields
    .replace(/\{estValue\}/g, contact.estValue ? contact.estValue.toString() : '')
    .replace(/\{estEquity\}/g, contact.estEquity ? contact.estEquity.toString() : '')

  // Build combined properties list (primary + additional)
  const allProperties: ContactWithProperties['properties'] = []
  
  // Add primary property from contact record
  if (contact.propertyAddress) {
    allProperties.push({
      address: contact.propertyAddress,
      city: contact.city,
      state: contact.state,
      zipCode: contact.zipCode,
      llcName: contact.llcName,
      propertyType: contact.propertyType,
      bedrooms: contact.bedrooms,
      totalBathrooms: contact.totalBathrooms,
      buildingSqft: contact.buildingSqft,
      estValue: contact.estValue,
      estEquity: contact.estEquity,
    })
  }
  
  // Add additional properties
  if (contact.properties?.length) {
    allProperties.push(...contact.properties)
  }

  // Replace numbered property variables {propertyAddress1}, {city1}, etc.
  for (let i = 0; i < 10; i++) { // Support up to 10 properties
    const propNum = i + 1
    const prop = allProperties[i]
    
    result = result
      .replace(new RegExp(`\\{propertyAddress${propNum}\\}`, 'g'), prop?.address || '')
      .replace(new RegExp(`\\{city${propNum}\\}`, 'g'), prop?.city || '')
      .replace(new RegExp(`\\{state${propNum}\\}`, 'g'), prop?.state || '')
      .replace(new RegExp(`\\{zipCode${propNum}\\}`, 'g'), prop?.zipCode || '')
      .replace(new RegExp(`\\{llcName${propNum}\\}`, 'g'), prop?.llcName || '')
      .replace(new RegExp(`\\{propertyType${propNum}\\}`, 'g'), prop?.propertyType || '')
      .replace(new RegExp(`\\{bedrooms${propNum}\\}`, 'g'), prop?.bedrooms ? prop.bedrooms.toString() : '')
      .replace(new RegExp(`\\{bathrooms${propNum}\\}`, 'g'), prop?.totalBathrooms ? prop.totalBathrooms.toString() : '')
      .replace(new RegExp(`\\{sqft${propNum}\\}`, 'g'), prop?.buildingSqft ? prop.buildingSqft.toString() : '')
      .replace(new RegExp(`\\{estValue${propNum}\\}`, 'g'), prop?.estValue ? prop.estValue.toString() : '')
      .replace(new RegExp(`\\{estEquity${propNum}\\}`, 'g'), prop?.estEquity ? prop.estEquity.toString() : '')
  }

  return result
}

/** List of available template variables for UI display */
export const AVAILABLE_TEMPLATE_VARIABLES = [
  // Contact info
  '{firstName}', '{lastName}', '{fullName}', '{llcName}',
  '{phone}', '{phone1}', '{phone2}', '{phone3}',
  '{email}', '{email1}', '{email2}', '{email3}',
  // Primary property (legacy)
  '{propertyAddress}', '{contactAddress}', '{city}', '{state}', '{zipCode}',
  '{propertyType}', '{propertyCounty}', '{bedrooms}', '{totalBathrooms}',
  '{buildingSqft}', '{effectiveYearBuilt}', '{estValue}', '{estEquity}',
  // Numbered properties
  '{propertyAddress1}', '{city1}', '{state1}', '{llcName1}', '{estValue1}',
  '{propertyAddress2}', '{city2}', '{state2}', '{llcName2}', '{estValue2}',
  '{propertyAddress3}', '{city3}', '{state3}', '{llcName3}', '{estValue3}',
]

