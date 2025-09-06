"use client"

import { useState, useEffect, useMemo } from "react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Search, X, Filter, Users, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { formatPhoneNumberForDisplay, getBestPhoneNumber } from "@/lib/phone-utils"
import { useContacts } from "@/lib/context/contacts-context"
import type { Contact } from "@/lib/types"

interface FilterCriteria {
  field: string
  operator: string
  value: string
}

interface AdvancedContactFilterProps {
  contacts: Contact[]
  onFilteredContactsChange: (contacts: Contact[]) => void
  selectedContacts: Contact[]
  onSelectedContactsChange: (contacts: Contact[]) => void
  showList?: boolean
  hideHeader?: boolean
  hideSelectAllPagesButton?: boolean
  extraActions?: ReactNode
}

const FILTER_OPTIONS = [
  {
    category: "Location",
    fields: [
      { value: "city", label: "City", type: "select", options: [] },
      { value: "state", label: "State", type: "select", options: [] },
      { value: "propertyCounty", label: "County", type: "select", options: [] },
    ]
  },
  {
    category: "Property Type",
    fields: [
      { value: "propertyType", label: "Property Type", type: "select", options: [] },
    ]
  },
  {
    category: "Deal Status",
    fields: [
      { value: "dealStatus", label: "Deal Status", type: "select", options: [
        "lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"
      ]},
    ]
  }
]

