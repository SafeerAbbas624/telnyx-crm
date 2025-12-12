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
          role: { in: ['PROCESSOR', 'ORIGINATOR', 'ADMIN'] }
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
        role: user.role,
        status: user.status,
        allowedSections: user.allowedSections || [],
        assignedPhoneNumber: user.assignedPhoneNumber,
        assignedEmailId: user.assignedEmailId,
        assignedEmail: user.assignedEmail,
        defaultPhoneNumberId: user.defaultPhoneNumber?.id,
        defaultPhoneNumber: user.defaultPhoneNumber,
        allowedPhoneNumbers: user.allowedPhoneNumbers.map(ap => ap.phoneNumber?.phoneNumber).filter(Boolean),
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
        role = 'PROCESSOR',
        allowedSections = [],
        allowedPhoneNumbers = [],
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

      // Validate role
      if (!['ADMIN', 'PROCESSOR', 'ORIGINATOR'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be ADMIN, PROCESSOR, or ORIGINATOR' },
          { status: 400 }
        )
      }

      // For non-admin roles, require at least one section
      if (role !== 'ADMIN' && (!allowedSections || allowedSections.length === 0)) {
        return NextResponse.json(
          { error: 'At least one section must be selected for non-admin users' },
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

      // Verify email account exists if provided
      if (assignedEmailId) {
        const emailAccount = await prisma.emailAccount.findUnique({
          where: { id: assignedEmailId }
        })

        if (!emailAccount) {
          return NextResponse.json(
            { error: 'Email account not found' },
            { status: 400 }
          )
        }
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
          role: role as 'ADMIN' | 'PROCESSOR' | 'ORIGINATOR',
          allowedSections: role === 'ADMIN' ? [] : allowedSections,
          status: 'active',
          adminId: adminId,
          assignedPhoneNumber: assignedPhoneNumber || null,
          assignedEmailId: assignedEmailId || null
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

      // If phone numbers are specified for non-admin, create allowedPhoneNumbers relations
      if (role !== 'ADMIN' && allowedPhoneNumbers.length > 0) {
        // Find matching TelnyxPhoneNumber records
        const phoneRecords = await prisma.telnyxPhoneNumber.findMany({
          where: {
            phoneNumber: { in: allowedPhoneNumbers }
          }
        })

        // Create UserAllowedPhoneNumber records
        await prisma.userAllowedPhoneNumber.createMany({
          data: phoneRecords.map(phone => ({
            userId: teamUser.id,
            phoneNumberId: phone.id
          }))
        })
      }

      return NextResponse.json({
        success: true,
        user: {
          id: teamUser.id,
          firstName: teamUser.firstName,
          lastName: teamUser.lastName,
          email: teamUser.email,
          role: teamUser.role,
          allowedSections: teamUser.allowedSections,
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
