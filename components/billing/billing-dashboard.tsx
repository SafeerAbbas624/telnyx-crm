"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Download, DollarSign, MessageSquare, Phone, Calendar, Filter, FileText } from "lucide-react"
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from "date-fns"

interface BillingRecord {
  id: string
  phoneNumber: string
  recordType: 'sms' | 'call' | 'number_rental'
  recordId: string
  cost: number
  currency: string
  billingDate: string
  description: string
  // SMS-specific fields
  segmentCount?: number
  encoding?: 'GSM-7' | 'Unicode'
}

interface BillingSummary {
  totalCost: number
  breakdown: Array<{
    type: string
    cost: number
    count: number
    // SMS-specific
    totalSegments?: number
  }>
}

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string | null
  state?: string
  totalCost: number
  totalSmsCount: number
  totalCallCount: number
}

interface PhoneNumberStats {
  phoneNumber: string
  friendlyName: string | null
  monthlyPrice: number
  totalCost: number
  smsCount: number
  callCount: number
  smsCost: number
  callCost: number
}

export default function BillingDashboard() {
  const { toast } = useToast()
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [phoneStats, setPhoneStats] = useState<PhoneNumberStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showPhoneBreakdown, setShowPhoneBreakdown] = useState(false)
  
  // Filters
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("all")
  const [selectedRecordType, setSelectedRecordType] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("last_30_days")
  const [customStartDate, setCustomStartDate] = useState<string>("")
  const [customEndDate, setCustomEndDate] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadData()
    loadPhoneNumbers()
    loadPhoneStats()
  }, [])

  useEffect(() => {
    loadData()
    loadPhoneStats()
  }, [selectedPhoneNumber, selectedRecordType, dateRange, customStartDate, customEndDate, currentPage])

  const loadPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        setPhoneNumbers(data.phoneNumbers || data)
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    }
  }

  const loadPhoneStats = async () => {
    try {
      const { startDate, endDate } = getDateRange()
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const response = await fetch(`/api/billing/phone-stats?days=${days}`)
      if (response.ok) {
        const data = await response.json()
        setPhoneStats(data.stats || [])
      }
    } catch (error) {
      console.error('Error loading phone stats:', error)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    switch (dateRange) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) }
      case 'last_7_days':
        return { startDate: subDays(now, 7), endDate: now }
      case 'last_30_days':
        return { startDate: subDays(now, 30), endDate: now }
      case 'last_week':
        return { startDate: subWeeks(now, 1), endDate: now }
      case 'last_month':
        return { startDate: subMonths(now, 1), endDate: now }
      case 'custom':
        return {
          startDate: customStartDate ? new Date(customStartDate) : subDays(now, 30),
          endDate: customEndDate ? new Date(customEndDate) : now
        }
      default:
        return { startDate: subDays(now, 30), endDate: now }
    }
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      const { startDate, endDate } = getDateRange()
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      if (selectedPhoneNumber && selectedPhoneNumber !== 'all') {
        params.append('phoneNumber', selectedPhoneNumber)
      }

      if (selectedRecordType && selectedRecordType !== 'all') {
        params.append('recordType', selectedRecordType)
      }

      const response = await fetch(`/api/telnyx/billing?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch billing data')
      }

      const data = await response.json()
      setBillingRecords(data.billingRecords)
      setSummary(data.summary)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error('Error loading billing data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load billing data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportData = async () => {
    try {
      setIsExporting(true)
      const { startDate, endDate } = getDateRange()
      
      const filters = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        phoneNumber: selectedPhoneNumber || undefined,
        recordType: selectedRecordType || undefined,
      }

      const response = await fetch('/api/telnyx/billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'export',
          filters,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `telnyx-billing-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Success',
        description: 'Billing data exported successfully',
      })
    } catch (error) {
      console.error('Error exporting data:', error)
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'call':
        return <Phone className="h-4 w-4" />
      case 'number_rental':
        return <FileText className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'sms':
        return 'bg-blue-100 text-blue-800'
      case 'call':
        return 'bg-green-100 text-green-800'
      case 'number_rental':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading && billingRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="text-muted-foreground">Track your communication costs and usage</p>
          </div>
          <Button onClick={exportData} disabled={isExporting} className="bg-primary hover:bg-primary/90">
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${summary?.totalCost.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All communication costs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS Cost</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${summary?.breakdown.find(b => b.type === 'sms')?.cost.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.breakdown.find(b => b.type === 'sms')?.count || 0} messages
                {summary?.breakdown.find(b => b.type === 'sms')?.totalSegments && (
                  <span className="ml-1">
                    ({summary.breakdown.find(b => b.type === 'sms')?.totalSegments} segments)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Billed per segment (GSM: 160 chars, Unicode: 70 chars)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Call Cost</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${summary?.breakdown.find(b => b.type === 'call')?.cost.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.breakdown.find(b => b.type === 'call')?.count || 0} calls made
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Per-Number Breakdown */}
        <Card className="mb-6">
          <CardHeader className="cursor-pointer" onClick={() => setShowPhoneBreakdown(!showPhoneBreakdown)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Cost by Phone Number
              </CardTitle>
              <Button variant="ghost" size="sm">
                {showPhoneBreakdown ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </CardHeader>
          {showPhoneBreakdown && (
            <CardContent>
              {phoneStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No phone number data available</p>
              ) : (
                <div className="space-y-3">
                  {phoneStats.map((stat) => (
                    <div key={stat.phoneNumber} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stat.phoneNumber}</span>
                          {stat.friendlyName && (
                            <Badge variant="outline" className="text-xs">{stat.friendlyName}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {stat.smsCount} SMS (${stat.smsCost.toFixed(2)})
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {stat.callCount} calls (${stat.callCost.toFixed(2)})
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">${stat.totalCost.toFixed(2)}</div>
                        {stat.monthlyPrice > 0 && (
                          <p className="text-xs text-muted-foreground">+${stat.monthlyPrice.toFixed(2)}/mo rental</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Total row */}
                  <div className="flex items-center justify-between p-3 border-t-2 mt-2 pt-4">
                    <span className="font-semibold">Total (All Numbers)</span>
                    <span className="font-bold text-lg">
                      ${phoneStats.reduce((sum, s) => sum + s.totalCost, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Phone Number</Label>
                <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="All numbers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All numbers</SelectItem>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.phoneNumber}>
                        {phone.friendlyName ? `${phone.friendlyName} (${phone.phoneNumber})` : phone.phoneNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Record Type</Label>
                <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="call">Calls</SelectItem>
                    <SelectItem value="number_rental">Number Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="last_7_days">Last 7 days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 days</SelectItem>
                    <SelectItem value="last_week">Last week</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Billing Records */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Records</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-500px)]">
              <div className="space-y-2">
                {billingRecords.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No billing records found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  billingRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${getRecordTypeColor(record.recordType)}`}>
                          {getRecordTypeIcon(record.recordType)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{record.phoneNumber}</p>
                          <p className="text-xs text-muted-foreground">{record.description}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(record.billingDate), 'MMM d, yyyy h:mm a')}
                          </p>
                          {/* Show segment info for SMS records */}
                          {record.recordType === 'sms' && record.segmentCount && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {record.segmentCount} segment{record.segmentCount > 1 ? 's' : ''}
                              {record.encoding && ` • ${record.encoding}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Badge className={getRecordTypeColor(record.recordType)}>
                            {record.recordType.toUpperCase()}
                          </Badge>
                          {record.recordType === 'sms' && record.segmentCount && record.segmentCount > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {record.segmentCount} seg
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-bold mt-1">
                          ${Number(record.cost).toFixed(4)} {record.currency}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
