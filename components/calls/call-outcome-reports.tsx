'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface CallOutcomeReportsProps {
  dateFrom?: string
  dateTo?: string
}

const COLORS = {
  interested: '#10b981',
  not_interested: '#ef4444',
  callback: '#3b82f6',
  voicemail: '#a855f7',
  wrong_number: '#f59e0b',
  no_answer: '#f97316',
  busy: '#dc2626',
}

export function CallOutcomeReports({ dateFrom, dateTo }: CallOutcomeReportsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [reportType, setReportType] = useState<'summary' | 'outcomes' | 'sentiment'>('summary')
  const { toast } = useToast()

  const fetchReport = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        type: reportType,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      })

      const response = await fetch(`/api/calls/reports?${params}`)
      if (!response.ok) throw new Error('Failed to fetch report')

      const data = await response.json()
      setReportData(data)
    } catch (error) {
      console.error('Error fetching report:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch report',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [reportType, dateFrom, dateTo])

  if (!reportData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Outcome Reports</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (reportType === 'summary') {
    const outcomeData = Object.entries(reportData.outcomes || {}).map(([name, count]) => ({
      name,
      value: count,
    }))

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Call Summary Report</CardTitle>
            <CardDescription>
              {reportData.period.from && reportData.period.to
                ? `${reportData.period.from} to ${reportData.period.to}`
                : 'All time'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Calls</div>
                <div className="text-2xl font-bold">{reportData.totalCalls}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Answered</div>
                <div className="text-2xl font-bold text-green-600">{reportData.answeredCalls}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Answer Rate</div>
                <div className="text-2xl font-bold text-blue-600">{reportData.answerRate}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Avg Duration</div>
                <div className="text-2xl font-bold">
                  {Math.floor(reportData.avgDuration / 60)}m {reportData.avgDuration % 60}s
                </div>
              </div>
            </div>

            {outcomeData.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-4">Calls by Outcome</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {outcomeData.map((entry: any) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={COLORS[entry.name as keyof typeof COLORS] || '#8884d8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (reportType === 'outcomes') {
    const outcomeData = Object.entries(reportData.outcomes || {}).map(([name, data]: [string, any]) => ({
      name,
      count: data.count,
      avgDuration: Math.round(data.totalDuration / data.count),
    }))

    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Outcomes Detailed Report</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={outcomeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Count" />
              <Bar dataKey="avgDuration" fill="#10b981" name="Avg Duration (s)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  if (reportType === 'sentiment') {
    const sentimentData = Object.entries(reportData.sentiments || {}).map(([name, data]: [string, any]) => ({
      name,
      count: data.count,
      avgScore: data.avgScore,
    }))

    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Sentiment Report</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sentimentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Count" />
              <Bar yAxisId="right" dataKey="avgScore" fill="#f59e0b" name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  return null
}

