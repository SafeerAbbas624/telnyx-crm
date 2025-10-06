import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { elasticsearchClient } from '@/lib/search/elasticsearch-client'

function formatEsError(err: any) {
  return {
    name: err?.name,
    message: err?.message,
    statusCode: err?.meta?.statusCode,
    url: err?.meta?.meta?.request?.params?.path,
    method: err?.meta?.meta?.request?.params?.method,
    requestHeaders: err?.meta?.meta?.request?.options?.headers,
    type: err?.meta?.body?.error?.type,
    reason: err?.meta?.body?.error?.reason,
    root_cause: err?.meta?.body?.error?.root_cause,
    caused_by: err?.meta?.body?.error?.caused_by,
  }
}

async function doReindex() {
  // Ensure index exists and mappings are set
  try {
    await elasticsearchClient.initializeIndex()
  } catch (e: any) {
    throw new Error(JSON.stringify(formatEsError(e)))
  }

  const total = await prisma.contact.count()
  const pageSize = 1000
  let offset = 0
  let indexed = 0

  while (true) {
    const rows = await prisma.contact.findMany({
      skip: offset,
      take: pageSize,
      include: {
        contact_tags: { include: { tag: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!rows || rows.length === 0) break

    const documents = rows.map((c) => ({
      id: c.id,
      firstName: c.firstName || undefined,
      lastName: c.lastName || undefined,
      llcName: c.llcName || undefined,
      phone1: c.phone1 || undefined,
      phone2: c.phone2 || undefined,
      phone3: c.phone3 || undefined,
      email1: c.email1 || undefined,
      email2: c.email2 || undefined,
      email3: c.email3 || undefined,
      propertyAddress: c.propertyAddress || undefined,
      contactAddress: c.contactAddress || undefined,
      city: c.city || undefined,
      state: c.state || undefined,
      propertyCounty: c.propertyCounty || undefined,
      propertyType: c.propertyType || undefined,
      estValue: c.estValue != null ? Number(c.estValue) : undefined,
      estEquity: c.estEquity != null ? Number(c.estEquity) : undefined,
      dnc: typeof c.dnc === 'boolean' ? c.dnc : undefined,
      dealStatus: c.dealStatus || undefined,
      createdAt: c.createdAt.toISOString(),
      updatedAt: (c.updatedAt?.toISOString() || c.createdAt.toISOString()),
      tags: (c as any).contact_tags?.map((ct: any) => ct.tag.name) || [],
    }))

    try {
      await elasticsearchClient.bulkIndexContacts(documents as any)
    } catch (err: any) {
      // Surface detailed ES error information for debugging
      const info = {
        name: err?.name,
        message: err?.message,
        statusCode: err?.meta?.statusCode,
        type: err?.meta?.body?.error?.type,
        reason: err?.meta?.body?.error?.reason,
        root_cause: err?.meta?.body?.error?.root_cause,
        caused_by: err?.meta?.body?.error?.caused_by,
      }
      console.error('Bulk index failed:', info)
      throw new Error(JSON.stringify(info))
    }

    indexed += rows.length
    offset += rows.length

    if (rows.length < pageSize) break
  }

  return { ok: true, indexed, total }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await doReindex()
    return NextResponse.json(result)
  } catch (error: any) {
    const details = (error?.meta ? formatEsError(error) : (()=>{ try { return JSON.parse(error?.message) } catch { return { name: error?.name, message: error?.message || String(error) } } })())
    console.error('Reindex error (POST):', details)
    return NextResponse.json({ error: 'Failed to reindex', details }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await doReindex()
    return NextResponse.json(result)
  } catch (error: any) {
    const details = (error?.meta ? formatEsError(error) : (()=>{ try { return JSON.parse(error?.message) } catch { return { name: error?.name, message: error?.message || String(error) } } })())
    console.error('Reindex error (GET):', details)
    return NextResponse.json({ error: 'Failed to reindex', details }, { status: 500 })
  }
}

