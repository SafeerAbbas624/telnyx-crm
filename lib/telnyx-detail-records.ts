/**
 * Telnyx Detail Records API Integration
 * 
 * This module provides functions to fetch exact billing costs from Telnyx's Detail Records API.
 * This is more reliable than webhook cost data which may not always be sent.
 */

interface TelnyxDetailRecordResponse {
  data: Array<{
    // Common fields
    record_type: string
    id?: string
    uuid?: string
    created_at?: string
    
    // Call-specific fields
    call_leg_id?: string
    call_session_id?: string
    call_control_id?: string
    call_sec?: number
    billed_sec?: number
    rate?: string
    rate_measured_in?: string
    cost?: string
    currency?: string
    is_telnyx_billable?: boolean
    
    // Conference participant fields
    conference_id?: string
    destination_number?: string
    originating_number?: string
    joined_at?: string
    left_at?: string
    
    // Message fields
    cld?: string
    cli?: string
    direction?: string
    status?: string
    message_type?: string
    parts?: number
    carrier?: string
    carrier_fee?: string
    completed_at?: string
    sent_at?: string
  }>
  meta?: {
    total_pages?: number
    total_results?: number
    page_number?: number
    page_size?: number
  }
}

/**
 * Fetch call detail record by call_leg_id (call_control_id)
 */
export async function fetchCallDetailRecord(callControlId: string): Promise<{
  cost: number | null
  currency: string
  rate: number | null
  billedSeconds: number | null
  callSeconds: number | null
  found: boolean
}> {
  const telnyxApiKey = process.env.TELNYX_API_KEY
  
  if (!telnyxApiKey) {
    console.error('[TELNYX DETAIL RECORDS] Missing TELNYX_API_KEY')
    return { cost: null, currency: 'USD', rate: null, billedSeconds: null, callSeconds: null, found: false }
  }

  try {
    // Search for call detail records by call_leg_id
    // Note: We search for conference_participant_detail_record which contains call cost info
    const url = new URL('https://api.telnyx.com/v2/detail_records')
    url.searchParams.append('filter[record_type]', 'conference_participant_detail_record')
    url.searchParams.append('filter[call_leg_id]', callControlId)
    url.searchParams.append('page[size]', '10')

    console.log('[TELNYX DETAIL RECORDS] Fetching call cost for:', callControlId)
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${telnyxApiKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[TELNYX DETAIL RECORDS] API error:', response.status, errorText)
      return { cost: null, currency: 'USD', rate: null, billedSeconds: null, callSeconds: null, found: false }
    }

    const data: TelnyxDetailRecordResponse = await response.json()
    
    console.log('[TELNYX DETAIL RECORDS] Response:', {
      totalResults: data.meta?.total_results,
      recordCount: data.data?.length,
    })

    if (!data.data || data.data.length === 0) {
      console.log('[TELNYX DETAIL RECORDS] No records found for call:', callControlId)
      return { cost: null, currency: 'USD', rate: null, billedSeconds: null, callSeconds: null, found: false }
    }

    // Find the conference participant record (has cost info)
    const conferenceParticipant = data.data.find(
      record => record.record_type === 'conference_participant_detail_record'
    )

    if (conferenceParticipant) {
      const cost = conferenceParticipant.cost ? parseFloat(conferenceParticipant.cost) : null
      const currency = conferenceParticipant.currency || 'USD'
      const rate = conferenceParticipant.rate ? parseFloat(conferenceParticipant.rate) : null
      const billedSeconds = conferenceParticipant.billed_sec ?? null
      const callSeconds = conferenceParticipant.call_sec ?? null

      console.log('[TELNYX DETAIL RECORDS] Found conference participant record:', {
        callControlId,
        cost,
        currency,
        rate,
        billedSeconds,
        callSeconds,
        isBillable: conferenceParticipant.is_telnyx_billable,
      })

      return {
        cost,
        currency,
        rate,
        billedSeconds,
        callSeconds,
        found: true,
      }
    }

    // If no conference participant record, check for other call-related records
    const callRecord = data.data.find(
      record => record.call_leg_id === callControlId && record.cost
    )

    if (callRecord) {
      const cost = callRecord.cost ? parseFloat(callRecord.cost) : null
      const currency = callRecord.currency || 'USD'
      const rate = callRecord.rate ? parseFloat(callRecord.rate) : null
      const billedSeconds = callRecord.billed_sec ?? null
      const callSeconds = callRecord.call_sec ?? null

      console.log('[TELNYX DETAIL RECORDS] Found call record:', {
        callControlId,
        recordType: callRecord.record_type,
        cost,
        currency,
        rate,
      })

      return {
        cost,
        currency,
        rate,
        billedSeconds,
        callSeconds,
        found: true,
      }
    }

    console.log('[TELNYX DETAIL RECORDS] No cost data in records for call:', callControlId)
    return { cost: null, currency: 'USD', rate: null, billedSeconds: null, callSeconds: null, found: false }

  } catch (error) {
    console.error('[TELNYX DETAIL RECORDS] Error fetching call cost:', error)
    return { cost: null, currency: 'USD', rate: null, billedSeconds: null, callSeconds: null, found: false }
  }
}

