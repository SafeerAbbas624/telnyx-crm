import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'
import { formatPhoneNumberForTelnyx } from '@/lib/phone-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { dryRun = true, batchSize = 500 } = await req.json().catch(() => ({ dryRun: true, batchSize: 500 }))

      let page = 0
      let processed = 0
      let updated = 0
      let unchanged = 0

      // Process in batches
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const contacts = await prisma.contact.findMany({
          skip: page * batchSize,
          take: batchSize,
          orderBy: { createdAt: 'asc' },
          select: { id: true, phone1: true, phone2: true, phone3: true }
        })
        if (contacts.length === 0) break

        for (const c of contacts) {
          processed++
          const n1 = c.phone1 ? formatPhoneNumberForTelnyx(c.phone1) : null
          const n2 = c.phone2 ? formatPhoneNumberForTelnyx(c.phone2) : null
          const n3 = c.phone3 ? formatPhoneNumberForTelnyx(c.phone3) : null

          const changed = (n1 || null) !== (c.phone1 || null) || (n2 || null) !== (c.phone2 || null) || (n3 || null) !== (c.phone3 || null)
          if (changed) {
            if (!dryRun) {
              await prisma.contact.update({ where: { id: c.id }, data: { phone1: n1, phone2: n2, phone3: n3 } })
            }
            updated++
          } else {
            unchanged++
          }
        }

        page++
      }

      return NextResponse.json({ success: true, dryRun, processed, updated, unchanged })
    } catch (e: any) {
      console.error('Phone normalization failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

