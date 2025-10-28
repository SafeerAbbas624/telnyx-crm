import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TelnyxBalanceResponse {
  data: {
    record_type: string
    pending: string
    balance: string
    credit_limit: string
    available_credit: string
    currency: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const telnyxApiKey = process.env.TELNYX_API_KEY

    if (!telnyxApiKey) {
      return NextResponse.json(
        { error: 'Telnyx API key not configured' },
        { status: 500 }
      )
    }

    // Fetch balance from Telnyx API
    const response = await fetch('https://api.telnyx.com/v2/balance', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${telnyxApiKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Telnyx API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch balance from Telnyx' },
        { status: response.status }
      )
    }

    const data: TelnyxBalanceResponse = await response.json()

    // Parse the balance data
    const balanceData = {
      balance: parseFloat(data.data.balance || '0'),
      pending: parseFloat(data.data.pending || '0'),
      creditLimit: parseFloat(data.data.credit_limit || '0'),
      availableCredit: parseFloat(data.data.available_credit || '0'),
      currency: data.data.currency || 'USD',
    }

    return NextResponse.json(balanceData)
  } catch (error) {
    console.error('Error fetching Telnyx balance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

