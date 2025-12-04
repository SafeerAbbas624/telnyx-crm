'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Search, Filter, Download, X } from 'lucide-react'
import { exportCallsToCSV } from '@/lib/call-utils'

interface CallSearchFilterProps {
  onSearch: (query: string) => void
  onFilterChange: (filters: CallFilters) => void
  onExport: () => void
  isLoading?: boolean
}

export interface CallFilters {
  outcome?: string
  sentiment?: string
  status?: string
  durationMin?: number
  durationMax?: number
  dateFrom?: string
  dateTo?: string
}

const FILTER_PRESETS = [
  { name: 'All Calls', filters: {} },
  { name: 'Interested', filters: { outcome: 'interested' } },
  { name: 'Not Interested', filters: { outcome: 'not_interested' } },
  { name: 'Callbacks', filters: { outcome: 'callback' } },
  { name: 'Positive Sentiment', filters: { sentiment: 'positive' } },
  { name: 'Negative Sentiment', filters: { sentiment: 'negative' } },
  { name: 'Long Calls (5+ min)', filters: { durationMin: 300 } },
  { name: 'Short Calls (<1 min)', filters: { durationMax: 60 } },
]

export function CallSearchFilter({
  onSearch,
  onFilterChange,
  onExport,
  isLoading = false,
}: CallSearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<CallFilters>({})
  const [activePreset, setActivePreset] = useState('All Calls')

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    onSearch(value)
  }

  const handleFilterChange = (newFilters: CallFilters) => {
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handlePresetClick = (preset: typeof FILTER_PRESETS[0]) => {
    setActivePreset(preset.name)
    handleFilterChange(preset.filters)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilters({})
    setActivePreset('All Calls')
    handleFilterChange({})
  }

  const hasActiveFilters = Object.keys(filters).length > 0 || searchQuery.length > 0

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by phone, contact name, or notes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* Filter Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={hasActiveFilters ? 'default' : 'outline'}
              size="icon"
              disabled={isLoading}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-semibold">Filters</h4>

              {/* Outcome Filter */}
              <div className="space-y-2">
                <Label>Call Outcome</Label>
                <Select
                  value={filters.outcome || ''}
                  onValueChange={(value) =>
                    handleFilterChange({ ...filters, outcome: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All outcomes</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="callback">Callback</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sentiment Filter */}
              <div className="space-y-2">
                <Label>Sentiment</Label>
                <Select
                  value={filters.sentiment || ''}
                  onValueChange={(value) =>
                    handleFilterChange({ ...filters, sentiment: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sentiments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) =>
                    handleFilterChange({ ...filters, status: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="answered">Answered</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Duration Range */}
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.durationMin || ''}
                    onChange={(e) =>
                      handleFilterChange({
                        ...filters,
                        durationMin: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.durationMax || ''}
                    onChange={(e) =>
                      handleFilterChange({
                        ...filters,
                        durationMax: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) =>
                      handleFilterChange({ ...filters, dateFrom: e.target.value || undefined })
                    }
                  />
                  <Input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) =>
                      handleFilterChange({ ...filters, dateTo: e.target.value || undefined })
                    }
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Export Button */}
        <Button variant="outline" size="icon" onClick={onExport} disabled={isLoading}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Presets */}
      <div className="flex flex-wrap gap-2">
        {FILTER_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            variant={activePreset === preset.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset)}
            disabled={isLoading}
          >
            {preset.name}
          </Button>
        ))}
      </div>
    </div>
  )
}

