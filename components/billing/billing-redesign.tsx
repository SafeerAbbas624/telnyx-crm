"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Download, DollarSign, MessageSquare, Phone } from "lucide-react"
import { format } from "date-fns"

interface BillingRecord {
  id: string
  phoneNumber: string
  recordType: 'sms_inbound' | 'sms_outbound' | 'call_inbound' | 'call_outbound'
  cost: number
  timestamp: string
  contact: string
  duration?: number
}

interface BillingSummary {
  totalCost: number
  smsCost: number
  callCost: number
}

interface BalanceData {
  balance: number
  pending: number
  creditLimit: number
  availableCredit: number
  currency: string
}

export default function BillingRedesign() {
  const { toast } = useToast()
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)

  // Filters
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('all')
  const [selectedRecordType, setSelectedRecordType] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('7')

  useEffect(() => {
    loadPhoneNumbers()
    loadBalance()
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedPhoneNumber, selectedRecordType, selectedDateRange])

  const loadPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/admin/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        const numbers = data.phoneNumbers.map((p: any) => p.phoneNumber)
        setPhoneNumbers(numbers)
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    }
  }

  const loadBalance = async () => {
    try {
      setIsLoadingBalance(true)
      const response = await fetch('/api/billing/balance')
      if (!response.ok) {
        throw new Error('Failed to fetch balance')
      }
      const data = await response.json()
      setBalance(data)
    } catch (error) {
      console.error('Error loading balance:', error)
      toast({
        title: 'Warning',
        description: 'Failed to load account balance',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      const params = new URLSearchParams({
        days: selectedDateRange,
      })

      if (selectedPhoneNumber && selectedPhoneNumber !== 'all') {
        params.append('phoneNumber', selectedPhoneNumber)
      }

      if (selectedRecordType && selectedRecordType !== 'all') {
        params.append('recordType', selectedRecordType)
      }

      const response = await fetch(`/api/billing/records?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch billing data')
      }

      const data = await response.json()
      setBillingRecords(data.records)
      setSummary(data.summary)
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
      
      const params = new URLSearchParams({
        days: selectedDateRange,
        export: 'true',
      })

      if (selectedPhoneNumber && selectedPhoneNumber !== 'all') {
        params.append('phoneNumber', selectedPhoneNumber)
      }

      if (selectedRecordType && selectedRecordType !== 'all') {
        params.append('recordType', selectedRecordType)
      }

      const response = await fetch(`/api/billing/records?${params}`)
      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `billing-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

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

  const getRecordTypeBadge = (type: string) => {
    switch (type) {
      case 'sms_inbound':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">SMS INBOUND</Badge>
      case 'sms_outbound':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">SMS OUTBOUND</Badge>
      case 'call_inbound':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">CALL INBOUND</Badge>
      case 'call_outbound':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">CALL OUTBOUND</Badge>
      default:
        return <Badge>{type.toUpperCase()}</Badge>
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} min ${secs}s`
  }

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
            <p className="text-sm text-gray-500 mt-1">View usage costs and billing records</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Phone Number</label>
                <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All numbers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All numbers</SelectItem>
                    {phoneNumbers.map((number) => (
                      <SelectItem key={number} value={number}>
                        {number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Record Type</label>
                <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="call">Calls</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Last 7 days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={() => loadData()} 
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          {/* Account Balance Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Account Balance</p>
                  {isLoadingBalance ? (
                    <p className="text-3xl font-bold text-gray-900 mt-1">...</p>
                  ) : (
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      ${balance?.balance.toFixed(2) || '0.00'}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Available: ${balance?.availableCredit.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Cost</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ${summary?.totalCost.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Last {selectedDateRange} days</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">SMS Cost</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ${summary?.smsCost.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Text messages</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Call Cost</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    ${summary?.callCost.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Voice calls</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Records Table */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Billing Records</h2>
              <Button 
                onClick={exportData} 
                disabled={isExporting}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading billing records...</p>
              </div>
            ) : billingRecords.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No billing records found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-3 text-sm font-medium text-gray-700">Type</th>
                      <th className="pb-3 text-sm font-medium text-gray-700">Phone Number</th>
                      <th className="pb-3 text-sm font-medium text-gray-700">Contact</th>
                      <th className="pb-3 text-sm font-medium text-gray-700">Timestamp</th>
                      <th className="pb-3 text-sm font-medium text-gray-700">Duration</th>
                      <th className="pb-3 text-sm font-medium text-gray-700 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingRecords.map((record) => (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-4">
                          {getRecordTypeBadge(record.recordType)}
                        </td>
                        <td className="py-4 text-sm text-gray-900">{record.phoneNumber}</td>
                        <td className="py-4 text-sm text-blue-600">{record.contact}</td>
                        <td className="py-4 text-sm text-gray-600">
                          {format(new Date(record.timestamp), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td className="py-4 text-sm text-gray-600">
                          {formatDuration(record.duration)}
                        </td>
                        <td className="py-4 text-sm font-semibold text-gray-900 text-right">
                          ${record.cost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

