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
}

interface BillingSummary {
  totalCost: number
  breakdown: Array<{
    type: string
    cost: number
    count: number
  }>
}

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  state?: string
  totalCost: number
  totalSmsCount: number
  totalCallCount: number
}

export default function BillingDashboard() {
  const { toast } = useToast()
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  
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
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedPhoneNumber, selectedRecordType, dateRange, customStartDate, customEndDate, currentPage])

  const loadPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/telnyx/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        setPhoneNumbers(data)
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
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
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Billing Dashboard</h2>
          <Button onClick={exportData} disabled={isExporting} className="flex items-center gap-2">
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
                    {phone.phoneNumber} {phone.state && `(${phone.state})`}
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

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold">${Number(summary.totalCost).toFixed(4)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {summary.breakdown.map((item) => (
              <Card key={item.type}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground capitalize">
                        {item.type.replace('_', ' ')}
                      </p>
                      <p className="text-xl font-bold">${Number(item.cost).toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">{item.count} records</p>
                    </div>
                    {getRecordTypeIcon(item.type)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Billing Records */}
      <div className="flex-1 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Billing Records</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-2">
                {billingRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${getRecordTypeColor(record.recordType)}`}>
                        {getRecordTypeIcon(record.recordType)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{record.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground">{record.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(record.billingDate), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getRecordTypeColor(record.recordType)}>
                        {record.recordType.toUpperCase()}
                      </Badge>
                      <p className="text-sm font-medium mt-1">
                        ${Number(record.cost).toFixed(4)} {record.currency}
                      </p>
                    </div>
                  </div>
                ))}

                {billingRecords.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No billing records found for the selected criteria</p>
                  </div>
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
