"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X, Filter } from "lucide-react"

interface SearchFilter {
  borrowerName?: string
  propertyAddress?: string
  loanAmount?: { min: number; max: number }
  loanStatus?: string
  dscr?: { min: number; max: number }
  ltv?: { min: number; max: number }
  dateRange?: { start: string; end: string }
}

interface AdvancedSearchFilterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSearch: (filters: SearchFilter) => void
  onClear: () => void
}

export default function AdvancedSearchFilter({
  open,
  onOpenChange,
  onSearch,
  onClear,
}: AdvancedSearchFilterProps) {
  const [filters, setFilters] = useState<SearchFilter>({})
  const [activeFilters, setActiveFilters] = useState<number>(0)

  const handleSearch = () => {
    onSearch(filters)
    setActiveFilters(Object.keys(filters).filter(k => filters[k as keyof SearchFilter]).length)
    onOpenChange(false)
  }

  const handleClear = () => {
    setFilters({})
    setActiveFilters(0)
    onClear()
  }

  const handleRemoveFilter = (key: keyof SearchFilter) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    setFilters(newFilters)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Advanced Search & Filters
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Borrower Name */}
          <div>
            <Label className="text-sm">Borrower Name</Label>
            <Input
              placeholder="Search by borrower name"
              value={filters.borrowerName || ''}
              onChange={(e) => setFilters({ ...filters, borrowerName: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Property Address */}
          <div>
            <Label className="text-sm">Property Address</Label>
            <Input
              placeholder="Search by property address"
              value={filters.propertyAddress || ''}
              onChange={(e) => setFilters({ ...filters, propertyAddress: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Loan Amount Range */}
          <div>
            <Label className="text-sm">Loan Amount Range</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="number"
                placeholder="Min amount"
                value={filters.loanAmount?.min || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  loanAmount: { ...filters.loanAmount, min: parseFloat(e.target.value) || 0 }
                })}
              />
              <Input
                type="number"
                placeholder="Max amount"
                value={filters.loanAmount?.max || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  loanAmount: { ...filters.loanAmount, max: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
          </div>

          {/* Loan Status */}
          <div>
            <Label className="text-sm">Loan Status</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['Active', 'Pending', 'Closed', 'Default'].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={filters.loanStatus === status ? 'default' : 'outline'}
                  onClick={() => setFilters({ ...filters, loanStatus: filters.loanStatus === status ? undefined : status })}
                  className="text-xs"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {/* DSCR Range */}
          <div>
            <Label className="text-sm">DSCR Range</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="number"
                placeholder="Min DSCR"
                step="0.1"
                value={filters.dscr?.min || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dscr: { ...filters.dscr, min: parseFloat(e.target.value) || 0 }
                })}
              />
              <Input
                type="number"
                placeholder="Max DSCR"
                step="0.1"
                value={filters.dscr?.max || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dscr: { ...filters.dscr, max: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
          </div>

          {/* LTV Range */}
          <div>
            <Label className="text-sm">LTV Range (%)</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="number"
                placeholder="Min LTV"
                value={filters.ltv?.min || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  ltv: { ...filters.ltv, min: parseFloat(e.target.value) || 0 }
                })}
              />
              <Input
                type="number"
                placeholder="Max LTV"
                value={filters.ltv?.max || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  ltv: { ...filters.ltv, max: parseFloat(e.target.value) || 0 }
                })}
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <Label className="text-sm">Date Range</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="date"
                value={filters.dateRange?.start || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, start: e.target.value }
                })}
              />
              <Input
                type="date"
                value={filters.dateRange?.end || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange, end: e.target.value }
                })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClear}
          >
            Clear All
          </Button>
          <Button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Search className="mr-2 h-4 w-4" /> Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

