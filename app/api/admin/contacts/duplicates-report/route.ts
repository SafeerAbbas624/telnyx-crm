import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'
import { formatPhoneNumberForTelnyx } from '@/lib/phone-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Report duplicates by rule: phone (E.164 of phone1) + full name (case-insensitive) + propertyAddress (case-insensitive)
// Returns groups with more than 1 contact
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '0') // 0 = no limit
      const batchSize = parseInt(searchParams.get('batchSize') || '1000')

      let page = 0
      const map = new Map<string, any[]>()

      // eslint-disable-next-line no-constant-condition
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
            updatedAt: true,
          }
        })
        if (contacts.length === 0) break

        for (const c of contacts) {
          const name = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim().toLowerCase()
          const phone = formatPhoneNumberForTelnyx(c.phone1 || '') || (c.phone1 || '').trim()
          const addr = (c.propertyAddress || '').trim().toLowerCase()
          if (!name || !phone || !addr) continue
          const key = `${phone}__${name}__${addr}`
          const arr = map.get(key) || []
          arr.push(c)
          map.set(key, arr)
        }

        page++
      }

      // Build groups
      const groups: Array<{ key: { phone: string; name: string; propertyAddress: string }, contacts: any[]; count: number }> = []
      for (const [k, arr] of map.entries()) {
        if (arr.length > 1) {
          const [phone, name, addr] = k.split('__')
          // Sort newest first
          arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          groups.push({ key: { phone, name, propertyAddress: addr }, contacts: arr, count: arr.length })
        }
      }

      // Optional limit on number of groups returned
      const result = limit > 0 ? groups.slice(0, limit) : groups

      return NextResponse.json({ success: true, totalGroups: result.length, groups: result })
    } catch (e: any) {
      console.error('duplicates-report failed:', e)
      return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
    }
  })
}