export default function AdvancedContactFilter({
  contacts,
  onFilteredContactsChange,
  selectedContacts,
  onSelectedContactsChange,
  showList = true,
  hideHeader = false,
  hideSelectAllPagesButton = false,
  extraActions,
}: AdvancedContactFilterProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<{[key: string]: string[]}>({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [yearBuiltRange, setYearBuiltRange] = useState<[number, number]>([1900, 2024])
  const [equityRange, setEquityRange] = useState<[number, number]>([0, 1000000])
  const [valueRange, setValueRange] = useState<[number, number]>([0, 2000000])
  const [isClearing, setIsClearing] = useState(false)

  const { toast } = useToast()
  const { filterOptions, searchContacts, contacts: contextContacts, pagination, currentQuery, currentFilters } = useContacts()

  // Get dynamic filter options from database
  const getDynamicFilterOptions = () => {
    if (!filterOptions) return []

    return [
      {
        category: "Location",
        fields: [
          { value: "city", label: "City", type: "select", options: filterOptions.cities || [] },
          { value: "state", label: "State", type: "select", options: filterOptions.states || [] },
          { value: "propertyCounty", label: "County", type: "select", options: filterOptions.counties || [] },
        ]
      },
      {
        category: "Property Type",
        fields: [
          { value: "propertyType", label: "Property Type", type: "select", options: filterOptions.propertyTypes || [] },
        ]
      },
      {
        category: "Deal Status",
        fields: [
          { value: "dealStatus", label: "Deal Status", type: "select", options: filterOptions.dealStatuses || [] },
        ]
      },
      {
        category: "Tags",
        fields: [
          { value: "tags", label: "Tags", type: "select", options: filterOptions.tags?.map((tag: any) => tag.name) || [] },
        ]
      }
    ]
  }

  // Get unique values for select filters (fallback)
  const getUniqueValues = (field: string) => {
    const values = contacts
      .map(contact => (contact as any)[field])
      .filter(value => value !== null && value !== undefined && value.toString().trim() !== "")
      .map(value => value.toString().trim())

    const uniqueValues = [...new Set(values)].sort()
    return uniqueValues
  }

  // Get min/max values for sliders
  const getMinMaxValues = (field: string) => {
    const values = contacts
      .map(contact => (contact as any)[field])
      .filter(value => value !== null && value !== undefined && !isNaN(Number(value)))
      .map(value => Number(value))

    if (values.length === 0) return [0, 100]
    return [Math.min(...values), Math.max(...values)]
  }

  // Initialize slider ranges based on actual data
  const [minYearBuilt, maxYearBuilt] = getMinMaxValues('effectiveYearBuilt')
  const [minEquity, maxEquity] = getMinMaxValues('estEquity')


  // DB-backed ranges
  const dbMinValue = filterOptions?.valueRange?.min ?? 0
  const dbMaxValue = filterOptions?.valueRange?.max ?? 2000000
  const dbMinEquity = filterOptions?.equityRange?.min ?? 0
  const dbMaxEquity = filterOptions?.equityRange?.max ?? 1000000

  const hasActiveFilters = Object.values(selectedFilters).some(values => values.length > 0)

  // Apply filters and search
  const filteredContacts = useMemo(() => {
    const base = (searchQuery || hasActiveFilters) ? contextContacts : contacts
    let result = base

    // Apply search query across multiple fields
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(contact =>
        contact.firstName?.toLowerCase().includes(query) ||
        contact.lastName?.toLowerCase().includes(query) ||
        contact.email1?.toLowerCase().includes(query) ||
        contact.email2?.toLowerCase().includes(query) ||
        contact.email3?.toLowerCase().includes(query) ||
        contact.phone1?.includes(query) ||
        contact.phone2?.includes(query) ||
        contact.phone3?.includes(query) ||
        contact.propertyAddress?.toLowerCase().includes(query) ||
        contact.city?.toLowerCase().includes(query) ||
        contact.llcName?.toLowerCase().includes(query)
      )
    }

    // Apply selected filters
    Object.entries(selectedFilters).forEach(([field, values]) => {
      if (values.length > 0) {
        result = result.filter(contact => {
          const fieldValue = (contact as any)[field]?.toString() || ""
          return values.includes(fieldValue)
        })
      }
    })

    // Apply year built range filter
    if (yearBuiltRange[0] !== minYearBuilt || yearBuiltRange[1] !== maxYearBuilt) {
      result = result.filter(contact => {
        const yearBuilt = contact.effectiveYearBuilt
        if (!yearBuilt) return false
        return yearBuilt >= yearBuiltRange[0] && yearBuilt <= yearBuiltRange[1]
      })
    }

    // Apply equity range filter
    if (equityRange[0] !== minEquity || equityRange[1] !== maxEquity) {
      result = result.filter(contact => {
        const equity = contact.estEquity
        if (!equity) return false
        return equity >= equityRange[0] && equity <= equityRange[1]
      })
    }

    return result
  }, [contacts, searchQuery, selectedFilters, yearBuiltRange, equityRange, minYearBuilt, maxYearBuilt, minEquity, maxEquity])



  // Update filtered contacts when they change
  useEffect(() => {
    // Use context contacts when filters are applied (database search results)
    // Otherwise use local contacts (for initial load)
    const contactsToUse = (searchQuery || hasActiveFilters) ? contextContacts : filteredContacts
    onFilteredContactsChange(contactsToUse)
  }, [filteredContacts, contextContacts, searchQuery, hasActiveFilters, onFilteredContactsChange])

  // Initialize slider ranges when contacts load (year built only)
  useEffect(() => {
    if (contacts.length > 0) {
      setYearBuiltRange([minYearBuilt, maxYearBuilt])
    }
  }, [contacts.length, minYearBuilt, maxYearBuilt])

  // Initialize DB-backed sliders when filter options load
  useEffect(() => {
    setValueRange([dbMinValue, dbMaxValue])
    setEquityRange([dbMinEquity, dbMaxEquity])
  }, [dbMinValue, dbMaxValue, dbMinEquity, dbMaxEquity])

  // Debounced DB search when query changes
  const debouncedSearch = useDebounce(searchQuery, 800)
  useEffect(() => {
    // Skip debounced search if we're in the middle of clearing filters
    if (isClearing) {
      console.log(`🔍 [ADVANCED FILTER DEBUG] Skipping debounced search - clearing in progress`)
      return
    }

    const filters = Object.entries(selectedFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) acc[key] = values.join(',')
      return acc
    }, {} as any)
    filters.minValue = String(valueRange[0])
    filters.maxValue = String(valueRange[1])
    filters.minEquity = String(equityRange[0])
    filters.maxEquity = String(equityRange[1])

    console.log(`🔍 [ADVANCED FILTER DEBUG] Triggering search: "${debouncedSearch}" with filters:`, filters)
    searchContacts(debouncedSearch, filters)
  }, [debouncedSearch, selectedFilters, valueRange, equityRange, isClearing])


  // Re-run search when value/equity sliders change
  useEffect(() => {
    const filters = Object.entries(selectedFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) acc[key] = values.join(',')
      return acc
    }, {} as any)
    filters.minValue = String(valueRange[0])
    filters.maxValue = String(valueRange[1])
    filters.minEquity = String(equityRange[0])
    filters.maxEquity = String(equityRange[1])
    searchContacts(searchQuery, filters)
  }, [valueRange, equityRange])

  const clearAllFilters = () => {
    // Set clearing flag to prevent debounced search from interfering
    setIsClearing(true)

    // Clear all state first
    setSearchQuery("")
    setSelectedFilters({})
    setShowAdvancedFilters(false)
    setYearBuiltRange([minYearBuilt, maxYearBuilt])

    // Reset to "show all" ranges instead of database min/max ranges
    // This ensures no contacts are filtered out by value/equity constraints
    setValueRange([0, 5000000]) // Very wide range to include all contacts
    setEquityRange([0, 2000000000]) // Very wide range to include all contacts

    // Immediately trigger search with empty query and no filters
    // This prevents the debounced search from running with old values
    console.log(`🔍 [CLEAR FILTERS DEBUG] Clearing all filters and showing all contacts`)
    searchContacts("", {
      minValue: "0",
      maxValue: "5000000",
      minEquity: "0",
      maxEquity: "2000000000"
    })

    // Reset clearing flag after a short delay to allow the search to complete
    setTimeout(() => {
      setIsClearing(false)
    }, 1000)
  }

  // Handle search input (debounced effect triggers DB query)
  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  // Handle filter changes with database search
  const handleFilterChange = (field: string, value: string, checked: boolean) => {
    const newFilters = { ...selectedFilters }
    const currentValues = newFilters[field] || []

    if (checked) {
      newFilters[field] = [...currentValues, value]
    } else {
      newFilters[field] = currentValues.filter(v => v !== value)
    }

    setSelectedFilters(newFilters)

    // Apply search with new filters
    const filters = Object.entries(newFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) {
        acc[key] = values.join(',')
      }
      return acc
    }, {} as any)

    filters.minValue = String(valueRange[0])
    filters.maxValue = String(valueRange[1])
    filters.minEquity = String(equityRange[0])
    filters.maxEquity = String(equityRange[1])

    searchContacts(searchQuery, filters)
  }

  const handleSelectAll = () => {
    onSelectedContactsChange(filteredContacts)
    toast({
      title: "All contacts selected",
      description: `Selected ${filteredContacts.length} contacts`,
    })
  }

  const handleDeselectAll = () => {
    onSelectedContactsChange([])
    toast({
      title: "All contacts deselected",
      description: "No contacts selected",
    })
  }

  const handleContactToggle = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.id === contact.id)
    if (isSelected) {
      onSelectedContactsChange(selectedContacts.filter(c => c.id !== contact.id))
    } else {
      onSelectedContactsChange([...selectedContacts, contact])
    }
  }


  const handleSelectPage = () => {
    const pagePool = (searchQuery || hasActiveFilters) ? contextContacts : contacts
    onSelectedContactsChange(pagePool)
    toast({
      title: "Current page selected",
      description: `Selected ${pagePool.length} contacts from current page`,
    })
  }

  const handleSelectAllPages = async () => {
    try {
      // Build base params using current query and filters
      const base = new URLSearchParams({ page: '1', limit: '100' })
      if (currentQuery) base.set('search', currentQuery)
      if (currentFilters) {
        Object.entries(currentFilters).forEach(([k, v]) => {
          if (v != null && String(v).length > 0) base.set(k, String(v))
        })
      }

      const fetchPage = async (page: number) => {
        base.set('page', String(page))
        const res = await fetch(`/api/contacts?${base.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const contactsData = data.contacts?.contacts || data.contacts || data
        const paginationData = data.contacts?.pagination || data.pagination || null
        return { contacts: contactsData as Contact[], pagination: paginationData }
      }

      const first = await fetchPage(1)
      let all: Contact[] = Array.isArray(first.contacts) ? first.contacts : []
      const totalPages = first.pagination?.totalPages || 1
      for (let p = 2; p <= totalPages; p++) {
        const next = await fetchPage(p)
        if (Array.isArray(next.contacts)) all = all.concat(next.contacts)
      }

      onSelectedContactsChange(all)
      toast({
        title: "All contacts selected",
        description: `Selected ${all.length} contacts from all pages`,
      })
    } catch (error) {
      console.error('Error selecting all contacts:', error)
      toast({ title: "Error", description: "Failed to select all contacts", variant: "destructive" })
    }
  }


  return (
    <Card>
      {!hideHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contact Selection
            <Badge variant="secondary" className="ml-auto">
              {selectedContacts.length} of {filteredContacts.length} selected
            </Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search contacts by name, email, phone, address..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Controls */}
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
          </Button>
          <Button variant="outline" size="sm" onClick={handleSelectPage}>
            <Check className="h-4 w-4 mr-2" />
            {`Select Page (${(searchQuery || hasActiveFilters ? contextContacts : contacts).length})`}
          </Button>
          {!hideSelectAllPagesButton && (
            <Button variant="outline" size="sm" onClick={handleSelectAllPages}>
              <Check className="h-4 w-4 mr-2" />
              {`Select All Pages (${pagination?.totalCount ?? 'All'})`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            Deselect All
          </Button>
          {(searchQuery || hasActiveFilters) && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
          {extraActions}
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <Card>
            <CardContent className="p-6">
              {/* Filter Grid - Two Columns (explicit grouping) */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* State */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm text-gray-900">State</h5>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {(filterOptions?.states?.length ? filterOptions.states : getUniqueValues('state')).slice(0, 100).map((option: string) => {
                        const pool = (searchQuery || hasActiveFilters) ? contextContacts : contacts
                        const count = Array.isArray(pool) ? pool.filter(c => (c as any)['state'] === option).length : 0
                        const isSelected = selectedFilters['state']?.includes(option) || false
                        return (
                          <div key={`state-${option}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`state-${option}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleFilterChange('state', option, checked as boolean)}
                            />
                            <Label htmlFor={`state-${option}`} className="text-sm cursor-pointer flex-1">
                              {option} ({count})
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* County */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm text-gray-900">County</h5>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {(filterOptions?.counties?.length ? filterOptions.counties : getUniqueValues('propertyCounty')).slice(0, 100).map((option: string) => {
                        const pool = (searchQuery || hasActiveFilters) ? contextContacts : contacts
                        const count = Array.isArray(pool) ? pool.filter(c => (c as any)['propertyCounty'] === option).length : 0
                        const isSelected = selectedFilters['propertyCounty']?.includes(option) || false
                        return (
                          <div key={`county-${option}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`county-${option}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleFilterChange('propertyCounty', option, checked as boolean)}
                            />
                            <Label htmlFor={`county-${option}`} className="text-sm cursor-pointer flex-1">
                              {option} ({count})
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Deal Status */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm text-gray-900">Deal Status</h5>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {(filterOptions?.dealStatuses?.length ? filterOptions.dealStatuses : getUniqueValues('dealStatus')).slice(0, 50).map((option: string) => {
                        const pool = (searchQuery || hasActiveFilters) ? contextContacts : contacts
                        const count = Array.isArray(pool) ? pool.filter(c => (c as any)['dealStatus'] === option).length : 0
                        const isSelected = selectedFilters['dealStatus']?.includes(option) || false
                        return (
                          <div key={`deal-${option}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`deal-${option}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleFilterChange('dealStatus', option, checked as boolean)}
                            />
                            <Label htmlFor={`deal-${option}`} className="text-sm cursor-pointer flex-1">
                              {option} ({count})
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Location (City) */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm text-gray-900">Location (City)</h5>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {(filterOptions?.cities?.length ? filterOptions.cities : getUniqueValues('city')).slice(0, 100).map((option: string) => {
                        const pool = (searchQuery || hasActiveFilters) ? contextContacts : contacts
                        const count = Array.isArray(pool) ? pool.filter(c => (c as any)['city'] === option).length : 0
                        const isSelected = selectedFilters['city']?.includes(option) || false
                        return (
                          <div key={`city-${option}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`city-${option}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleFilterChange('city', option, checked as boolean)}
                            />
                            <Label htmlFor={`city-${option}`} className="text-sm cursor-pointer flex-1">
                              {option} ({count})
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Property Type */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm text-gray-900">Property Type</h5>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {(filterOptions?.propertyTypes?.length ? filterOptions.propertyTypes : getUniqueValues('propertyType')).slice(0, 50).map((option: string) => {
                        const pool = (searchQuery || hasActiveFilters) ? contextContacts : contacts
                        const count = Array.isArray(pool) ? pool.filter(c => (c as any)['propertyType'] === option).length : 0
                        const isSelected = selectedFilters['propertyType']?.includes(option) || false
                        return (
                          <div key={`ptype-${option}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`ptype-${option}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => handleFilterChange('propertyType', option, checked as boolean)}
                            />
                            <Label htmlFor={`ptype-${option}`} className="text-sm cursor-pointer flex-1">
                              {option} ({count})
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sliders Section */}
              <div className="mt-8 space-y-6">
                {/* Year Built Slider */}
                {maxYearBuilt > minYearBuilt && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-lg text-gray-900">Year Built</h4>
                      <span className="text-sm text-gray-600">
                        {yearBuiltRange[0]} - {yearBuiltRange[1]}
                      </span>
                    </div>
                    <Slider
                      value={yearBuiltRange}
                      onValueChange={(value) => setYearBuiltRange(value as [number, number])}
                      min={minYearBuilt}
                      max={maxYearBuilt}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Estimated Value Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-lg text-gray-900">Estimated Value</h4>
                    <span className="text-sm text-gray-600">
                      ${valueRange[0].toLocaleString()} - ${valueRange[1].toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={valueRange}
                    onValueChange={(value) => setValueRange(value as [number, number])}
                    min={dbMinValue}
                    max={dbMaxValue}
                    step={1000}
                    className="w-full"
                  />
                </div>

                {/* Estimated Equity Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-lg text-gray-900">Estimated Equity</h4>
                    <span className="text-sm text-gray-600">
                      ${equityRange[0].toLocaleString()} - ${equityRange[1].toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={equityRange}
                    onValueChange={(value) => setEquityRange(value as [number, number])}
                    min={dbMinEquity}
                    max={dbMaxEquity}
                    step={1000}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Clear All Button */}
              {(hasActiveFilters ||
                yearBuiltRange[0] !== minYearBuilt || yearBuiltRange[1] !== maxYearBuilt ||
                valueRange[0] !== dbMinValue || valueRange[1] !== dbMaxValue ||
                equityRange[0] !== dbMinEquity || equityRange[1] !== dbMaxEquity) && (
                <div className="mt-6 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFilters({})
                      setYearBuiltRange([minYearBuilt, maxYearBuilt])
                      // Reset to "show all" ranges instead of database min/max ranges
                      setValueRange([0, 5000000]) // Very wide range to include all contacts
                      setEquityRange([0, 2000000000]) // Very wide range to include all contacts
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact List (optional) */}
        {showList && (
          <ScrollArea className="h-[300px] border rounded-md p-4">
            <div className="space-y-2">
              {filteredContacts.map(contact => {
                const isSelected = selectedContacts.some(c => c.id === contact.id)
                return (
                  <div
                    key={contact.id}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleContactToggle(contact)}
                  >
                    <Checkbox checked={isSelected} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {contact.email1 || formatPhoneNumberForDisplay(getBestPhoneNumber(contact))} • {contact.propertyAddress}
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredContacts.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No contacts match your filters
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
