/**
 * Call utility functions for formatting and processing call data
 */

/**
 * Format call duration from seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2m 30s")
 */
export function formatCallDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds === 0) return '0s'

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

/**
 * Get color for call status
 * @param status - Call status
 * @returns Tailwind color classes
 */
export function getCallStatusColor(status: string): string {
  const colors: Record<string, string> = {
    answered: 'bg-green-100 text-green-800 border-green-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    missed: 'bg-red-100 text-red-800 border-red-300',
    busy: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    no_answer: 'bg-orange-100 text-orange-800 border-orange-300',
    failed: 'bg-red-100 text-red-800 border-red-300',
    initiated: 'bg-blue-100 text-blue-800 border-blue-300',
    ringing: 'bg-blue-100 text-blue-800 border-blue-300',
    queued: 'bg-gray-100 text-gray-800 border-gray-300',
  }
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300'
}

/**
 * Get color for call outcome
 * @param outcome - Call outcome
 * @returns Tailwind color classes
 */
export function getCallOutcomeColor(outcome: string | null | undefined): string {
  if (!outcome) return 'bg-gray-100 text-gray-800'

  const colors: Record<string, string> = {
    interested: 'bg-green-100 text-green-800',
    not_interested: 'bg-red-100 text-red-800',
    callback: 'bg-blue-100 text-blue-800',
    voicemail: 'bg-purple-100 text-purple-800',
    wrong_number: 'bg-yellow-100 text-yellow-800',
    no_answer: 'bg-orange-100 text-orange-800',
    busy: 'bg-red-200 text-red-900',
  }
  return colors[outcome] || 'bg-gray-100 text-gray-800'
}

/**
 * Get icon for call outcome
 * @param outcome - Call outcome
 * @returns Icon emoji or symbol
 */
export function getCallOutcomeIcon(outcome: string | null | undefined): string {
  if (!outcome) return '📞'

  const icons: Record<string, string> = {
    interested: '✅',
    not_interested: '❌',
    callback: '📞',
    voicemail: '📧',
    wrong_number: '❓',
    no_answer: '⏱️',
    busy: '🔴',
  }
  return icons[outcome] || '📞'
}

/**
 * Get sentiment color
 * @param sentiment - Sentiment value
 * @returns Tailwind color classes
 */
export function getSentimentColor(sentiment: string | null | undefined): string {
  if (!sentiment) return 'bg-gray-100 text-gray-800'

  const colors: Record<string, string> = {
    positive: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
    negative: 'bg-red-100 text-red-800',
  }
  return colors[sentiment] || 'bg-gray-100 text-gray-800'
}

/**
 * Get sentiment icon
 * @param sentiment - Sentiment value
 * @returns Icon emoji
 */
export function getSentimentIcon(sentiment: string | null | undefined): string {
  if (!sentiment) return '😐'

  const icons: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😞',
  }
  return icons[sentiment] || '😐'
}

/**
 * Calculate call statistics from an array of calls
 */
export interface CallStats {
  total: number
  answered: number
  missed: number
  avgDuration: number
  answerRate: number
  totalDuration: number
}

export function calculateCallStats(calls: any[]): CallStats {
  if (!calls || calls.length === 0) {
    return {
      total: 0,
      answered: 0,
      missed: 0,
      avgDuration: 0,
      answerRate: 0,
      totalDuration: 0,
    }
  }

  const answered = calls.filter(
    (c) => c.status === 'answered' || c.status === 'completed' || c.answered
  ).length
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)

  return {
    total: calls.length,
    answered,
    missed: calls.length - answered,
    avgDuration: Math.round(totalDuration / calls.length),
    answerRate: Math.round((answered / calls.length) * 100),
    totalDuration,
  }
}

/**
 * Export calls to CSV format
 */
export function exportCallsToCSV(
  calls: any[],
  filename: string = `calls-${new Date().toISOString().split('T')[0]}.csv`
): void {
  const headers = [
    'Date',
    'Contact',
    'Phone',
    'Duration',
    'Status',
    'Outcome',
    'Notes',
    'Sentiment',
  ]

  const rows = calls.map((call) => [
    new Date(call.createdAt || call.created_at).toLocaleString(),
    call.contactName || call.contact?.firstName || '',
    call.toNumber || call.phone_number || '',
    formatCallDuration(call.duration),
    call.status || '',
    call.callOutcome || call.call_outcome || '',
    (call.callNotes || call.call_notes || '').replace(/"/g, '""'),
    call.sentiment || '',
  ])

  const csv = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Filter calls by duration range
 */
export function filterCallsByDuration(
  calls: any[],
  minSeconds: number,
  maxSeconds: number
): any[] {
  return calls.filter((call) => {
    const duration = call.duration || 0
    return duration >= minSeconds && duration <= maxSeconds
  })
}

/**
 * Search calls by multiple criteria
 */
export function searchCalls(
  calls: any[],
  query: string,
  searchFields: string[] = ['toNumber', 'contactName', 'callNotes']
): any[] {
  if (!query) return calls

  const lowerQuery = query.toLowerCase()
  return calls.filter((call) =>
    searchFields.some((field) => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], call)
      return value?.toString().toLowerCase().includes(lowerQuery)
    })
  )
}

/**
 * Group calls by outcome
 */
export function groupCallsByOutcome(calls: any[]): Record<string, any[]> {
  return calls.reduce(
    (acc, call) => {
      const outcome = call.callOutcome || call.call_outcome || 'unset'
      if (!acc[outcome]) acc[outcome] = []
      acc[outcome].push(call)
      return acc
    },
    {} as Record<string, any[]>
  )
}

/**
 * Group calls by sentiment
 */
export function groupCallsBySentiment(calls: any[]): Record<string, any[]> {
  return calls.reduce(
    (acc, call) => {
      const sentiment = call.sentiment || 'unset'
      if (!acc[sentiment]) acc[sentiment] = []
      acc[sentiment].push(call)
      return acc
    },
    {} as Record<string, any[]>
  )
}

