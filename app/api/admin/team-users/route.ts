import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub

      const teamUsers = await prisma.user.findMany({
        where: {
          adminId: adminId,
          role: 'TEAM_USER'
        },
        include: {
          assignedEmail: {
            select: {
              id: true,
              emailAddress: true,
              displayName: true
            }
          },
          defaultPhoneNumber: {
            select: {
              id: true,
              phoneNumber: true,
              friendlyName: true
            }
          },
          allowedPhoneNumbers: {
            include: {
              phoneNumber: {
                select: {
                  id: true,
                  phoneNumber: true,
                  friendlyName: true
                }
              }
            }
          },
          _count: {
            select: {
              assignedContacts: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      const formattedUsers = teamUsers.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
        assignedPhoneNumber: user.assignedPhoneNumber,
        assignedEmailId: user.assignedEmailId,
        assignedEmail: user.assignedEmail,
        defaultPhoneNumberId: user.defaultPhoneNumber?.id,
        defaultPhoneNumber: user.defaultPhoneNumber,
        allowedPhoneNumbers: user.allowedPhoneNumbers.map(ap => ap.phoneNumber),
        allowedPhoneNumbersCount: user.allowedPhoneNumbers.length,
        assignedContactsCount: user._count.assignedContacts,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString()
      }))

      return NextResponse.json({
        users: formattedUsers
      })
    } catch (error) {
      console.error('Error fetching team users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch team users' },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const adminId = user.sub
      const body = await request.json()
      const { 
        firstName, 
        lastName, 
        email, 
        password, 
        assignedPhoneNumber, 
        assignedEmailId 
      } = body

      // Validation
      if (!firstName || !lastName || !email || !password) {
        return NextResponse.json(
          { error: 'First name, last name, email, and password are required' },
          { status: 400 }
        )
      }

      if (!assignedPhoneNumber || !assignedEmailId) {
        return NextResponse.json(
          { error: 'Both phone number and email account must be assigned' },
          { status: 400 }
        )
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }

      // Verify email account exists and belongs to admin's organization
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: assignedEmailId }
      })

      if (!emailAccount) {
        return NextResponse.json(
          { error: 'Email account not found' },
          { status: 400 }
        )
      }

      // Check if phone number or email is already assigned to another user
      const existingAssignments = await prisma.user.findFirst({
        where: {
          OR: [
            { assignedPhoneNumber },
            { assignedEmailId }
          ],
          adminId: adminId,
          status: 'active'
        }
      })

      if (existingAssignments) {
        return NextResponse.json(
          { error: 'Phone number or email account is already assigned to another user' },
          { status: 409 }
        )
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Create team user
      const teamUser = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          role: 'TEAM_USER',
          status: 'active',
          adminId: adminId,
          assignedPhoneNumber,
          assignedEmailId
        },
        include: {
          assignedEmail: {
            select: {
              id: true,
              emailAddress: true,
              displayName: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        user: {
          id: teamUser.id,
          firstName: teamUser.firstName,
          lastName: teamUser.lastName,
          email: teamUser.email,
          status: teamUser.status,
          assignedPhoneNumber: teamUser.assignedPhoneNumber,
          assignedEmailId: teamUser.assignedEmailId,
          assignedEmail: teamUser.assignedEmail,
          createdAt: teamUser.createdAt.toISOString()
        }
      })
    } catch (error) {
      console.error('Error creating team user:', error)
      return NextResponse.json(
        { error: 'Failed to create team user' },
        { status: 500 }
      )
    }
  })
}
