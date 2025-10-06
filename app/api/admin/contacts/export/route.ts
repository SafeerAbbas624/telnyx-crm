import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

// Prevent CSV formula injection
function safeCell(value: any): string {
  const s = String(value ?? '')
  // Escape quotes
  const escaped = s.replace(/"/g, '""')
  // Prevent spreadsheet formulas
  const prefixed = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped
  return `"${prefixed}"`
}

function formatNumber(n: any): string {
  if (n === null || n === undefined) return ''
  const num = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(num) ? String(num) : ''
}

function toIso(d: any): string {
  try {
    if (!d) return ''
    const date = d instanceof Date ? d : new Date(d)
    return date.toISOString()
  } catch {
    return ''
  }
}

function buildWhere(filters: any) {
  const {
    search,
    dealStatus,
    propertyType,
    city,
    state,
    propertyCounty,
    tags,
    minValue,
    maxValue,
    minEquity,
    maxEquity,
  } = filters || {}

  const where: any = {}

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { llcName: { contains: search, mode: 'insensitive' } },
      { phone1: { contains: search } },
      { email1: { contains: search, mode: 'insensitive' } },
      { propertyAddress: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (dealStatus) where.dealStatus = dealStatus
  if (propertyType) where.propertyType = propertyType
  if (city) where.city = { contains: city, mode: 'insensitive' }
  if (state) where.state = { contains: state, mode: 'insensitive' }
  if (propertyCounty) where.propertyCounty = { contains: propertyCounty, mode: 'insensitive' }
  if (tags) {
    const tagNames = String(tags).split(',').map((t) => t.trim())
    where.contact_tags = { some: { tag: { name: { in: tagNames } } } }
  }
  if (minValue !== undefined || maxValue !== undefined) {
    where.estValue = {}
    if (minValue !== undefined) where.estValue.gte = Number(minValue)
    if (maxValue !== undefined) where.estValue.lte = Number(maxValue)
  }
  if (minEquity !== undefined || maxEquity !== undefined) {
    where.estEquity = {}
    if (minEquity !== undefined) where.estEquity.gte = Number(minEquity)
    if (maxEquity !== undefined) where.estEquity.lte = Number(maxEquity)
  }

  return where
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const body = await req.json().catch(() => ({}))
      const {
        selectedIds,
        exportAllMatching = true,
        // Accept flat filter keys at root for convenience
        search,
        dealStatus,
        propertyType,
        city,
        state,
        propertyCounty,
        tags,
        minValue,
        maxValue,
        minEquity,
        maxEquity,
      } = body || {}

      let where: any = {}

      if (!exportAllMatching && Array.isArray(selectedIds) && selectedIds.length > 0) {
        where.id = { in: selectedIds }
      } else {
        where = buildWhere({ search, dealStatus, propertyType, city, state, propertyCounty, tags, minValue, maxValue, minEquity, maxEquity })
      }

      const headers = new Headers()
      headers.set('Content-Type', 'text/csv; charset=utf-8')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      headers.set('Content-Disposition', `attachment; filename="contacts-${ts}.csv"`)
      headers.set('Cache-Control', 'no-store')

      const encoder = new TextEncoder()

      const stream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          // Write header
          const columns = [
            'id','firstName','lastName','llcName',
            'phone1','phone2','phone3',
            'email1','email2','email3',
            'propertyAddress','contactAddress','city','state','propertyCounty','propertyType',
            'bedrooms','totalBathrooms','buildingSqft','effectiveYearBuilt',
            'estValue','estEquity',
            'dealStatus','dnc','dncReason',
            'notes',
            'tags',
            'createdAt','updatedAt'
          ]
          controller.enqueue(encoder.encode(columns.map(safeCell).join(',') + '\n'))

          const pageSize = 1000
          let cursor: string | null = null

          while (true) {
            const batch = await prisma.contact.findMany({
              where,
              select: {
                id: true,
                firstName: true,
                lastName: true,
                llcName: true,
                phone1: true,
                phone2: true,
                phone3: true,
                email1: true,
                email2: true,
                email3: true,
                propertyAddress: true,
                contactAddress: true,
                city: true,
                state: true,
                propertyCounty: true,
                propertyType: true,
                bedrooms: true,
                totalBathrooms: true,
                buildingSqft: true,
                effectiveYearBuilt: true,
                estValue: true,
                estEquity: true,
                dealStatus: true,
                dnc: true,
                dncReason: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                contact_tags: {
                  select: { tag: { select: { name: true } } }
                },
              },
              orderBy: { id: 'asc' },
              ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
              take: pageSize,
            })

            if (!batch || batch.length === 0) break

            for (const c of batch) {
              const tagsJoined = (c.contact_tags || []).map((ct) => ct.tag?.name).filter(Boolean).join('|')
              const row = [
                c.id,
                c.firstName,
                c.lastName,
                c.llcName,
                c.phone1,
                c.phone2,
                c.phone3,
                c.email1,
                c.email2,
                c.email3,
                c.propertyAddress,
                c.contactAddress,
                c.city,
                c.state,
                c.propertyCounty,
                c.propertyType,
                c.bedrooms,
                c.totalBathrooms ? Number(c.totalBathrooms) : '',
                c.buildingSqft,
                c.effectiveYearBuilt,
                formatNumber(c.estValue),
                formatNumber(c.estEquity),
                c.dealStatus,
                c.dnc ? 'true' : 'false',
                c.dncReason,
                c.notes,
                tagsJoined,
                toIso(c.createdAt),
                toIso(c.updatedAt || c.createdAt),
              ]
              controller.enqueue(encoder.encode(row.map(safeCell).join(',') + '\n'))
            }

            cursor = batch[batch.length - 1].id
            if (batch.length < pageSize) break
          }

          controller.close()
        }
      })

      return new Response(stream, { headers })
    } catch (error) {
      console.error('Error exporting contacts:', error)
      return NextResponse.json({ error: 'Failed to export contacts' }, { status: 500 })
    }
  })
}

