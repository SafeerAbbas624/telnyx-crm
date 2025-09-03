"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Search, X, Filter, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Contact } from "@/lib/types"

interface FilterCriteria {
  field: string
  operator: string
  value: string
}

interface ContactsFilterBarProps {
  contacts: Contact[]
  onFilteredContactsChange: (contacts: Contact[]) => void
  selectedContacts: Contact[]
  onSelectedContactsChange: (contacts: Contact[]) => void
}

interface FilterState {
  states: string[]
  cities: string[]
  counties: string[]
  propertyTypes: string[]
  dealStatuses: string[]
  estValueRange: [number, number]
  estEquityRange: [number, number]
  dnc: boolean | null
}

interface FilterOptions {
  states: string[]
  cities: string[]
  counties: string[]
  propertyTypes: string[]
  dealStatuses: string[]
  valueRange: { min: number; max: number }
  equityRange: { min: number; max: number }
}

const ContactsFilterBar: React.FC<ContactsFilterBarProps> = ({
  contacts,
  onFilteredContactsChange,
  selectedContacts,
  onSelectedContactsChange
}) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    states: [],
    cities: [],
    counties: [],
    propertyTypes: [],
    dealStatuses: [],
    valueRange: { min: 0, max: 2000000 },
    equityRange: { min: 0, max: 1000000 }
  })
  const [filters, setFilters] = useState<FilterState>({
    states: [],
    cities: [],
    counties: [],
    propertyTypes: [],
    dealStatuses: [],
    estValueRange: [0, 2000000],
    estEquityRange: [0, 1000000],
    dnc: null
  })
  const { toast } = useToast()

  // Extract dynamic filter options from contacts data
  useEffect(() => {
    const states = [...new Set(contacts.map(c => c.state).filter(Boolean))].sort()
    const cities = [...new Set(contacts.map(c => c.city).filter(Boolean))].sort()
    const counties = [...new Set(contacts.map(c => c.propertyCounty).filter(Boolean))].sort()
    const propertyTypes = [...new Set(contacts.map(c => c.propertyType).filter(Boolean))].sort()
    const dealStatuses = [...new Set(contacts.map(c => c.dealStatus).filter(Boolean))].sort()

    const values = contacts.map(c => Number(c.estValue) || 0).filter(v => v > 0)
    const equities = contacts.map(c => Number(c.estEquity) || 0).filter(v => v > 0)

    const valueRange = values.length > 0 ?
      { min: Math.min(...values), max: Math.max(...values) } :
      { min: 0, max: 2000000 }

    const equityRange = equities.length > 0 ?
      { min: Math.min(...equities), max: Math.max(...equities) } :
      { min: 0, max: 1000000 }

    setFilterOptions({
      states,
      cities,
      counties,
      propertyTypes,
      dealStatuses,
      valueRange,
      equityRange
    })

    // Update filter ranges if they're at default values
    setFilters(prev => ({
      ...prev,
      estValueRange: prev.estValueRange[0] === 0 && prev.estValueRange[1] === 2000000 ?
        [valueRange.min, valueRange.max] : prev.estValueRange,
      estEquityRange: prev.estEquityRange[0] === 0 && prev.estEquityRange[1] === 1000000 ?
        [equityRange.min, equityRange.max] : prev.estEquityRange
    }))
  }, [contacts])

  // Enhanced search function
  const matchesSearch = (contact: Contact, searchTerm: string) => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const searchFields = [
      contact.firstName,
      contact.lastName,
      contact.llcName,
      contact.phone1,
      contact.phone2,
      contact.phone3,
      contact.email1,
      contact.email2,
      contact.email3,
      contact.propertyAddress,
      contact.city,
      contact.state,
      contact.propertyCounty,
      contact.propertyType,
      contact.notes,
      contact.dncReason,
    ].filter(Boolean)

    return searchFields.some(field =>
      field?.toString().toLowerCase().includes(searchLower)
    )
  }

  // Apply filters to contacts
  const filteredContacts = useMemo(() => {
    // If no filters are applied, return all contacts
    const hasFilters = searchTerm ||
      filters.states.length > 0 ||
      filters.cities.length > 0 ||
      filters.counties.length > 0 ||
      filters.propertyTypes.length > 0 ||
      filters.dealStatuses.length > 0 ||
      filters.dnc !== null ||
      filters.estValueRange[0] !== filterOptions.valueRange.min ||
      filters.estValueRange[1] !== filterOptions.valueRange.max ||
      filters.estEquityRange[0] !== filterOptions.equityRange.min ||
      filters.estEquityRange[1] !== filterOptions.equityRange.max

    if (!hasFilters) {
      return contacts
    }

    return contacts.filter((contact) => {
      // Search filter
      if (searchTerm && !matchesSearch(contact, searchTerm)) return false

      // State filter
      if (filters.states.length > 0 && !filters.states.includes(contact.state || '')) return false

      // City filter
      if (filters.cities.length > 0 && !filters.cities.includes(contact.city || '')) return false

      // County filter
      if (filters.counties.length > 0 && !filters.counties.includes(contact.propertyCounty || '')) return false

      // Property Type filter
      if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(contact.propertyType || '')) return false

      // Deal Status filter
      if (filters.dealStatuses.length > 0 && !filters.dealStatuses.includes(contact.dealStatus || '')) return false

      // Estimated Value range filter
      const estValue = Number(contact.estValue) || 0
      if (estValue > 0 && (estValue < filters.estValueRange[0] || estValue > filters.estValueRange[1])) return false

      // Estimated Equity range filter
      const estEquity = Number(contact.estEquity) || 0
      if (estEquity > 0 && (estEquity < filters.estEquityRange[0] || estEquity > filters.estEquityRange[1])) return false

      // DNC filter
      if (filters.dnc !== null && Boolean(contact.dnc) !== filters.dnc) return false

      return true
    })
  }, [contacts, searchTerm, filters, filterOptions.valueRange.min, filterOptions.valueRange.max, filterOptions.equityRange.min, filterOptions.equityRange.max])

  // Update filtered contacts when they change
  useEffect(() => {
    onFilteredContactsChange(filteredContacts)
  }, [filteredContacts, onFilteredContactsChange])



  const clearAllFilters = () => {
    setFilters({
      states: [],
      cities: [],
      counties: [],
      propertyTypes: [],
      dealStatuses: [],
      estValueRange: [filterOptions.valueRange.min, filterOptions.valueRange.max],
      estEquityRange: [filterOptions.equityRange.min, filterOptions.equityRange.max],
      dnc: null
    })
    toast({
      title: "Filters Cleared",
      description: "All filters have been cleared",
    })
  }

  const toggleMultiSelectItem = (filterKey: keyof FilterState, item: string) => {
    setFilters(prev => {
      const currentItems = prev[filterKey] as string[]
      const newItems = currentItems.includes(item)
        ? currentItems.filter(i => i !== item)
        : [...currentItems, item]
      return { ...prev, [filterKey]: newItems }
    })
  }

  const selectAllItems = (filterKey: keyof FilterState, allItems: string[]) => {
    setFilters(prev => ({ ...prev, [filterKey]: allItems }))
  }

  const deselectAllItems = (filterKey: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [filterKey]: [] }))
  }

  // Multi-select filter component
  const MultiSelectFilter: React.FC<{
    title: string
    items: string[]
    selectedItems: string[]
    filterKey: keyof FilterState
  }> = ({ title, items, selectedItems, filterKey }) => {
    const allSelected = selectedItems.length === items.length && items.length > 0
    const someSelected = selectedItems.length > 0 && selectedItems.length < items.length

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{title}</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => allSelected ? deselectAllItems(filterKey) : selectAllItems(filterKey, items)}
              className="h-6 px-2 text-xs"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            {selectedItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deselectAllItems(filterKey)}
                className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedItems.map(item => (
              <Badge key={item} variant="secondary" className="text-xs">
                {item}
                <button
                  onClick={() => toggleMultiSelectItem(filterKey, item)}
                  className="ml-1 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="max-h-24 overflow-y-auto border rounded-md">
          {items.length === 0 ? (
            <div className="p-2 text-sm text-gray-500 text-center">No options available</div>
          ) : (
            <div className="p-2 space-y-1">
              {items.map(item => (
                <div key={item} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${filterKey}-${item}`}
                    checked={selectedItems.includes(item)}
                    onCheckedChange={() => toggleMultiSelectItem(filterKey, item)}
                  />
                  <Label
                    htmlFor={`${filterKey}-${item}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {item}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar and Action Buttons */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-lg">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search contacts by name, email, phone, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter size={16} />
          Advanced Filters
        </Button>


      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="mb-4">
          <CardContent className="p-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Advanced Filters</h3>
                <Button onClick={clearAllFilters} variant="outline" size="sm">
                  Clear All Filters
                </Button>
              </div>

              {/* Location Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MultiSelectFilter
                  title="States"
                  items={filterOptions.states}
                  selectedItems={filters.states}
                  filterKey="states"
                />
                <MultiSelectFilter
                  title="Cities"
                  items={filterOptions.cities}
                  selectedItems={filters.cities}
                  filterKey="cities"
                />
                <MultiSelectFilter
                  title="Counties"
                  items={filterOptions.counties}
                  selectedItems={filters.counties}
                  filterKey="counties"
                />
              </div>

              {/* Property & Deal Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MultiSelectFilter
                  title="Property Types"
                  items={filterOptions.propertyTypes}
                  selectedItems={filters.propertyTypes}
                  filterKey="propertyTypes"
                />
                <MultiSelectFilter
                  title="Deal Status"
                  items={filterOptions.dealStatuses}
                  selectedItems={filters.dealStatuses}
                  filterKey="dealStatuses"
                />
              </div>

              {/* Financial Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Estimated Value: ${filters.estValueRange[0].toLocaleString()} - ${filters.estValueRange[1].toLocaleString()}
                  </Label>
                  <Slider
                    value={filters.estValueRange}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, estValueRange: value as [number, number] }))}
                    min={filterOptions.valueRange.min}
                    max={filterOptions.valueRange.max}
                    step={10000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>${filterOptions.valueRange.min.toLocaleString()}</span>
                    <span>${filterOptions.valueRange.max.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Estimated Equity: ${filters.estEquityRange[0].toLocaleString()} - ${filters.estEquityRange[1].toLocaleString()}
                  </Label>
                  <Slider
                    value={filters.estEquityRange}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, estEquityRange: value as [number, number] }))}
                    min={filterOptions.equityRange.min}
                    max={filterOptions.equityRange.max}
                    step={5000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>${filterOptions.equityRange.min.toLocaleString()}</span>
                    <span>${filterOptions.equityRange.max.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* DNC Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Do Not Call</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dnc-all"
                      checked={filters.dnc === null}
                      onCheckedChange={() => setFilters(prev => ({ ...prev, dnc: null }))}
                    />
                    <Label htmlFor="dnc-all" className="text-sm cursor-pointer">All</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dnc-yes"
                      checked={filters.dnc === true}
                      onCheckedChange={() => setFilters(prev => ({ ...prev, dnc: true }))}
                    />
                    <Label htmlFor="dnc-yes" className="text-sm cursor-pointer">DNC Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dnc-no"
                      checked={filters.dnc === false}
                      onCheckedChange={() => setFilters(prev => ({ ...prev, dnc: false }))}
                    />
                    <Label htmlFor="dnc-no" className="text-sm cursor-pointer">Non-DNC Only</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ContactsFilterBar
