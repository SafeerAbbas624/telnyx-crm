"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Eye, MousePointerClick, TrendingUp } from "lucide-react"

interface EmailTrackingStatsProps {
  loanId: string
}

interface EmailStats {
  total: number
  sent: number
  opened: number
  clicked: number
  bounced: number
  openRate: string
  clickRate: string
}

export default function EmailTrackingStats({ loanId }: EmailTrackingStatsProps) {
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/loans/email-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_stats',
            loanId,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Error fetching email stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [loanId])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Email Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Email Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No emails sent yet</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Email Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Opened</span>
            </div>
            <div className="text-2xl font-bold">{stats.opened}</div>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">Clicked</span>
            </div>
            <div className="text-2xl font-bold">{stats.clicked}</div>
          </div>

          <div className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground mb-1">Bounced</div>
            <div className="text-2xl font-bold">{stats.bounced}</div>
          </div>
        </div>

        {/* Rates */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Open Rate</span>
              <span className="font-semibold">{stats.openRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(parseFloat(stats.openRate), 100)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Click Rate</span>
              <span className="font-semibold">{stats.clickRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(parseFloat(stats.clickRate), 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-800">
            {stats.total} Total
          </Badge>
          {parseFloat(stats.openRate) > 50 && (
            <Badge className="bg-green-100 text-green-800">
              ✓ Good Open Rate
            </Badge>
          )}
          {parseFloat(stats.clickRate) > 25 && (
            <Badge className="bg-orange-100 text-orange-800">
              ✓ Good Click Rate
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

