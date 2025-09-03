import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For team members, get assigned email accounts
    if (session.user.role === 'TEAM_USER') {
      console.log('Team member requesting assigned email accounts:', session.user.id)

      // Get user's assigned email account ID
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { assignedEmailId: true }
      })

      console.log('User assigned email ID:', user?.assignedEmailId)

      if (!user?.assignedEmailId) {
        console.log('No assigned email ID found for team member')
        return NextResponse.json({ accounts: [] })
      }

      // Get the assigned email account
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: user.assignedEmailId },
        select: {
          id: true,
          emailAddress: true,
          displayName: true,
          status: true,
          smtpHost: true,
          isDefault: true
        }
      })

      if (!emailAccount) {
        return NextResponse.json({ accounts: [] })
      }

      return NextResponse.json({ 
        accounts: [emailAccount]
      })
    }

    // For admins, return all email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        status: true,
        smtpHost: true,
        isDefault: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ 
      accounts: emailAccounts
    })

  } catch (error) {
    console.error('Error fetching assigned email accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