/**
 * Fetch message detail record by message UUID
 */
export async function fetchMessageDetailRecord(messageUuid: string): Promise<{
  cost: number | null
  currency: string
  rate: number | null
  carrierFee: number | null
  parts: number | null
  found: boolean
}> {
  const telnyxApiKey = process.env.TELNYX_API_KEY
  
  if (!telnyxApiKey) {
    console.error('[TELNYX DETAIL RECORDS] Missing TELNYX_API_KEY')
    return { cost: null, currency: 'USD', rate: null, carrierFee: null, parts: null, found: false }
  }

  try {
    // Search for message detail records by UUID
    const url = new URL('https://api.telnyx.com/v2/detail_records')
    url.searchParams.append('filter[record_type]', 'messaging')
    url.searchParams.append('filter[uuid]', messageUuid)
    url.searchParams.append('page[size]', '1')
    
    console.log('[TELNYX DETAIL RECORDS] Fetching message cost for:', messageUuid)
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${telnyxApiKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[TELNYX DETAIL RECORDS] API error:', response.status, errorText)
      return { cost: null, currency: 'USD', rate: null, carrierFee: null, parts: null, found: false }
    }

    const data: TelnyxDetailRecordResponse = await response.json()
    
    if (!data.data || data.data.length === 0) {
      console.log('[TELNYX DETAIL RECORDS] No records found for message:', messageUuid)
      return { cost: null, currency: 'USD', rate: null, carrierFee: null, parts: null, found: false }
    }

    const messageRecord = data.data[0]
    const cost = messageRecord.cost ? parseFloat(messageRecord.cost) : null
    const currency = messageRecord.currency || 'USD'
    const rate = messageRecord.rate ? parseFloat(messageRecord.rate) : null
    const carrierFee = messageRecord.carrier_fee ? parseFloat(messageRecord.carrier_fee) : null
    const parts = messageRecord.parts ?? null

    console.log('[TELNYX DETAIL RECORDS] Found message record:', {
      messageUuid,
      cost,
      currency,
      rate,
      carrierFee,
      parts,
    })

    return {
      cost,
      currency,
      rate,
      carrierFee,
      parts,
      found: true,
    }

  } catch (error) {
    console.error('[TELNYX DETAIL RECORDS] Error fetching message cost:', error)
    return { cost: null, currency: 'USD', rate: null, carrierFee: null, parts: null, found: false }
  }
}

/**
 * Fetch detail records for a date range
 */
export async function fetchDetailRecordsByDateRange(
  startDate: Date,
  endDate: Date,
  recordType?: 'messaging' | 'call'
): Promise<TelnyxDetailRecordResponse> {
  const telnyxApiKey = process.env.TELNYX_API_KEY
  
  if (!telnyxApiKey) {
    throw new Error('Missing TELNYX_API_KEY')
  }

  const url = new URL('https://api.telnyx.com/v2/detail_records')
  
  // Format dates as YYYY-MM-DD
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]
  
  url.searchParams.append('filter[created_at][gte]', startDateStr)
  url.searchParams.append('filter[created_at][lt]', endDateStr)
  
  if (recordType === 'messaging') {
    url.searchParams.append('filter[record_type]', 'messaging')
  }
  
  url.searchParams.append('page[size]', '50')
  url.searchParams.append('sort', '-created_at')
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${telnyxApiKey}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Telnyx API error: ${response.status} ${errorText}`)
  }

  return await response.json()
}

