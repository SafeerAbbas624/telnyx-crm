'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateCallStats, formatCallDuration } from '@/lib/call-utils'
import { Phone, PhoneOff, Clock, TrendingUp } from 'lucide-react'

interface CallStatisticsCardProps {
  calls: any[]
  title?: string
  description?: string
}

export function CallStatisticsCard({
  calls,
  title = 'Call Statistics',
  description = 'Overview of your call activity',
}: CallStatisticsCardProps) {
  const stats = calculateCallStats(calls)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Total Calls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>Total Calls</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>

          {/* Answered Calls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-green-600" />
              <span>Answered</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.answered}</div>
            <div className="text-xs text-muted-foreground">{stats.answerRate}% rate</div>
          </div>

          {/* Missed Calls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PhoneOff className="h-4 w-4 text-red-600" />
              <span>Missed</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.missed}</div>
          </div>

          {/* Average Duration */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>Avg Duration</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCallDuration(stats.avgDuration)}
            </div>
          </div>

          {/* Total Duration */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Total Duration</span>
            </div>
            <div className="text-2xl font-bold">{formatCallDuration(stats.totalDuration)}</div>
          </div>

          {/* Calls per Hour */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Calls/Hour</span>
            </div>
            <div className="text-2xl font-bold">
              {calls.length > 0 ? (calls.length / 8).toFixed(1) : '0'}
            </div>
          </div>

          {/* Answer Rate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span>Answer Rate</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{stats.answerRate}%</div>
          </div>

          {/* Efficiency Score */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span>Efficiency</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.total > 0 ? Math.round((stats.answered / stats.total) * 100) : 0}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

