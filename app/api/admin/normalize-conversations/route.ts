import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'
import { formatPhoneNumberForTelnyx, last10Digits } from '@/lib/phone-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Normalize conversation.phone_number to E.164 and merge duplicates per contact
// Usage (logged in as Admin):
// fetch('/api/admin/normalize-conversations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dryRun: true, batchSize: 500 }) })
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { dryRun = true, batchSize = 500 } = await req.json().catch(() => ({ dryRun: true, batchSize: 500 }))

      let page = 0
      let processed = 0
      let normalized = 0
      let merged = 0

      // Process in batches by updated_at asc to be deterministic
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const convs = await prisma.conversation.findMany({
          skip: page * batchSize,
          take: batchSize,
          orderBy: { updated_at: 'asc' },
          select: {
            id: true,
            contact_id: true,
            phone_number: true,
            last_message_at: true,
            last_message_content: true,
            last_message_direction: true,
            message_count: true,
            unread_count: true,
            updated_at: true,
          }
        })
        if (convs.length === 0) break

        for (const c of convs) {
          processed++
          const normalizedPhone = formatPhoneNumberForTelnyx(c.phone_number) || c.phone_number
          const last10 = last10Digits(c.phone_number)

          // Find another conversation for same contact matching normalized/last10, excluding self
          const existing = await prisma.conversation.findFirst({
            where: {
              id: { not: c.id },
              contact_id: c.contact_id,
              OR: [
                { phone_number: normalizedPhone },
                ...(last10 ? [{ phone_number: { endsWith: last10 } }] : [])
              ]
            },
            orderBy: { updated_at: 'desc' }
          })

          if (existing) {
            // Decide keeper (most recent)
            const keep = (existing.last_message_at || existing.updated_at || new Date(0)) > (c.last_message_at || c.updated_at || new Date(0)) ? existing : c
            const drop = keep.id === c.id ? existing : c

            if (!dryRun) {
              // Update keeper's phone number and aggregate counters/content
              await prisma.conversation.update({
                where: { id: keep.id },
                data: {
                  phone_number: normalizedPhone,
                  last_message_at: (keep.last_message_at || keep.updated_at) > (drop.last_message_at || drop.updated_at) ? keep.last_message_at : drop.last_message_at,
                  last_message_content: (keep.last_message_at || keep.updated_at) > (drop.last_message_at || drop.updated_at) ? keep.last_message_content : drop.last_message_content,
                  last_message_direction: (keep.last_message_at || keep.updated_at) > (drop.last_message_at || drop.updated_at) ? keep.last_message_direction : drop.last_message_direction,
                  message_count: (keep.message_count || 0) + (drop.message_count || 0),
                  unread_count: (keep.unread_count || 0) + (drop.unread_count || 0),
                  updated_at: new Date(),
                }
              })
              await prisma.conversation.delete({ where: { id: drop.id } })
            }
            merged++
          } else if (normalizedPhone !== c.phone_number) {
            if (!dryRun) {
              await prisma.conversation.update({
                where: { id: c.id },
                data: { phone_number: normalizedPhone, updated_at: new Date() }
              })
            }
            normalized++
          }
        }

        page++
      }

      return NextResponse.json({ success: true, dryRun, processed, normalized, merged })
    } catch (e: any) {
      console.error('Conversation normalization failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

