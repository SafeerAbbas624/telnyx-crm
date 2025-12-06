"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Slider } from "@/components/ui/slider"
import {
  X, Filter, ChevronDown, Check, MapPin, Building2, DollarSign,
  Ruler, BedDouble, Bath, Tag, Home, Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterOptions {
  cities: string[]
  states: string[]
  counties: string[]
  propertyTypes: string[]
  tags: { id: string; name: string; color: string }[]
  valueRange: { min: number; max: number }
  equityRange: { min: number; max: number }
  sqftRange: { min: number; max: number }
  bedsRange: { min: number; max: number }
  bathsRange: { min: number; max: number }
  propertiesRange: { min: number; max: number }
}

interface ActiveFilters {
  cities: string[]
  counties: string[]
  propertyTypes: string[]
  tags: string[]
  minValue?: number
  maxValue?: number
  minEquity?: number
  maxEquity?: number
  minSqft?: number
  maxSqft?: number
  minBeds?: number
  maxBeds?: number
  minBaths?: number
  maxBaths?: number
  minProperties?: number
  maxProperties?: number
  dateAddedPreset?: string  // 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last7Days' | 'last30Days' | 'custom'
  createdAfter?: string
  createdBefore?: string
}

interface SmartFilterPanelProps {
  filterOptions: FilterOptions | null
  onFiltersChange: (filters: Record<string, string>) => void
  currentFilters?: Record<string, string>
}

export default function SmartFilterPanel({ 
  filterOptions, 
  onFiltersChange,
  currentFilters = {}
}: SmartFilterPanelProps) {
  const [filters, setFilters] = useState<ActiveFilters>({
    cities: [],
    counties: [],
    propertyTypes: [],
    tags: [],
  })
  
  // Initialize filters from currentFilters prop
  useEffect(() => {
    if (currentFilters) {
      setFilters({
        cities: currentFilters.city ? currentFilters.city.split(',') : [],
        counties: currentFilters.propertyCounty ? currentFilters.propertyCounty.split(',') : [],
        propertyTypes: currentFilters.propertyType ? currentFilters.propertyType.split(',') : [],
        tags: currentFilters.tags ? currentFilters.tags.split(',') : [],
        minValue: currentFilters.minValue ? Number(currentFilters.minValue) : undefined,
        maxValue: currentFilters.maxValue ? Number(currentFilters.maxValue) : undefined,
        minEquity: currentFilters.minEquity ? Number(currentFilters.minEquity) : undefined,
        maxEquity: currentFilters.maxEquity ? Number(currentFilters.maxEquity) : undefined,
        minSqft: currentFilters.minSqft ? Number(currentFilters.minSqft) : undefined,
        maxSqft: currentFilters.maxSqft ? Number(currentFilters.maxSqft) : undefined,
        minBeds: currentFilters.minBedrooms ? Number(currentFilters.minBedrooms) : undefined,
        maxBeds: currentFilters.maxBedrooms ? Number(currentFilters.maxBedrooms) : undefined,
        minBaths: currentFilters.minBathrooms ? Number(currentFilters.minBathrooms) : undefined,
        maxBaths: currentFilters.maxBathrooms ? Number(currentFilters.maxBathrooms) : undefined,
        minProperties: currentFilters.minProperties ? Number(currentFilters.minProperties) : undefined,
        maxProperties: currentFilters.maxProperties ? Number(currentFilters.maxProperties) : undefined,
        dateAddedPreset: currentFilters.dateAddedPreset || undefined,
        createdAfter: currentFilters.createdAfter || undefined,
        createdBefore: currentFilters.createdBefore || undefined,
      })
    }
  }, [])

  // Helper to get date range from preset
  const getDateRangeFromPreset = (preset: string): { createdAfter?: string; createdBefore?: string } => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    switch (preset) {
      case 'today':
        return { createdAfter: today.toISOString().split('T')[0] }
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return {
          createdAfter: yesterday.toISOString().split('T')[0],
          createdBefore: yesterday.toISOString().split('T')[0]
        }
      case 'thisWeek':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        return { createdAfter: weekStart.toISOString().split('T')[0] }
      case 'last7Days':
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)
        return { createdAfter: sevenDaysAgo.toISOString().split('T')[0] }
      case 'thisMonth':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        return { createdAfter: monthStart.toISOString().split('T')[0] }
      case 'last30Days':
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(today.getDate() - 30)
        return { createdAfter: thirtyDaysAgo.toISOString().split('T')[0] }
      default:
        return {}
    }
  }

  const applyFilters = useCallback(() => {
    const apiFilters: Record<string, string> = {}
    if (filters.cities.length > 0) apiFilters.city = filters.cities.join(',')
    if (filters.counties.length > 0) apiFilters.propertyCounty = filters.counties.join(',')
    if (filters.propertyTypes.length > 0) apiFilters.propertyType = filters.propertyTypes.join(',')
    if (filters.tags.length > 0) apiFilters.tags = filters.tags.join(',')
    if (filters.minValue !== undefined) apiFilters.minValue = String(filters.minValue)
    if (filters.maxValue !== undefined) apiFilters.maxValue = String(filters.maxValue)
    if (filters.minEquity !== undefined) apiFilters.minEquity = String(filters.minEquity)
    if (filters.maxEquity !== undefined) apiFilters.maxEquity = String(filters.maxEquity)
    if (filters.minSqft !== undefined) apiFilters.minSqft = String(filters.minSqft)
    if (filters.maxSqft !== undefined) apiFilters.maxSqft = String(filters.maxSqft)
    if (filters.minBeds !== undefined) apiFilters.minBedrooms = String(filters.minBeds)
    if (filters.maxBeds !== undefined) apiFilters.maxBedrooms = String(filters.maxBeds)
    if (filters.minBaths !== undefined) apiFilters.minBathrooms = String(filters.minBaths)
    if (filters.maxBaths !== undefined) apiFilters.maxBathrooms = String(filters.maxBaths)
    if (filters.minProperties !== undefined) apiFilters.minProperties = String(filters.minProperties)
    if (filters.maxProperties !== undefined) apiFilters.maxProperties = String(filters.maxProperties)

    // Handle date added filter
    if (filters.dateAddedPreset && filters.dateAddedPreset !== 'custom') {
      const dateRange = getDateRangeFromPreset(filters.dateAddedPreset)
      if (dateRange.createdAfter) apiFilters.createdAfter = dateRange.createdAfter
      if (dateRange.createdBefore) apiFilters.createdBefore = dateRange.createdBefore
    } else if (filters.createdAfter || filters.createdBefore) {
      if (filters.createdAfter) apiFilters.createdAfter = filters.createdAfter
      if (filters.createdBefore) apiFilters.createdBefore = filters.createdBefore
    }

    onFiltersChange(apiFilters)
  }, [filters, onFiltersChange])

  const clearAllFilters = () => {
    setFilters({
      cities: [],
      counties: [],
      propertyTypes: [],
      tags: [],
      dateAddedPreset: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
    })
    onFiltersChange({})
  }

  const activeFilterCount =
    filters.cities.length +
    filters.counties.length +
    filters.propertyTypes.length +
    filters.tags.length +
    (filters.minValue !== undefined ? 1 : 0) +
    (filters.maxValue !== undefined ? 1 : 0) +
    (filters.minEquity !== undefined ? 1 : 0) +
    (filters.maxEquity !== undefined ? 1 : 0) +
    (filters.minSqft !== undefined ? 1 : 0) +
    (filters.maxSqft !== undefined ? 1 : 0) +
    (filters.minBeds !== undefined ? 1 : 0) +
    (filters.maxBeds !== undefined ? 1 : 0) +
    (filters.minBaths !== undefined ? 1 : 0) +
    (filters.maxBaths !== undefined ? 1 : 0) +
    (filters.minProperties !== undefined ? 1 : 0) +
    (filters.maxProperties !== undefined ? 1 : 0) +
    (filters.dateAddedPreset || filters.createdAfter || filters.createdBefore ? 1 : 0)

  // Format currency for display
  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
    return `$${val}`
  }

  // Format number with commas
  const formatNumber = (val: number) => val.toLocaleString()

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50/50 border-b">
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <Filter className="h-4 w-4" />
          Filters:
        </span>

        {/* City Filter */}
        <MultiSelectFilter
          label="City"
          icon={<MapPin className="h-3.5 w-3.5" />}
          options={filterOptions?.cities || []}
          selected={filters.cities}
          onSelect={(cities) => setFilters(f => ({ ...f, cities }))}
        />

        {/* County Filter */}
        <MultiSelectFilter
          label="County"
          icon={<MapPin className="h-3.5 w-3.5" />}
          options={filterOptions?.counties || []}
          selected={filters.counties}
          onSelect={(counties) => setFilters(f => ({ ...f, counties }))}
        />

        {/* Property Type Filter */}
        <MultiSelectFilter
          label="Property Type"
          icon={<Building2 className="h-3.5 w-3.5" />}
          options={filterOptions?.propertyTypes || []}
          selected={filters.propertyTypes}
          onSelect={(propertyTypes) => setFilters(f => ({ ...f, propertyTypes }))}
        />

        {/* Tags Filter */}
        <MultiSelectFilter
          label="Tags"
          icon={<Tag className="h-3.5 w-3.5" />}
          options={filterOptions?.tags?.map(t => t.name) || []}
          selected={filters.tags}
          onSelect={(tags) => setFilters(f => ({ ...f, tags }))}
        />

        {/* Property Value Range */}
        <RangeFilter
          label="Value"
          icon={<DollarSign className="h-3.5 w-3.5" />}
          min={filterOptions?.valueRange?.min || 0}
          max={filterOptions?.valueRange?.max || 2000000}
          currentMin={filters.minValue}
          currentMax={filters.maxValue}
          formatValue={formatCurrency}
          onChange={(min, max) => setFilters(f => ({ ...f, minValue: min, maxValue: max }))}
        />

        {/* Equity Range */}
        <RangeFilter
          label="Equity"
          icon={<DollarSign className="h-3.5 w-3.5" />}
          min={filterOptions?.equityRange?.min || 0}
          max={filterOptions?.equityRange?.max || 1000000}
          currentMin={filters.minEquity}
          currentMax={filters.maxEquity}
          formatValue={formatCurrency}
          onChange={(min, max) => setFilters(f => ({ ...f, minEquity: min, maxEquity: max }))}
        />

        {/* Sqft Range */}
        <RangeFilter
          label="Sqft"
          icon={<Ruler className="h-3.5 w-3.5" />}
          min={filterOptions?.sqftRange?.min || 0}
          max={filterOptions?.sqftRange?.max || 10000}
          currentMin={filters.minSqft}
          currentMax={filters.maxSqft}
          formatValue={formatNumber}
          onChange={(min, max) => setFilters(f => ({ ...f, minSqft: min, maxSqft: max }))}
        />

        {/* Beds Range */}
        <RangeFilter
          label="Beds"
          icon={<BedDouble className="h-3.5 w-3.5" />}
          min={filterOptions?.bedsRange?.min || 0}
          max={filterOptions?.bedsRange?.max || 10}
          currentMin={filters.minBeds}
          currentMax={filters.maxBeds}
          formatValue={String}
          step={1}
          onChange={(min, max) => setFilters(f => ({ ...f, minBeds: min, maxBeds: max }))}
        />

        {/* Baths Range */}
        <RangeFilter
          label="Baths"
          icon={<Bath className="h-3.5 w-3.5" />}
          min={filterOptions?.bathsRange?.min || 0}
          max={filterOptions?.bathsRange?.max || 10}
          currentMin={filters.minBaths}
          currentMax={filters.maxBaths}
          formatValue={String}
          step={1}
          onChange={(min, max) => setFilters(f => ({ ...f, minBaths: min, maxBaths: max }))}
        />

        {/* Properties Count Range */}
        <RangeFilter
          label="Properties"
          icon={<Home className="h-3.5 w-3.5" />}
          min={filterOptions?.propertiesRange?.min || 1}
          max={filterOptions?.propertiesRange?.max || 20}
          currentMin={filters.minProperties}
          currentMax={filters.maxProperties}
          formatValue={String}
          step={1}
          onChange={(min, max) => setFilters(f => ({ ...f, minProperties: min, maxProperties: max }))}
        />

        {/* Date Added Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 border-dashed text-xs gap-1",
                (filters.dateAddedPreset || filters.createdAfter) && "border-orange-300 bg-orange-50 text-orange-700"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Date Added
              {filters.dateAddedPreset && (
                <span className="ml-1 font-medium">
                  {filters.dateAddedPreset === 'today' && 'Today'}
                  {filters.dateAddedPreset === 'yesterday' && 'Yesterday'}
                  {filters.dateAddedPreset === 'thisWeek' && 'This Week'}
                  {filters.dateAddedPreset === 'last7Days' && 'Last 7 Days'}
                  {filters.dateAddedPreset === 'thisMonth' && 'This Month'}
                  {filters.dateAddedPreset === 'last30Days' && 'Last 30 Days'}
                  {filters.dateAddedPreset === 'custom' && 'Custom'}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Filter by Date Added</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: 'thisWeek', label: 'This Week' },
                  { value: 'last7Days', label: 'Last 7 Days' },
                  { value: 'thisMonth', label: 'This Month' },
                  { value: 'last30Days', label: 'Last 30 Days' },
                ].map(option => (
                  <Button
                    key={option.value}
                    variant={filters.dateAddedPreset === option.value ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs justify-start"
                    onClick={() => setFilters(f => ({
                      ...f,
                      dateAddedPreset: option.value,
                      createdAfter: undefined,
                      createdBefore: undefined
                    }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="border-t pt-3">
                <div className="text-xs text-gray-500 mb-2">Custom Range</div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={filters.createdAfter || ''}
                    onChange={(e) => setFilters(f => ({
                      ...f,
                      createdAfter: e.target.value || undefined,
                      dateAddedPreset: e.target.value ? 'custom' : undefined
                    }))}
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={filters.createdBefore || ''}
                    onChange={(e) => setFilters(f => ({
                      ...f,
                      createdBefore: e.target.value || undefined,
                      dateAddedPreset: f.createdAfter || e.target.value ? 'custom' : undefined
                    }))}
                    placeholder="To"
                  />
                </div>
              </div>
              {(filters.dateAddedPreset || filters.createdAfter || filters.createdBefore) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-gray-500"
                  onClick={() => setFilters(f => ({
                    ...f,
                    dateAddedPreset: undefined,
                    createdAfter: undefined,
                    createdBefore: undefined
                  }))}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Date Filter
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Apply / Clear Buttons */}
        <div className="flex items-center gap-1 ml-auto">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-gray-500">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear ({activeFilterCount})
            </Button>
          )}
          <Button size="sm" onClick={applyFilters} className="h-8 bg-primary hover:bg-primary/90">
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.cities.map(city => (
            <Badge key={`city-${city}`} variant="secondary" className="text-xs py-0.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100">
              {city}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, cities: f.cities.filter(c => c !== city) }))} />
            </Badge>
          ))}
          {filters.counties.map(county => (
            <Badge key={`county-${county}`} variant="secondary" className="text-xs py-0.5 px-2 bg-green-50 text-green-700 hover:bg-green-100">
              {county}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, counties: f.counties.filter(c => c !== county) }))} />
            </Badge>
          ))}
          {filters.propertyTypes.map(pt => (
            <Badge key={`pt-${pt}`} variant="secondary" className="text-xs py-0.5 px-2 bg-purple-50 text-purple-700 hover:bg-purple-100">
              {pt}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, propertyTypes: f.propertyTypes.filter(p => p !== pt) }))} />
            </Badge>
          ))}
          {filters.tags.map(tag => (
            <Badge key={`tag-${tag}`} variant="secondary" className="text-xs py-0.5 px-2 bg-orange-50 text-orange-700 hover:bg-orange-100">
              {tag}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))} />
            </Badge>
          ))}
          {(filters.minValue !== undefined || filters.maxValue !== undefined) && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-emerald-50 text-emerald-700">
              Value: {filters.minValue !== undefined ? formatCurrency(filters.minValue) : '$0'} - {filters.maxValue !== undefined ? formatCurrency(filters.maxValue) : 'Max'}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, minValue: undefined, maxValue: undefined }))} />
            </Badge>
          )}
          {(filters.minEquity !== undefined || filters.maxEquity !== undefined) && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-teal-50 text-teal-700">
              Equity: {filters.minEquity !== undefined ? formatCurrency(filters.minEquity) : '$0'} - {filters.maxEquity !== undefined ? formatCurrency(filters.maxEquity) : 'Max'}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, minEquity: undefined, maxEquity: undefined }))} />
            </Badge>
          )}
          {(filters.minSqft !== undefined || filters.maxSqft !== undefined) && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-amber-50 text-amber-700">
              Sqft: {filters.minSqft !== undefined ? formatNumber(filters.minSqft) : '0'} - {filters.maxSqft !== undefined ? formatNumber(filters.maxSqft) : 'Max'}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, minSqft: undefined, maxSqft: undefined }))} />
            </Badge>
          )}
          {(filters.minBeds !== undefined || filters.maxBeds !== undefined) && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-rose-50 text-rose-700">
              Beds: {filters.minBeds ?? 0} - {filters.maxBeds ?? 'Max'}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, minBeds: undefined, maxBeds: undefined }))} />
            </Badge>
          )}
          {(filters.minBaths !== undefined || filters.maxBaths !== undefined) && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-cyan-50 text-cyan-700">
              Baths: {filters.minBaths ?? 0} - {filters.maxBaths ?? 'Max'}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, minBaths: undefined, maxBaths: undefined }))} />
            </Badge>
          )}
          {(filters.dateAddedPreset || filters.createdAfter || filters.createdBefore) && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-orange-50 text-orange-700">
              <Calendar className="h-3 w-3 mr-1" />
              {filters.dateAddedPreset === 'today' && 'Added Today'}
              {filters.dateAddedPreset === 'yesterday' && 'Added Yesterday'}
              {filters.dateAddedPreset === 'thisWeek' && 'Added This Week'}
              {filters.dateAddedPreset === 'last7Days' && 'Added Last 7 Days'}
              {filters.dateAddedPreset === 'thisMonth' && 'Added This Month'}
              {filters.dateAddedPreset === 'last30Days' && 'Added Last 30 Days'}
              {filters.dateAddedPreset === 'custom' && `${filters.createdAfter || ''} - ${filters.createdBefore || ''}`}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({
                ...f,
                dateAddedPreset: undefined,
                createdAfter: undefined,
                createdBefore: undefined
              }))} />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// Multi-Select Filter Component
