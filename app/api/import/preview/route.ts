import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'
import { formatPhoneNumberForTelnyx } from '@/lib/phone-utils'
import Papa from 'papaparse'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper: normalize phone to last 10 digits for matching
function normalizePhoneForMatching(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-10)
}

interface PreviewResult {
  totalRows: number
  newContacts: number
  existingContactsWithNewProperty: Array<{
    rowNumber: number
    existingContact: { id: string; name: string; phone: string }
    newPropertyAddress: string
  }>
  trueDuplicates: Array<{
    rowNumber: number
    existingContact: { id: string; name: string; phone: string }
    reason: string
  }>
  missingPhone: number
  errors: Array<{ row: number; error: string }>
}

// POST: Preview what import will do before actually importing
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const formData = await request.formData()
      const file = formData.get('file') as File
      const mappingJson = formData.get('mapping') as string

      if (!file || !mappingJson) {
        return NextResponse.json({ error: 'File and mapping are required' }, { status: 400 })
      }

      const mapping = JSON.parse(mappingJson)
      const content = await file.text()
      
      const { data: records, errors: parseErrors } = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
      })

      if (parseErrors.length > 0) {
        return NextResponse.json({ 
          error: 'CSV parse errors', 
          details: parseErrors.slice(0, 5) 
        }, { status: 400 })
      }

      // Build inverted mapping (fieldId -> csvColumnHeader)
      const invertedMapping: Record<string, string> = {}
      for (const [csvCol, fieldId] of Object.entries(mapping)) {
        if (fieldId && typeof fieldId === 'string') {
          invertedMapping[fieldId] = csvCol
        }
      }

      // Pre-load all existing contacts indexed by normalized phone (last 10 digits)
      const existingContacts = await prisma.contact.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone1: true,
          propertyAddress: true,
          properties: {
            select: { address: true }
          }
        }
      })

      const phoneIndex = new Map<string, typeof existingContacts[0][]>()
      for (const c of existingContacts) {
        const normalized = normalizePhoneForMatching(c.phone1)
        if (normalized.length >= 10) {
          const arr = phoneIndex.get(normalized) || []
          arr.push(c)
          phoneIndex.set(normalized, arr)
        }
      }

      const result: PreviewResult = {
        totalRows: records.length,
        newContacts: 0,
        existingContactsWithNewProperty: [],
        trueDuplicates: [],
        missingPhone: 0,
        errors: []
      }

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const rowNumber = i + 2 // 1-based + header row

        try {
          const rawPhone = record[invertedMapping.phone1] || ''
          const normalizedPhone = formatPhoneNumberForTelnyx(rawPhone)
          const phoneKey = normalizePhoneForMatching(normalizedPhone || rawPhone)

          if (!phoneKey || phoneKey.length < 10) {
            result.missingPhone++
            continue
          }

          const propertyAddress = record[invertedMapping.propertyStreet] || record[invertedMapping.propertyAddress] || null

          const matchingContacts = phoneIndex.get(phoneKey) || []

          if (matchingContacts.length === 0) {
            // New contact
            result.newContacts++
          } else {
            // Existing contact(s) with this phone
            const primary = matchingContacts[0]
            const existingAddresses = new Set<string>()
            
            // Collect all existing property addresses
            if (primary.propertyAddress) {
              existingAddresses.add(primary.propertyAddress.trim().toLowerCase())
            }
            for (const prop of primary.properties || []) {
              if (prop.address) {
                existingAddresses.add(prop.address.trim().toLowerCase())
              }
            }

            const newAddrKey = propertyAddress?.trim().toLowerCase()

            if (!propertyAddress || existingAddresses.has(newAddrKey || '')) {
              // True duplicate - same phone, same/no property
              result.trueDuplicates.push({
                rowNumber,
                existingContact: {
                  id: primary.id,
                  name: `${primary.firstName || ''} ${primary.lastName || ''}`.trim(),
                  phone: primary.phone1 || ''
                },
                reason: propertyAddress 
                  ? 'Property address already exists for this contact'
                  : 'No property address provided - duplicate contact'
              })
            } else {
              // Existing contact will get a new property
              result.existingContactsWithNewProperty.push({
                rowNumber,
                existingContact: {
                  id: primary.id,
                  name: `${primary.firstName || ''} ${primary.lastName || ''}`.trim(),
                  phone: primary.phone1 || ''
                },
                newPropertyAddress: propertyAddress
              })
            }
          }
        } catch (err: any) {
          result.errors.push({ row: rowNumber, error: err?.message || 'Unknown error' })
        }
      }

      return NextResponse.json({ success: true, preview: result })
    } catch (e: any) {
      console.error('import preview failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

