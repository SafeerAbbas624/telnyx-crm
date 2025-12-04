'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Play, ChevronDown } from 'lucide-react'
import { useVapiStore, type VapiCall } from '@/lib/stores/useVapiStore'
import { toast } from 'sonner'

export default function VapiCallHistory() {
  const { calls, setCalls } = useVapiStore()
  const [filteredCalls, setFilteredCalls] = useState<VapiCall[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCallHistory()
  }, [])

  useEffect(() => {
    filterCalls()
  }, [calls, searchQuery, statusFilter])

  const fetchCallHistory = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/vapi/calls?limit=100')
      const data = await response.json()
      if (data.success) {
        setCalls(data.calls)
      }
    } catch (error) {
      console.error('Error fetching call history:', error)
      toast.error('Failed to fetch call history')
    } finally {
      setIsLoading(false)
    }
  }

  const filterCalls = () => {
    let filtered = calls

    if (statusFilter !== 'all') {
      filtered = filtered.filter(call => call.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(call =>
        (call.name || '').toLowerCase().includes(query) ||
        (call.transcript || '').toLowerCase().includes(query)
      )
    }

    setFilteredCalls(filtered)
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ended':
        return 'bg-gray-100 text-gray-700'
      case 'in_progress':
        return 'bg-green-100 text-green-700'
      case 'queued':
        return 'bg-blue-100 text-blue-700'
      case 'failed':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Call History</h2>
        <p className="text-sm text-gray-600">View all past Vapi AI calls</p>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <Input
              placeholder="Search by contact name or transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="all">All Statuses</option>
              <option value="ended">Ended</option>
              <option value="in_progress">In Progress</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <Button onClick={fetchCallHistory} variant="outline" className="w-full">
          Refresh
        </Button>
      </Card>

      {/* Calls List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading call history...</div>
        ) : filteredCalls.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <p>No calls found</p>
          </Card>
        ) : (
          filteredCalls.map(call => (
            <Card key={call.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{call.name || 'Unknown'}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(call.status)}`}>
                      {call.status || 'unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(call.created_at).toLocaleString()} • Duration: {formatDuration(call.duration)} • Cost: ${call.cost?.toFixed(2) || '0.00'}
                  </p>
                </div>

                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition ${
                    expandedCallId === call.id ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expanded Details */}
              {expandedCallId === call.id && (
                <div className="border-t p-4 bg-gray-50 space-y-4">
                  {call.transcript && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Transcript</h4>
                      <p className="text-sm text-gray-700 bg-white p-3 rounded border max-h-48 overflow-y-auto">
                        {call.transcript}
                      </p>
                    </div>
                  )}

                  {call.recording_url && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Recording</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(call.recording_url, '_blank')}
                          className="gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Play Recording
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const a = document.createElement('a')
                            a.href = call.recording_url!
                            a.download = `call-${call.id}.mp3`
                            a.click()
                          }}
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className="font-medium">{call.status}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Duration</p>
                      <p className="font-medium">{formatDuration(call.duration)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Cost</p>
                      <p className="font-medium">${call.cost?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Ended Reason</p>
                      <p className="font-medium">{call.ended_reason || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

