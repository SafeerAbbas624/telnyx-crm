import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(request.url)
      const phoneNumber = searchParams.get('phoneNumber')
      const recordType = searchParams.get('recordType') // 'sms' or 'call' or 'all'
      const days = parseInt(searchParams.get('days') || '7')
      const exportCsv = searchParams.get('export') === 'true'

      // Calculate date filter
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - days)

      const records: any[] = []

      // Fetch SMS billing records
      if (!recordType || recordType === 'all' || recordType === 'sms') {
        const smsWhere: any = {
          billingDate: {
            gte: daysAgo
          }
        }

        if (phoneNumber && phoneNumber !== 'all') {
          smsWhere.phoneNumber = phoneNumber
        }

        const smsRecords = await prisma.telnyxBilling.findMany({
          where: smsWhere,
          orderBy: {
            billingDate: 'desc'
          },
          take: 1000
        })

        // Transform SMS records
        for (const sms of smsRecords) {
          // Extract contact from description
          let contact = 'Unknown'
          if (sms.description) {
            const match = sms.description.match(/from \+(\d+)|to \+(\d+)/)
            if (match) {
              const number = '+' + (match[1] || match[2])
              // Try to find contact by phone number
              const contactRecord = await prisma.contact.findFirst({
                where: {
                  OR: [
                    { phone1: number },
                    { phone2: number },
                    { phone3: number }
                  ]
                },
                select: {
                  firstName: true,
                  lastName: true
                }
              })
              
              if (contactRecord) {
                contact = `${contactRecord.firstName} ${contactRecord.lastName}`
              } else {
                contact = number
              }
            }
          }

          const isInbound = sms.description?.includes('Inbound') || false

          records.push({
            id: sms.id,
            phoneNumber: sms.phoneNumber,
            recordType: isInbound ? 'sms_inbound' : 'sms_outbound',
            cost: Number(sms.cost),
            timestamp: sms.billingDate.toISOString(),
            contact: contact,
            duration: null
          })
        }
      }

      // Fetch Call billing records
      if (!recordType || recordType === 'all' || recordType === 'call') {
        const callWhere: any = {
          createdAt: {
            gte: daysAgo
          },
          cost: {
            not: null
          }
        }

        if (phoneNumber && phoneNumber !== 'all') {
          callWhere.fromNumber = phoneNumber
        }

        const callRecords = await prisma.telnyxCall.findMany({
          where: callWhere,
          orderBy: {
            createdAt: 'desc'
          },
          take: 1000
        })

        // Transform call records
        for (const call of callRecords) {
          // Find contact
          let contact = 'Unknown'
          const contactNumber = call.direction === 'outbound' ? call.toNumber : call.fromNumber
          
          const contactRecord = await prisma.contact.findFirst({
            where: {
              OR: [
                { phone1: contactNumber },
                { phone2: contactNumber },
                { phone3: contactNumber }
              ]
            },
            select: {
              firstName: true,
              lastName: true
            }
          })
          
          if (contactRecord) {
            contact = `${contactRecord.firstName} ${contactRecord.lastName}`
          } else {
            contact = contactNumber
          }

          records.push({
            id: call.id,
            phoneNumber: call.fromNumber,
            recordType: call.direction === 'inbound' ? 'call_inbound' : 'call_outbound',
            cost: Number(call.cost || 0),
            timestamp: call.createdAt.toISOString(),
            contact: contact,
            duration: call.duration || 0
          })
        }
      }

      // Sort all records by timestamp descending
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Calculate summary
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0)
      const smsCost = records
        .filter(r => r.recordType.startsWith('sms'))
        .reduce((sum, r) => sum + r.cost, 0)
      const callCost = records
        .filter(r => r.recordType.startsWith('call'))
        .reduce((sum, r) => sum + r.cost, 0)

      const summary = {
        totalCost,
        smsCost,
        callCost
      }

      // Export CSV if requested
      if (exportCsv) {
        const csvHeaders = [
          'Type',
          'Phone Number',
          'Contact',
          'Timestamp',
          'Duration',
          'Cost'
        ]

        const csvRows = records.map(record => [
          record.recordType,
          record.phoneNumber,
          record.contact,
          record.timestamp,
          record.duration ? `${record.duration}s` : '-',
          record.cost.toFixed(4)
        ])

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n')

        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="billing-export-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      }

      return NextResponse.json({
        records,
        summary
      })
    } catch (error) {
      console.error('Error fetching billing records:', error)
      return NextResponse.json(
        { error: 'Failed to fetch billing records' },
        { status: 500 }
      )
    }
  })
}

