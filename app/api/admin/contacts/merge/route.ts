import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'
import { formatPhoneNumberForTelnyx } from '@/lib/phone-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/*
POST /api/admin/contacts/merge
Body: {
  primaryId: string,
  duplicateIds: string[],
  // Optional safety: enforce that duplicates match rule B (phone+name+propertyAddress)
  enforceRule?: boolean // default true
}
*/
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const body = await request.json()
      const { primaryId, duplicateIds, enforceRule = true } = body || {}

      if (!primaryId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return NextResponse.json({ error: 'primaryId and duplicateIds are required' }, { status: 400 })
      }

      if (duplicateIds.includes(primaryId)) {
        return NextResponse.json({ error: 'duplicateIds cannot include primaryId' }, { status: 400 })
      }

      const primary = await prisma.contact.findUnique({ where: { id: primaryId } })
      if (!primary) return NextResponse.json({ error: 'Primary contact not found' }, { status: 404 })

      const dupes = await prisma.contact.findMany({ where: { id: { in: duplicateIds } } })
      if (dupes.length !== duplicateIds.length) return NextResponse.json({ error: 'Some duplicateIds not found' }, { status: 404 })

      // Optional safety: verify rule B
      if (enforceRule) {
        const primaryKey = buildRuleKey(primary)
        for (const d of dupes) {
          if (buildRuleKey(d) !== primaryKey) {
            return NextResponse.json({ error: 'One or more records do not match rule B (phone+name+propertyAddress)' }, { status: 400 })
          }
        }
      }

      // Reassign all related records to primaryId
      const reassigned: Record<string, number> = {}

      // Helper to run updateMany and record counts
      async function reassign(model: any, where: any, data: any, name: string) {
        const res = await model.updateMany({ where, data })
        reassigned[name] = (reassigned[name] || 0) + (res.count || 0)
      }

      // Start transaction
      await prisma.$transaction(async (tx) => {
        const ids = duplicateIds

        await reassign(tx.message, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Message')
        await reassign(tx.call, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Call')
        await reassign(tx.email, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Email')
        await reassign(tx.activity, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Activity')
        await reassign(tx.deal, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Deal')
        await reassign(tx.document, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Document')
        await reassign(tx.conversation, { contact_id: { in: ids } }, { contact_id: primaryId }, 'Conversation')
        await reassign(tx.telnyxMessage, { contactId: { in: ids } }, { contactId: primaryId }, 'TelnyxMessage')
        await reassign(tx.telnyxCall, { contactId: { in: ids } }, { contactId: primaryId }, 'TelnyxCall')
        await reassign(tx.emailMessage, { contactId: { in: ids } }, { contactId: primaryId }, 'EmailMessage')
        await reassign(tx.emailConversation, { contactId: { in: ids } }, { contactId: primaryId }, 'EmailConversation')
        await reassign(tx.contactAssignment, { contactId: { in: ids } }, { contactId: primaryId }, 'ContactAssignment')
        await reassign(tx.contactTag, { contact_id: { in: ids } }, { contact_id: primaryId }, 'ContactTag')

        // Ensure phone normalization on primary
        const normalizedPhone = formatPhoneNumberForTelnyx(primary.phone1 || '') || (primary.phone1 || null)
        if (normalizedPhone !== (primary.phone1 || null)) {
          await tx.contact.update({ where: { id: primaryId }, data: { phone1: normalizedPhone } })
        }

        // Delete duplicate contacts
        await tx.contact.deleteMany({ where: { id: { in: ids } } })
      })

      return NextResponse.json({ success: true, primaryId, mergedCount: duplicateIds.length, reassigned })
    } catch (e: any) {
      console.error('merge contacts failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

function buildRuleKey(c: any) {
  const name = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim().toLowerCase()
  const phone = formatPhoneNumberForTelnyx(c.phone1 || '') || (c.phone1 || '').trim()
  const addr = (c.propertyAddress || '').trim().toLowerCase()
  return `${phone}__${name}__${addr}`
}