function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onSelect
}: {
  label: string
  icon: React.ReactNode
  options: string[]
  selected: string[]
  onSelect: (selected: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 text-xs border-dashed",
            selected.length > 0 && "border-primary text-primary"
          )}
        >
          {icon}
          <span className="ml-1">{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs bg-primary/10 text-primary">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-48">
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option}
                    onSelect={() => {
                      if (selected.includes(option)) {
                        onSelect(selected.filter(s => s !== option))
                      } else {
                        onSelect([...selected, option])
                      }
                    }}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                      selected.includes(option) ? "bg-primary border-primary text-primary-foreground" : "border-gray-300"
                    )}>
                      {selected.includes(option) && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-sm truncate">{option}</span>
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onSelect([])}>
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// Range Filter Component
function RangeFilter({
  label,
  icon,
  min,
  max,
  currentMin,
  currentMax,
  formatValue,
  step = undefined,
  onChange
}: {
  label: string
  icon: React.ReactNode
  min: number
  max: number
  currentMin?: number
  currentMax?: number
  formatValue: (val: number) => string
  step?: number
  onChange: (min?: number, max?: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [localMin, setLocalMin] = useState<string>('')
  const [localMax, setLocalMax] = useState<string>('')

  useEffect(() => {
    setLocalMin(currentMin !== undefined ? String(currentMin) : '')
    setLocalMax(currentMax !== undefined ? String(currentMax) : '')
  }, [currentMin, currentMax])

  const hasValue = currentMin !== undefined || currentMax !== undefined

  const handleApply = () => {
    onChange(
      localMin !== '' ? Number(localMin) : undefined,
      localMax !== '' ? Number(localMax) : undefined
    )
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 text-xs border-dashed",
            hasValue && "border-primary text-primary"
          )}
        >
          {icon}
          <span className="ml-1">{label}</span>
          {hasValue && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs bg-primary/10 text-primary">
              ✓
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-4">
          <div className="text-sm font-medium">{label} Range</div>
          <div className="text-xs text-gray-500">
            Available: {formatValue(min)} - {formatValue(max)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Min</Label>
              <Input
                type="number"
                placeholder={formatValue(min)}
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Max</Label>
              <Input
                type="number"
                placeholder={formatValue(max)}
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => { onChange(undefined, undefined); setOpen(false); }}>
              Clear
            </Button>
            <Button size="sm" className="flex-1 h-8" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

