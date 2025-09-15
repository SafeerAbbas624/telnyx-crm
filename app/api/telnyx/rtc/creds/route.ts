import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Returns WebRTC/SIP credentials to authenticated clients
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const login = process.env.TELNYX_RTC_LOGIN
  const password = process.env.TELNYX_RTC_PASSWORD
  const sipDomain = process.env.TELNYX_RTC_SIP_DOMAIN || 'sip.telnyx.com'

  if (!login || !password) {
    return NextResponse.json({ error: 'RTC credentials not configured' }, { status: 500 })
  }

  return NextResponse.json({ login, password, sipDomain })
}

