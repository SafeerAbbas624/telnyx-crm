import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VAPI_API_URL = 'https://api.vapi.ai'
const MAX_LIMIT = 1000
const DEFAULT_LIMIT = 50

// GET - Fetch Vapi calls
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let limit = parseInt(searchParams.get('limit') || DEFAULT_LIMIT.toString())
    let offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const contactId = searchParams.get('contactId')

    // Validate pagination parameters
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT
    if (limit > MAX_LIMIT) limit = MAX_LIMIT
    if (isNaN(offset) || offset < 0) offset = 0

    const where: any = {}
    if (status) where.status = status
    if (contactId) where.customer_id = contactId

    const calls = await prisma.vapiCall.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        vapi_call_id: true,
        customer_id: true,
        name: true,
        type: true,
        status: true,
        ended_reason: true,
        started_at: true,
        ended_at: true,
        duration: true,
        cost: true,
        transcript: true,
        recording_url: true,
        summary: true,
        created_at: true,
      }
    })

    const total = await prisma.vapiCall.count({ where })

    return NextResponse.json({
      success: true,
      calls,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('[VAPI][CALLS][GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}

// Rate limiting helper
const callAttempts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 100 // max calls per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userAttempts = callAttempts.get(userId)

  if (!userAttempts || now > userAttempts.resetTime) {
    callAttempts.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userAttempts.count >= RATE_LIMIT_MAX) {
    return false
  }

  userAttempts.count++
  return true
}

// Exponential backoff helper
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '1')
        const waitTime = Math.min(1000 * Math.pow(2, attempt), retryAfter * 1000)
        console.log(`[VAPI][CALLS] Rate limited, retrying after ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const waitTime = 1000 * Math.pow(2, attempt)
        console.log(`[VAPI][CALLS] Attempt ${attempt + 1} failed, retrying after ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// POST - Create and start Vapi calls
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check rate limit
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 100 calls per minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      contactIds,
      assistantId,
      phoneNumber,
      apiKeyId,
    } = body

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    // Get the API key
    let apiKey = apiKeyId
    if (!apiKey) {
      const defaultKey = await prisma.vapiApiKey.findFirst({
        where: { isDefault: true, isActive: true }
      })
      if (!defaultKey) {
        return NextResponse.json(
          { error: 'No Vapi API key configured' },
          { status: 400 }
        )
      }
      apiKey = defaultKey.id
    }

    const keyRecord = await prisma.vapiApiKey.findUnique({
      where: { id: apiKey }
    })

    if (!keyRecord) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    const decryptedApiKey = decrypt(keyRecord.apiKey)
    const finalAssistantId = assistantId || keyRecord.defaultAssistantId
    const finalPhoneNumber = phoneNumber || keyRecord.defaultPhoneNumber

    if (!finalAssistantId || !finalPhoneNumber) {
      return NextResponse.json(
        { error: 'Assistant ID and phone number are required' },
        { status: 400 }
      )
    }

    // Create calls for each contact
    const createdCalls = []
    const failedCalls = []

    for (const contactId of contactIds) {
      try {
        // Get contact details
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
            phone2: true,
            phone3: true,
          }
        })

        if (!contact) {
          console.warn(`[VAPI][CALLS] Contact not found: ${contactId}`)
          failedCalls.push({ contactId, reason: 'Contact not found' })
          continue
        }

        // Get first available phone number
        const toNumber = contact.phone1 || contact.phone2 || contact.phone3
        if (!toNumber) {
          console.warn(`[VAPI][CALLS] No phone number for contact: ${contactId}`)
          failedCalls.push({ contactId, reason: 'No phone number' })
          continue
        }

        // Make API call to Vapi with retry logic
        const vapiResponse = await fetchWithRetry(
          `${VAPI_API_URL}/call`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${decryptedApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              assistantId: finalAssistantId,
              phoneNumberId: finalPhoneNumber,
              customerNumber: toNumber,
              customerName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
              recordingEnabled: keyRecord.recordingEnabled,
              transcriptEnabled: keyRecord.transcriptEnabled,
              maxDurationSeconds: keyRecord.maxCallDuration,
            })
          }
        )

        if (!vapiResponse.ok) {
          const errorText = await vapiResponse.text()
          console.error(`[VAPI][CALLS] Failed to create call for ${contactId}:`, vapiResponse.status, errorText)
          failedCalls.push({ contactId, reason: `API error: ${vapiResponse.status}` })
          continue
        }

        const vapiData = await vapiResponse.json()

        // Save call to database
        const savedCall = await prisma.vapiCall.create({
          data: {
            vapi_call_id: vapiData.id,
            customer_id: contactId,
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            type: 'outboundPhoneCall',
            status: 'queued',
            phone_call_provider: 'vapi',
            phone_call_transport: 'pstn',
            assistant_id: finalAssistantId,
            phone_number_id: finalPhoneNumber,
          }
        })

        createdCalls.push({
          id: savedCall.id,
          vapiCallId: vapiData.id,
          contactId,
          status: 'queued'
        })
      } catch (callError) {
        console.error(`[VAPI][CALLS] Error creating call for ${contactId}:`, callError)
        failedCalls.push({
          contactId,
          reason: callError instanceof Error ? callError.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      callsCreated: createdCalls.length,
      callsFailed: failedCalls.length,
      calls: createdCalls,
      failed: failedCalls.length > 0 ? failedCalls : undefined
    })
  } catch (error) {
    console.error('[VAPI][CALLS][POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create calls', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

