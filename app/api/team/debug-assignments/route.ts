import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Debug - User ID:', session.user.id)
    console.log('Debug - User Role:', session.user.role)

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        assignedEmailId: true,
        assignedPhoneNumber: true,
        assignedEmail: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            status: true
          }
        }
      }
    })

    console.log('Debug - User data:', user)

    // Get assigned contacts
    const assignedContacts = await prisma.contactAssignment.findMany({
      where: { userId: session.user.id },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email1: true,
            phone1: true
          }
        }
      }
    })

    console.log('Debug - Assigned contacts:', assignedContacts.length)

    // Get email conversations for assigned contacts
    const emailConversations = await prisma.emailConversation.findMany({
      where: {
        contact: {
          assignments: {
            some: {
              userId: session.user.id
            }
          }
        }
      },
      take: 5
    })

    console.log('Debug - Email conversations:', emailConversations.length)

    return NextResponse.json({
      user,
      assignedContacts: assignedContacts.length,
      emailConversations: emailConversations.length,
      debug: {
        userId: session.user.id,
        userRole: session.user.role,
        hasAssignedEmail: !!user?.assignedEmailId,
        hasAssignedPhone: !!user?.assignedPhoneNumber,
        assignedContactsCount: assignedContacts.length,
        emailConversationsCount: emailConversations.length
      }
    })

  } catch (error) {
    console.error('Debug API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
