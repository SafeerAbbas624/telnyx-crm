import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      // Get all email accounts (email accounts are global, not tied to specific users)
      const emailAccounts = await prisma.emailAccount.findMany({
        where: {
          status: 'active'
        },
        select: {
          id: true,
          emailAddress: true,
          displayName: true,
          status: true,
          isDefault: true
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      })

      return NextResponse.json({
        accounts: emailAccounts
      })
    } catch (error) {
      console.error('Error fetching email accounts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch email accounts' },
        { status: 500 }
      )
    }
  })
}

