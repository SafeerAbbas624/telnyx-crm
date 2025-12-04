import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET all Vapi API keys
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const keys = await prisma.vapiApiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        isDefault: true,
        defaultAssistantId: true,
        defaultPhoneNumber: true,
        maxCallDuration: true,
        recordingEnabled: true,
        transcriptEnabled: true,
        lastTestedAt: true,
        testStatus: true,
        createdAt: true,
        updatedAt: true,
        // Don't return encrypted keys
      }
    })

    return NextResponse.json({ success: true, keys })
  } catch (error) {
    console.error('[VAPI][KEYS][GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

// POST - Create new Vapi API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      apiKey,
      defaultAssistantId,
      defaultPhoneNumber,
      maxCallDuration = 600,
      recordingEnabled = true,
      transcriptEnabled = true,
      webhookUrl,
      webhookSecret,
    } = body

    if (!name || !apiKey) {
      return NextResponse.json(
        { error: 'Name and API key are required' },
        { status: 400 }
      )
    }

    // Encrypt the API key
    const encryptedApiKey = encrypt(apiKey)
    const encryptedWebhookSecret = webhookSecret ? encrypt(webhookSecret) : null

    // If this is the first key or marked as default, make it default
    const existingKeys = await prisma.vapiApiKey.findMany()
    const isDefault = existingKeys.length === 0

    const key = await prisma.vapiApiKey.create({
      data: {
        name,
        apiKey: encryptedApiKey,
        isActive: true,
        isDefault,
        defaultAssistantId,
        defaultPhoneNumber,
        maxCallDuration,
        recordingEnabled,
        transcriptEnabled,
        webhookUrl,
        webhookSecret: encryptedWebhookSecret,
      }
    })

    return NextResponse.json({
      success: true,
      key: {
        id: key.id,
        name: key.name,
        isDefault: key.isDefault,
        createdAt: key.createdAt,
      }
    })
  } catch (error) {
    console.error('[VAPI][KEYS][POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

