'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface AgentPerformanceData {
  agentId: string
  agentName: string
  totalCalls: number
  answeredCalls: number
  answerRate: number
  avgDuration: number
  interestedCount: number
  conversionRate: number
  avgSentimentScore: number
  sentiment: string
}

interface AgentPerformanceDashboardProps {
  dateFrom?: string
  dateTo?: string
}

export function AgentPerformanceDashboard({
  dateFrom,
  dateTo,
}: AgentPerformanceDashboardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [agentData, setAgentData] = useState<AgentPerformanceData[]>([])

  useEffect(() => {
    const fetchAgentPerformance = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
        })

        const response = await fetch(`/api/calls/agent-performance?${params}`)
        if (!response.ok) throw new Error('Failed to fetch agent performance')

        const data = await response.json()
        setAgentData(data.agents || [])
      } catch (error) {
        console.error('Error fetching agent performance:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgentPerformance()
  }, [dateFrom, dateTo])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const topPerformers = agentData.sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 5)
  const chartData = agentData.map((agent) => ({
    name: agent.agentName,
    answerRate: agent.answerRate,
    conversionRate: agent.conversionRate,
    avgDuration: Math.round(agent.avgDuration / 60),
  }))

  return (
    <div className="space-y-4">
      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Agents ranked by conversion rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPerformers.map((agent, index) => (
              <div key={agent.agentId} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{agent.agentName}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.totalCalls} calls • {agent.answerRate}% answer rate
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">{agent.conversionRate}%</div>
                  <div className="text-xs text-muted-foreground">conversion rate</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="answerRate" fill="#3b82f6" name="Answer Rate %" />
              <Bar dataKey="conversionRate" fill="#10b981" name="Conversion Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Agent Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Total Calls</TableHead>
                <TableHead className="text-right">Answered</TableHead>
                <TableHead className="text-right">Answer Rate</TableHead>
                <TableHead className="text-right">Interested</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Avg Duration</TableHead>
                <TableHead className="text-right">Sentiment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentData.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell className="font-medium">{agent.agentName}</TableCell>
                  <TableCell className="text-right">{agent.totalCalls}</TableCell>
                  <TableCell className="text-right">{agent.answeredCalls}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{agent.answerRate}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">{agent.interestedCount}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        agent.conversionRate > 30
                          ? 'bg-green-100 text-green-800'
                          : agent.conversionRate > 15
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }
                    >
                      {agent.conversionRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.floor(agent.avgDuration / 60)}m {agent.avgDuration % 60}s
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        agent.sentiment === 'positive'
                          ? 'bg-green-100 text-green-800'
                          : agent.sentiment === 'negative'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {agent.sentiment}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

