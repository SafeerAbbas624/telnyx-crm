import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(request.url)
      const activeOnly = searchParams.get('active') === 'true'

      // Build where clause
      const where: any = {}
      
      if (activeOnly) {
        where.isActive = true
      }

      const phoneNumbers = await prisma.telnyxPhoneNumber.findMany({
        where,
        select: {
          id: true,
          phoneNumber: true,
          telnyxId: true,
          state: true,
          city: true,
          country: true,
          isActive: true,
          capabilities: true,
          monthlyPrice: true,
          setupPrice: true,
          purchasedAt: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: [
          { isActive: 'desc' },
          { phoneNumber: 'asc' }
        ]
      })

      // Transform data to match expected format
      const formattedNumbers = phoneNumbers.map(number => ({
        id: number.id,
        number: number.phoneNumber,
        telnyxId: number.telnyxId,
        state: number.state,
        city: number.city,
        country: number.country,
        status: number.isActive ? 'active' : 'inactive',
        capabilities: number.capabilities,
        monthlyPrice: number.monthlyPrice,
        setupPrice: number.setupPrice,
        purchasedAt: number.purchasedAt.toISOString(),
        lastUsedAt: number.lastUsedAt?.toISOString(),
        createdAt: number.createdAt.toISOString(),
      }))

      return NextResponse.json({
        numbers: formattedNumbers,
        total: formattedNumbers.length
      })
    } catch (error) {
      console.error('Error fetching Telnyx phone numbers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch phone numbers' },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const body = await request.json()
      const {
        phoneNumber,
        telnyxId,
        state,
        city,
        country = 'US',
        capabilities = ['SMS', 'VOICE'],
        monthlyPrice,
        setupPrice
      } = body

      // Validation
      if (!phoneNumber) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        )
      }

      // Check if phone number already exists
      const existingNumber = await prisma.telnyxPhoneNumber.findUnique({
        where: { phoneNumber }
      })

      if (existingNumber) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 409 }
        )
      }

      const newNumber = await prisma.telnyxPhoneNumber.create({
        data: {
          phoneNumber,
          telnyxId,
          state,
          city,
          country,
          capabilities,
          monthlyPrice: monthlyPrice ? parseFloat(monthlyPrice) : null,
          setupPrice: setupPrice ? parseFloat(setupPrice) : null,
          isActive: true,
        }
      })

      return NextResponse.json({
        success: true,
        number: {
          id: newNumber.id,
          number: newNumber.phoneNumber,
          telnyxId: newNumber.telnyxId,
          state: newNumber.state,
          city: newNumber.city,
          country: newNumber.country,
          status: 'active',
          capabilities: newNumber.capabilities,
          monthlyPrice: newNumber.monthlyPrice,
          setupPrice: newNumber.setupPrice,
          createdAt: newNumber.createdAt.toISOString(),
        }
      })
    } catch (error) {
      console.error('Error creating Telnyx phone number:', error)
      return NextResponse.json(
        { error: 'Failed to create phone number' },
        { status: 500 }
      )
    }
  })
}

export async function PUT(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const body = await request.json()
      const { id, ...updateData } = body

      if (!id) {
        return NextResponse.json(
          { error: 'Phone number ID is required' },
          { status: 400 }
        )
      }

      // Convert price strings to numbers if provided
      if (updateData.monthlyPrice) {
        updateData.monthlyPrice = parseFloat(updateData.monthlyPrice)
      }
      if (updateData.setupPrice) {
        updateData.setupPrice = parseFloat(updateData.setupPrice)
      }

      const updatedNumber = await prisma.telnyxPhoneNumber.update({
        where: { id },
        data: updateData
      })

      return NextResponse.json({
        success: true,
        number: {
          id: updatedNumber.id,
          number: updatedNumber.phoneNumber,
          telnyxId: updatedNumber.telnyxId,
          state: updatedNumber.state,
          city: updatedNumber.city,
          country: updatedNumber.country,
          status: updatedNumber.isActive ? 'active' : 'inactive',
          capabilities: updatedNumber.capabilities,
          monthlyPrice: updatedNumber.monthlyPrice,
          setupPrice: updatedNumber.setupPrice,
          updatedAt: updatedNumber.updatedAt.toISOString(),
        }
      })
    } catch (error) {
      console.error('Error updating Telnyx phone number:', error)
      return NextResponse.json(
        { error: 'Failed to update phone number' },
        { status: 500 }
      )
    }
  })
}

export async function DELETE(request: NextRequest) {
  return withAdminAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')

      if (!id) {
        return NextResponse.json(
          { error: 'Phone number ID is required' },
          { status: 400 }
        )
      }

      await prisma.telnyxPhoneNumber.delete({
        where: { id }
      })

      return NextResponse.json({
        success: true,
        message: 'Phone number deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting Telnyx phone number:', error)
      return NextResponse.json(
        { error: 'Failed to delete phone number' },
        { status: 500 }
      )
    }
  })
}
