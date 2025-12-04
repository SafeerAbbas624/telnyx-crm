import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET a specific Vapi API key
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const key = await prisma.vapiApiKey.findUnique({
      where: { id: params.id }
    })

    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    // Don't return encrypted values
    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        name: key.name,
        isActive: key.isActive,
        isDefault: key.isDefault,
        defaultAssistantId: key.defaultAssistantId,
        defaultPhoneNumber: key.defaultPhoneNumber,
        maxCallDuration: key.maxCallDuration,
        recordingEnabled: key.recordingEnabled,
        transcriptEnabled: key.transcriptEnabled,
        webhookUrl: key.webhookUrl,
        lastTestedAt: key.lastTestedAt,
        testStatus: key.testStatus,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      }
    })
  } catch (error) {
    console.error('[VAPI][KEYS][GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API key' },
      { status: 500 }
    )
  }
}

// PUT - Update Vapi API key
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      apiKey,
      isActive,
      isDefault,
      defaultAssistantId,
      defaultPhoneNumber,
      maxCallDuration,
      recordingEnabled,
      transcriptEnabled,
      webhookUrl,
      webhookSecret,
    } = body

    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (apiKey !== undefined) updateData.apiKey = encrypt(apiKey)
    if (isActive !== undefined) updateData.isActive = isActive
    if (isDefault !== undefined) updateData.isDefault = isDefault
    if (defaultAssistantId !== undefined) updateData.defaultAssistantId = defaultAssistantId
    if (defaultPhoneNumber !== undefined) updateData.defaultPhoneNumber = defaultPhoneNumber
    if (maxCallDuration !== undefined) updateData.maxCallDuration = maxCallDuration
    if (recordingEnabled !== undefined) updateData.recordingEnabled = recordingEnabled
    if (transcriptEnabled !== undefined) updateData.transcriptEnabled = transcriptEnabled
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
    if (webhookSecret !== undefined) updateData.webhookSecret = encrypt(webhookSecret)

    // If setting as default, unset others
    if (isDefault === true) {
      await prisma.vapiApiKey.updateMany({
        where: { id: { not: params.id } },
        data: { isDefault: false }
      })
    }

    const key = await prisma.vapiApiKey.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        name: key.name,
        isDefault: key.isDefault,
        updatedAt: key.updatedAt,
      }
    })
  } catch (error) {
    console.error('[VAPI][KEYS][PUT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    )
  }
}

// DELETE - Delete Vapi API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const key = await prisma.vapiApiKey.findUnique({
      where: { id: params.id }
    })

    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    // If deleting default key, set another as default
    if (key.isDefault) {
      const nextKey = await prisma.vapiApiKey.findFirst({
        where: { id: { not: params.id } },
        orderBy: { createdAt: 'asc' }
      })
      if (nextKey) {
        await prisma.vapiApiKey.update({
          where: { id: nextKey.id },
          data: { isDefault: true }
        })
      }
    }

    await prisma.vapiApiKey.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[VAPI][KEYS][DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}

