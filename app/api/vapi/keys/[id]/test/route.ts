import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const VAPI_API_URL = 'https://api.vapi.ai'

// POST - Test Vapi API key
export async function POST(
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

    // Decrypt the API key
    const decryptedApiKey = decrypt(key.apiKey)

    // Test the API key by making a simple request to Vapi
    // We'll try to get the account info or list assistants
    let testResponse: Response
    let isValid = false
    let errorDetails = ''

    try {
      testResponse = await fetch(`${VAPI_API_URL}/assistant`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${decryptedApiKey}`,
          'Content-Type': 'application/json',
        },
      })

      isValid = testResponse.ok || testResponse.status === 200

      if (!isValid) {
        errorDetails = testResponse.statusText
        console.warn(`[VAPI][KEYS][TEST] API test failed with status ${testResponse.status}: ${errorDetails}`)
      }
    } catch (fetchError) {
      isValid = false
      errorDetails = fetchError instanceof Error ? fetchError.message : 'Network error'
      console.error(`[VAPI][KEYS][TEST] Network error during test:`, errorDetails)
    }

    // Update the test status
    try {
      await prisma.vapiApiKey.update({
        where: { id: params.id },
        data: {
          testStatus: isValid ? 'success' : 'failed',
          lastTestedAt: new Date(),
        }
      })
    } catch (updateError) {
      console.error('[VAPI][KEYS][TEST] Failed to update test status:', updateError)
    }

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: 'API key is valid',
        status: 'success'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'API key is invalid or expired',
        status: 'failed',
        details: errorDetails
      }, { status: 400 })
    }
  } catch (error) {
    console.error('[VAPI][KEYS][TEST] Error:', error)

    // Update test status to failed
    try {
      await prisma.vapiApiKey.update({
        where: { id: params.id },
        data: {
          testStatus: 'failed',
          lastTestedAt: new Date(),
        }
      })
    } catch (updateError) {
      console.error('[VAPI][KEYS][TEST] Failed to update test status:', updateError)
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to test API key',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

