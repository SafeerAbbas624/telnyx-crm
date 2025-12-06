import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper: extract last 10 digits from phone number for matching
function normalizePhoneForMatching(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-10) // Get last 10 digits
}

interface DuplicateContact {
  id: string
  name: string
  phone: string
  propertyAddress: string | null
  propertiesCount: number
  createdAt: Date
  isPrimary: boolean
}

interface DuplicateGroup {
  phone: string
  normalizedPhone: string
  contacts: DuplicateContact[]
  uniqueProperties: string[]
  action: 'merge' | 'skip'
}

interface ScrubPreview {
  totalDuplicateGroups: number
  totalContactsToMerge: number
  totalPropertiesToConsolidate: number
  groups: DuplicateGroup[]
}

// GET: Preview duplicate groups (phone-based matching)
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '100')
      const batchSize = parseInt(searchParams.get('batchSize') || '1000')

      // Build phone -> contacts mapping
      const phoneMap = new Map<string, any[]>()
      let page = 0

      while (true) {
        const contacts = await prisma.contact.findMany({
          skip: page * batchSize,
          take: batchSize,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            propertyAddress: true,
            createdAt: true,
            _count: { select: { properties: true } }
          }
        })
        if (contacts.length === 0) break

        for (const c of contacts) {
          const normalizedPhone = normalizePhoneForMatching(c.phone1)
          if (!normalizedPhone || normalizedPhone.length < 10) continue
          
          const arr = phoneMap.get(normalizedPhone) || []
          arr.push(c)
          phoneMap.set(normalizedPhone, arr)
        }
        page++
      }

      // Build groups for duplicates (>1 contact with same phone)
      const groups: DuplicateGroup[] = []
      let totalContactsToMerge = 0
      let totalPropertiesToConsolidate = 0

      for (const [normalizedPhone, contacts] of phoneMap.entries()) {
        if (contacts.length <= 1) continue

        // Sort by createdAt (oldest first) - oldest becomes primary
        contacts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        // Collect unique property addresses
        const uniqueProps = new Set<string>()
        const contactData: DuplicateContact[] = contacts.map((c, idx) => {
          if (c.propertyAddress) uniqueProps.add(c.propertyAddress.trim().toLowerCase())
          return {
            id: c.id,
            name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
            phone: c.phone1 || '',
            propertyAddress: c.propertyAddress,
            propertiesCount: c._count?.properties || 0,
            createdAt: c.createdAt,
            isPrimary: idx === 0
          }
        })

        groups.push({
          phone: contacts[0].phone1 || '',
          normalizedPhone,
          contacts: contactData,
          uniqueProperties: Array.from(uniqueProps),
          action: 'merge'
        })

        totalContactsToMerge += contacts.length - 1 // All except primary
        totalPropertiesToConsolidate += uniqueProps.size
      }

      // Limit results if specified
      const limitedGroups = limit > 0 ? groups.slice(0, limit) : groups

      const preview: ScrubPreview = {
        totalDuplicateGroups: groups.length,
        totalContactsToMerge,
        totalPropertiesToConsolidate,
        groups: limitedGroups
      }

      return NextResponse.json({ success: true, preview })
    } catch (e: any) {
      console.error('scrub-duplicates GET failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

// POST: Execute merge for duplicate groups
// Body: { groupsToMerge?: string[] } - array of normalizedPhone values, or empty for all
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const body = await request.json().catch(() => ({}))
      const { groupsToMerge, dryRun = false } = body

      // First, rebuild the phone map to find duplicates
      const phoneMap = new Map<string, any[]>()
      const batchSize = 1000
      let page = 0

      while (true) {
        const contacts = await prisma.contact.findMany({
          skip: page * batchSize,
          take: batchSize,
          orderBy: { createdAt: 'asc' },
          include: {
            properties: true,
            tags: { include: { tag: true } }
          }
        })
        if (contacts.length === 0) break

        for (const c of contacts) {
          const normalizedPhone = normalizePhoneForMatching(c.phone1)
          if (!normalizedPhone || normalizedPhone.length < 10) continue

          const arr = phoneMap.get(normalizedPhone) || []
          arr.push(c)
          phoneMap.set(normalizedPhone, arr)
        }
        page++
      }

      // Filter to only groups to merge
      const targetPhones = groupsToMerge && Array.isArray(groupsToMerge) && groupsToMerge.length > 0
        ? new Set(groupsToMerge)
        : null

      let mergedGroups = 0
      let contactsDeleted = 0
      let propertiesConsolidated = 0
      const errors: { phone: string; error: string }[] = []

      for (const [normalizedPhone, contacts] of phoneMap.entries()) {
        if (contacts.length <= 1) continue
        if (targetPhones && !targetPhones.has(normalizedPhone)) continue

        // Sort by createdAt - oldest is primary
        contacts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        const primary = contacts[0]
        const duplicates = contacts.slice(1)

        if (dryRun) {
          mergedGroups++
          contactsDeleted += duplicates.length
          continue
        }

        try {
          await prisma.$transaction(async (tx) => {
            // Collect all unique property addresses from all duplicates
            const existingAddresses = new Set(
              primary.properties?.map((p: any) => p.address?.trim().toLowerCase()).filter(Boolean) || []
            )

            // Also add primary's propertyAddress if it exists
            if (primary.propertyAddress) {
              existingAddresses.add(primary.propertyAddress.trim().toLowerCase())
            }

            for (const dupe of duplicates) {
              // Add properties from duplicates
              if (dupe.properties && dupe.properties.length > 0) {
                for (const prop of dupe.properties) {
                  const propAddrKey = prop.address?.trim().toLowerCase()
                  if (propAddrKey && !existingAddresses.has(propAddrKey)) {
                    await tx.contactProperty.create({
                      data: {
                        contactId: primary.id,
                        address: prop.address,
                        city: prop.city,
                        state: prop.state,
                        zipCode: prop.zipCode,
                        county: prop.county,
                        llcName: prop.llcName,
                        propertyType: prop.propertyType,
                        bedrooms: prop.bedrooms,
                        totalBathrooms: prop.totalBathrooms,
                        buildingSqft: prop.buildingSqft,
                        lotSizeSqft: prop.lotSizeSqft,
                        effectiveYearBuilt: prop.effectiveYearBuilt,
                        lastSaleDate: prop.lastSaleDate,
                        lastSaleAmount: prop.lastSaleAmount,
                        estValue: prop.estValue,
                        estEquity: prop.estEquity,
                      }
                    })
                    existingAddresses.add(propAddrKey)
                    propertiesConsolidated++
                  }
                }
              }

              // If duplicate has propertyAddress but no properties array entry, add it
              if (dupe.propertyAddress) {
                const dupeAddrKey = dupe.propertyAddress.trim().toLowerCase()
                if (!existingAddresses.has(dupeAddrKey)) {
                  await tx.contactProperty.create({
                    data: {
                      contactId: primary.id,
                      address: dupe.propertyAddress,
                      city: dupe.city,
                      state: dupe.state,
                      zipCode: dupe.zipCode,
                      county: dupe.propertyCounty,
                      llcName: dupe.llcName,
                      propertyType: dupe.propertyType,
                      bedrooms: dupe.bedrooms,
                      totalBathrooms: dupe.totalBathrooms,
                      buildingSqft: dupe.buildingSqft,
                      effectiveYearBuilt: dupe.effectiveYearBuilt,
                      estValue: dupe.estValue ? parseInt(String(dupe.estValue)) : null,
                      estEquity: dupe.estEquity ? parseInt(String(dupe.estEquity)) : null,
                    }
                  })
                  existingAddresses.add(dupeAddrKey)
                  propertiesConsolidated++
                }
              }

              // Reassign related records to primary
              const dupeId = dupe.id
              await tx.message.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.call.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.email.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.activity.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.deal.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.document.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.conversation.updateMany({ where: { contact_id: dupeId }, data: { contact_id: primary.id } })
              await tx.telnyxMessage.updateMany({ where: { contactId: dupeId }, data: { contactId: primary.id } })
              await tx.telnyxCall.updateMany({ where: { contactId: dupeId }, data: { contactId: primary.id } })
              await tx.emailMessage.updateMany({ where: { contactId: dupeId }, data: { contactId: primary.id } })
              await tx.emailConversation.updateMany({ where: { contactId: dupeId }, data: { contactId: primary.id } })
              await tx.contactAssignment.updateMany({ where: { contactId: dupeId }, data: { contactId: primary.id } })
              await tx.task.updateMany({ where: { contactId: dupeId }, data: { contactId: primary.id } })

              // Copy tags from duplicate (skip if already exists on primary)
              if (dupe.tags && dupe.tags.length > 0) {
                for (const ct of dupe.tags) {
                  await tx.contactTag.upsert({
                    where: { contact_id_tag_id: { contact_id: primary.id, tag_id: ct.tag_id } },
                    update: {},
                    create: { contact_id: primary.id, tag_id: ct.tag_id }
                  })
                }
              }
            }

            // Delete duplicate contacts (cascade will clean up their properties)
            const dupeIds = duplicates.map(d => d.id)
            await tx.contact.deleteMany({ where: { id: { in: dupeIds } } })

            // Add "Multiple property" tag if primary now has 2+ properties
            const propertyCount = await tx.contactProperty.count({ where: { contactId: primary.id } })
            if (propertyCount > 1) {
              const multiPropTag = await tx.tag.upsert({
                where: { name: 'Multiple property' },
                update: {},
                create: { name: 'Multiple property' }
              })
              await tx.contactTag.upsert({
                where: { contact_id_tag_id: { contact_id: primary.id, tag_id: multiPropTag.id } },
                update: {},
                create: { contact_id: primary.id, tag_id: multiPropTag.id }
              })
            }
          })

          mergedGroups++
          contactsDeleted += duplicates.length
        } catch (err: any) {
          errors.push({ phone: normalizedPhone, error: err?.message || 'Unknown error' })
        }
      }

      return NextResponse.json({
        success: true,
        dryRun,
        summary: {
          mergedGroups,
          contactsDeleted,
          propertiesConsolidated
        },
        errors: errors.length > 0 ? errors : undefined
      })
    } catch (e: any) {
      console.error('scrub-duplicates POST failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

