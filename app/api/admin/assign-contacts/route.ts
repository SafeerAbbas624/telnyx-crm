import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const body = await request.json()
      const { contactIds, userIds } = body

      // Validation
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return NextResponse.json(
          { error: 'Contact IDs are required' },
          { status: 400 }
        )
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json(
          { error: 'User IDs are required' },
          { status: 400 }
        )
      }

      // Verify all users belong to this admin
      const teamUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          adminId: adminId,
          role: 'TEAM_USER'
        }
      })

      if (teamUsers.length !== userIds.length) {
        return NextResponse.json(
          { error: 'Some users are not valid team members' },
          { status: 400 }
        )
      }

      // Verify all contacts exist
      const contacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds }
        }
      })

      if (contacts.length !== contactIds.length) {
        return NextResponse.json(
          { error: 'Some contacts do not exist' },
          { status: 400 }
        )
      }

      // Create assignments for each contact-user combination
      const assignments = []
      for (const contactId of contactIds) {
        for (const userId of userIds) {
          assignments.push({
            userId,
            contactId,
            assignedBy: adminId,
            assignedAt: new Date()
          })
        }
      }

      // Use upsert to handle existing assignments
      const results = await Promise.all(
        assignments.map(assignment =>
          prisma.contactAssignment.upsert({
            where: {
              userId_contactId: {
                userId: assignment.userId,
                contactId: assignment.contactId
              }
            },
            update: {
              assignedBy: assignment.assignedBy,
              assignedAt: assignment.assignedAt
            },
            create: assignment
          })
        )
      )

      return NextResponse.json({
        success: true,
        message: `Successfully assigned ${contactIds.length} contact(s) to ${userIds.length} team member(s)`,
        assignmentsCreated: results.length
      })
    } catch (error) {
      console.error('Error assigning contacts:', error)
      return NextResponse.json(
        { error: 'Failed to assign contacts' },
        { status: 500 }
      )
    }
  })
}

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { searchParams } = new URL(request.url)
      const contactId = searchParams.get('contactId')
      const userId = searchParams.get('userId')

      let where: any = {
        assignedByUser: {
          id: adminId
        }
      }

      if (contactId) {
        where.contactId = contactId
      }

      if (userId) {
        where.userId = userId
      }

      const assignments = await prisma.contactAssignment.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email1: true,
              phone1: true
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          assignedAt: 'desc'
        }
      })

      return NextResponse.json({
        assignments: assignments.map(assignment => ({
          id: assignment.id,
          contact: assignment.contact,
          user: assignment.user,
          assignedAt: assignment.assignedAt.toISOString()
        }))
      })
    } catch (error) {
      console.error('Error fetching contact assignments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch contact assignments' },
        { status: 500 }
      )
    }
  })
}

export async function DELETE(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const { searchParams } = new URL(request.url)
      const contactId = searchParams.get('contactId')
      const userId = searchParams.get('userId')

      if (!contactId || !userId) {
        return NextResponse.json(
          { error: 'Contact ID and User ID are required' },
          { status: 400 }
        )
      }

      // Verify the assignment belongs to this admin's team
      const assignment = await prisma.contactAssignment.findUnique({
        where: {
          userId_contactId: {
            userId,
            contactId
          }
        },
        include: {
          assignedByUser: true
        }
      })

      if (!assignment || assignment.assignedByUser.id !== adminId) {
        return NextResponse.json(
          { error: 'Assignment not found or not authorized' },
          { status: 404 }
        )
      }

      await prisma.contactAssignment.delete({
        where: {
          userId_contactId: {
            userId,
            contactId
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Contact assignment removed successfully'
      })
    } catch (error) {
      console.error('Error removing contact assignment:', error)
      return NextResponse.json(
        { error: 'Failed to remove contact assignment' },
        { status: 500 }
      )
    }
  })
}
