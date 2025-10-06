"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, X, Filter, Users, Check, Save, FolderOpen, Star, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

  // Separate pending and applied filter states
  const [pendingFilters, setPendingFilters] = useState<{[key: string]: string[]}>({})
  const [appliedFilters, setAppliedFilters] = useState<{[key: string]: string[]}>({})

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Replace range sliders with individual number inputs
  const [minValue, setMinValue] = useState<string>("")
  const [maxValue, setMaxValue] = useState<string>("")
  const [minEquity, setMinEquity] = useState<string>("")
  const [maxEquity, setMaxEquity] = useState<string>("")

  // Search within filter options
  const [filterSearchQueries, setFilterSearchQueries] = useState<{[key: string]: string}>({
    state: "",
    city: "",
    propertyCounty: "",
    propertyType: "",
    tags: ""
  })

  // Filter presets
  const [filterPresets, setFilterPresets] = useState<any[]>([])
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false)
  const [showLoadPresetDialog, setShowLoadPresetDialog] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presetDescription, setPresetDescription] = useState("")
  const [isDefaultPreset, setIsDefaultPreset] = useState(false)

  const { toast } = useToast()
  const { filterOptions, searchContacts, contacts: contextContacts, pagination, currentQuery, currentFilters, isLoading, refreshFilterOptions } = useContacts()

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

  // Check if there are active filters (applied)
  const hasActiveFilters = Object.values(appliedFilters).some(values => values.length > 0) ||
    minValue !== "" || maxValue !== "" || minEquity !== "" || maxEquity !== ""

  // Check if there are pending changes
  const hasPendingChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters) ||
    minValue !== "" || maxValue !== "" || minEquity !== "" || maxEquity !== ""

  // Count active filters for badge
  const activeFilterCount = Object.values(appliedFilters).reduce((count, values) => count + values.length, 0) +
    (minValue !== "" ? 1 : 0) + (maxValue !== "" ? 1 : 0) +
    (minEquity !== "" ? 1 : 0) + (maxEquity !== "" ? 1 : 0)

  // Apply filters and search (using APPLIED filters only)
  const filteredContacts = useMemo(() => {
    // Choose the best available base pool to render immediately:
    // - If searching or filters active: prefer contextContacts when it has data; otherwise fall back to props.contacts
    // - If idle: prefer props.contacts; if empty for some reason, fall back to contextContacts
    const hasSearch = Boolean(searchQuery && searchQuery.trim().length > 0)
    const baseWhenActive = (Array.isArray(contextContacts) && contextContacts.length > 0) ? contextContacts : contacts
    const baseWhenIdle = (Array.isArray(contacts) && contacts.length > 0) ? contacts : contextContacts
    const base = (hasSearch || hasActiveFilters) ? baseWhenActive : baseWhenIdle

    let result = Array.isArray(base) ? base : []

    // Apply search query across multiple fields (works with both DB and ES-shaped contacts)
    if (hasSearch) {
      const query = searchQuery.toLowerCase()
      result = result.filter(contact =>
        contact.firstName?.toLowerCase().includes(query) ||
        contact.lastName?.toLowerCase().includes(query) ||
        contact.email1?.toLowerCase().includes(query) ||
        (contact as any).email?.toLowerCase?.().includes(query) ||
        contact.email2?.toLowerCase().includes(query) ||
        contact.email3?.toLowerCase().includes(query) ||
        contact.phone1?.includes(query) ||
        (contact as any).phone?.toLowerCase?.().includes(query) ||
        contact.phone2?.includes(query) ||
        contact.phone3?.includes(query) ||
        contact.propertyAddress?.toLowerCase().includes(query) ||
        contact.city?.toLowerCase().includes(query) ||
        contact.llcName?.toLowerCase().includes(query)
      )
    }

    // Apply APPLIED filters (not pending)
    Object.entries(appliedFilters).forEach(([field, values]) => {
      if (values.length > 0) {
        result = result.filter(contact => {
          if (field === 'tags') {
            const tagsArr = (contact as any).tags || []
            const tagNames = Array.isArray(tagsArr) ? tagsArr.map((t: any) => (typeof t === 'string' ? t : t.name)) : []
            return values.some(v => tagNames.includes(v))
          }
          const fieldValue = (contact as any)[field]?.toString() || ""
          return values.includes(fieldValue)
        })
      }
    })

    return result
  }, [contacts, contextContacts, searchQuery, appliedFilters, hasActiveFilters])



  // Update filtered contacts when they change
  useEffect(() => {
    // Always show immediate local results for instant feedback
    onFilteredContactsChange(filteredContacts)
  }, [filteredContacts, onFilteredContactsChange])



  // If this filter UI is opened with no local query/filters, but the provider has active query/filters,
  // reset the provider to the full, unfiltered list to avoid stale totals (e.g., Select All Pages count)
  useEffect(() => {
    const hasLocalActive = Boolean(searchQuery && searchQuery.trim().length > 0) ||
      Object.values(appliedFilters).some(values => values.length > 0)
    const hasProviderActive = Boolean(currentQuery && currentQuery.trim().length > 0) ||
      (currentFilters && Object.keys(currentFilters).length > 0)
    if (!hasLocalActive && hasProviderActive) {
      searchContacts('', {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build filters object from current state
  const buildFiltersObject = () => {
    const filters = Object.entries(appliedFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) {
        acc[key] = values.join(',')
      }
      return acc
    }, {} as any)

    if (minValue !== "") {
      filters.minValue = minValue
    }
    if (maxValue !== "") {
      filters.maxValue = maxValue
    }
    if (minEquity !== "") {
      filters.minEquity = minEquity
    }
    if (maxEquity !== "") {
      filters.maxEquity = maxEquity
    }

    return filters
  }

  // Apply filters - triggers database search
  const handleApplyFilters = () => {
    // Validate number inputs
    if (minValue !== "" && maxValue !== "" && Number(minValue) > Number(maxValue)) {
      toast({
        title: "Invalid Range",
        description: "Minimum value cannot be greater than maximum value",
        variant: "destructive"
      })
      return
    }
    if (minEquity !== "" && maxEquity !== "" && Number(minEquity) > Number(maxEquity)) {
      toast({
        title: "Invalid Range",
        description: "Minimum equity cannot be greater than maximum equity",
        variant: "destructive"
      })
      return
    }

    // Apply pending filters
    setAppliedFilters(pendingFilters)

    // Build and execute search
    const filters = Object.entries(pendingFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) {
        acc[key] = values.join(',')
      }
      return acc
    }, {} as any)

    if (minValue !== "") filters.minValue = minValue
    if (maxValue !== "") filters.maxValue = maxValue
    if (minEquity !== "") filters.minEquity = minEquity
    if (maxEquity !== "") filters.maxEquity = maxEquity

    searchContacts(searchQuery, filters)

    toast({
      title: "Filters Applied",
      description: `${Object.keys(filters).length} filter(s) active`,
    })
  }

  // Reset all filters
  const handleResetFilters = () => {
    setPendingFilters({})
    setAppliedFilters({})
    setMinValue("")
    setMaxValue("")
    setMinEquity("")
    setMaxEquity("")
    setSearchQuery("")
    searchContacts("", {})

    toast({
      title: "Filters Reset",
      description: "All filters have been cleared",
    })
  }

  // Fetch filter presets
  const fetchPresets = async () => {
    try {
      const response = await fetch('/api/filter-presets')
      if (response.ok) {
        const presets = await response.json()
        setFilterPresets(presets)
      }
    } catch (error) {
      console.error('Error fetching presets:', error)
    }
  }

  // Save current filters as preset
  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this preset",
        variant: "destructive"
      })
      return
    }

    try {
      const filters = {
        pendingFilters,
        minValue,
        maxValue,
        minEquity,
        maxEquity
      }

      const response = await fetch('/api/filter-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName,
          description: presetDescription,
          filters,
          isDefault: isDefaultPreset
        })
      })

      if (response.ok) {
        toast({
          title: "Preset Saved",
          description: `Filter preset "${presetName}" has been saved`,
        })
        setShowSavePresetDialog(false)
        setPresetName("")
        setPresetDescription("")
        setIsDefaultPreset(false)
        fetchPresets()
      } else {
        throw new Error('Failed to save preset')
      }
    } catch (error) {
      console.error('Error saving preset:', error)
      toast({
        title: "Error",
        description: "Failed to save filter preset",
        variant: "destructive"
      })
    }
  }

  // Load a preset
  const handleLoadPreset = (preset: any) => {
    const { pendingFilters: savedFilters, minValue: savedMinValue, maxValue: savedMaxValue, minEquity: savedMinEquity, maxEquity: savedMaxEquity } = preset.filters

    setPendingFilters(savedFilters || {})
    setMinValue(savedMinValue || "")
    setMaxValue(savedMaxValue || "")
    setMinEquity(savedMinEquity || "")
    setMaxEquity(savedMaxEquity || "")

    setShowLoadPresetDialog(false)

    toast({
      title: "Preset Loaded",
      description: `Loaded "${preset.name}". Click Apply to activate filters.`,
    })
  }

  // Delete a preset
  const handleDeletePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/filter-presets/${presetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Preset Deleted",
          description: "Filter preset has been deleted",
        })
        fetchPresets()
      } else {
        throw new Error('Failed to delete preset')
      }
    } catch (error) {
      console.error('Error deleting preset:', error)
      toast({
        title: "Error",
        description: "Failed to delete filter preset",
        variant: "destructive"
      })
    }
  }

  // Load presets on mount
  useEffect(() => {
    fetchPresets()
  }, [])

  // Handle search input: trigger immediate DB search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    const filters = buildFiltersObject()
    searchContacts(query, filters)
  }

  // Handle filter checkbox changes (updates pending state only)
  const handleFilterChange = (field: string, value: string, checked: boolean) => {
    const newFilters = { ...pendingFilters }
    const currentValues = newFilters[field] || []

    if (checked) {
      newFilters[field] = [...currentValues, value]
    } else {
      newFilters[field] = currentValues.filter(v => v !== value)
    }

    setPendingFilters(newFilters)
  }

  // Remove individual filter chip
  const handleRemoveFilter = (field: string, value?: string) => {
    if (field === 'minValue') {
      setMinValue("")
    } else if (field === 'maxValue') {
      setMaxValue("")
    } else if (field === 'minEquity') {
      setMinEquity("")
    } else if (field === 'maxEquity') {
      setMaxEquity("")
    } else {
      const newFilters = { ...appliedFilters }
      if (value) {
        newFilters[field] = (newFilters[field] || []).filter(v => v !== value)
        if (newFilters[field].length === 0) {
          delete newFilters[field]
        }
      } else {
        delete newFilters[field]
      }
      setAppliedFilters(newFilters)
      setPendingFilters(newFilters)

      // Re-apply search with updated filters
      const filters = Object.entries(newFilters).reduce((acc, [key, values]) => {
        if (values.length > 0) {
          acc[key] = values.join(',')
        }
        return acc
      }, {} as any)

      if (minValue !== "" && field !== 'minValue') filters.minValue = minValue
      if (maxValue !== "" && field !== 'maxValue') filters.maxValue = maxValue
      if (minEquity !== "" && field !== 'minEquity') filters.minEquity = minEquity
      if (maxEquity !== "" && field !== 'maxEquity') filters.maxEquity = maxEquity

      searchContacts(searchQuery, filters)
    }
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
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex gap-2 flex-wrap items-center">
            {Object.entries(appliedFilters).map(([field, values]) =>
              values.map((value) => (
                <Badge key={`${field}-${value}`} variant="secondary" className="gap-1">
                  {field}: {value}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveFilter(field, value)}
                  />
                </Badge>
              ))
            )}
            {minValue !== "" && (
              <Badge variant="secondary" className="gap-1">
                Min Value: ${Number(minValue).toLocaleString()}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => handleRemoveFilter('minValue')}
                />
              </Badge>
            )}
            {maxValue !== "" && (
              <Badge variant="secondary" className="gap-1">
                Max Value: ${Number(maxValue).toLocaleString()}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => handleRemoveFilter('maxValue')}
                />
              </Badge>
            )}
            {minEquity !== "" && (
              <Badge variant="secondary" className="gap-1">
                Min Equity: ${Number(minEquity).toLocaleString()}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => handleRemoveFilter('minEquity')}
                />
              </Badge>
            )}
            {maxEquity !== "" && (
              <Badge variant="secondary" className="gap-1">
                Max Equity: ${Number(maxEquity).toLocaleString()}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => handleRemoveFilter('maxEquity')}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
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
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              <X className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          )}
          {extraActions}
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <Card>
            <CardContent className="p-6">
              {/* Collapsible Filter Sections with Accordion */}
              <Accordion type="multiple" defaultValue={["location", "property", "tags"]} className="w-full">

                {/* Location Section */}
                <AccordionItem value="location">
                  <AccordionTrigger className="text-base font-semibold">
                    📍 Location Filters
                    {(pendingFilters['state']?.length || pendingFilters['city']?.length || pendingFilters['propertyCounty']?.length) ? (
                      <Badge variant="secondary" className="ml-2">
                        {(pendingFilters['state']?.length || 0) + (pendingFilters['city']?.length || 0) + (pendingFilters['propertyCounty']?.length || 0)}
                      </Badge>
                    ) : null}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-3 gap-6 pt-2">
                      {/* State */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm text-gray-700">State</h5>
                        <Input
                          placeholder="Search states..."
                          value={filterSearchQueries.state}
                          onChange={(e) => setFilterSearchQueries({...filterSearchQueries, state: e.target.value})}
                          className="h-8 text-sm"
                        />
                        <ScrollArea className="h-40 pr-2">
                          <div className="space-y-2">
                            {(filterOptions?.states?.length ? filterOptions.states : getUniqueValues('state'))
                              .filter((option: string) => option.toLowerCase().includes(filterSearchQueries.state.toLowerCase()))
                              .slice(0, 100).map((option: string) => {
                              const isSelected = pendingFilters['state']?.includes(option) || false
                              return (
                                <div key={`state-${option}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`state-${option}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleFilterChange('state', option, checked as boolean)}
                                  />
                                  <Label htmlFor={`state-${option}`} className="text-sm cursor-pointer flex-1">
                                    {option}
                                  </Label>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* City */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm text-gray-700">City</h5>
                        <Input
                          placeholder="Search cities..."
                          value={filterSearchQueries.city}
                          onChange={(e) => setFilterSearchQueries({...filterSearchQueries, city: e.target.value})}
                          className="h-8 text-sm"
                        />
                        <ScrollArea className="h-40 pr-2">
                          <div className="space-y-2">
                            {(filterOptions?.cities?.length ? filterOptions.cities : getUniqueValues('city'))
                              .filter((option: string) => option.toLowerCase().includes(filterSearchQueries.city.toLowerCase()))
                              .slice(0, 100).map((option: string) => {
                              const isSelected = pendingFilters['city']?.includes(option) || false
                              return (
                                <div key={`city-${option}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`city-${option}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleFilterChange('city', option, checked as boolean)}
                                  />
                                  <Label htmlFor={`city-${option}`} className="text-sm cursor-pointer flex-1">
                                    {option}
                                  </Label>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* County */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm text-gray-700">County</h5>
                        <Input
                          placeholder="Search counties..."
                          value={filterSearchQueries.propertyCounty}
                          onChange={(e) => setFilterSearchQueries({...filterSearchQueries, propertyCounty: e.target.value})}
                          className="h-8 text-sm"
                        />
                        <ScrollArea className="h-40 pr-2">
                          <div className="space-y-2">
                            {(filterOptions?.counties?.length ? filterOptions.counties : getUniqueValues('propertyCounty'))
                              .filter((option: string) => option.toLowerCase().includes(filterSearchQueries.propertyCounty.toLowerCase()))
                              .slice(0, 100).map((option: string) => {
                              const isSelected = pendingFilters['propertyCounty']?.includes(option) || false
                              return (
                                <div key={`county-${option}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`county-${option}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleFilterChange('propertyCounty', option, checked as boolean)}
                                  />
                                  <Label htmlFor={`county-${option}`} className="text-sm cursor-pointer flex-1">
                                    {option}
                                  </Label>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Property Section */}
                <AccordionItem value="property">
                  <AccordionTrigger className="text-base font-semibold">
                    🏠 Property Filters
                    {pendingFilters['propertyType']?.length ? (
                      <Badge variant="secondary" className="ml-2">
                        {pendingFilters['propertyType'].length}
                      </Badge>
                    ) : null}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      {/* Property Type */}
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm text-gray-700">Property Type</h5>
                        <Input
                          placeholder="Search property types..."
                          value={filterSearchQueries.propertyType}
                          onChange={(e) => setFilterSearchQueries({...filterSearchQueries, propertyType: e.target.value})}
                          className="h-8 text-sm"
                        />
                        <ScrollArea className="h-40 pr-2">
                          <div className="grid grid-cols-2 gap-2">
                            {(filterOptions?.propertyTypes?.length ? filterOptions.propertyTypes : getUniqueValues('propertyType'))
                              .filter((option: string) => option.toLowerCase().includes(filterSearchQueries.propertyType.toLowerCase()))
                              .slice(0, 50).map((option: string) => {
                              const isSelected = pendingFilters['propertyType']?.includes(option) || false
                              return (
                                <div key={`ptype-${option}`} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`ptype-${option}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleFilterChange('propertyType', option, checked as boolean)}
                                  />
                                  <Label htmlFor={`ptype-${option}`} className="text-sm cursor-pointer flex-1">
                                    {option}
                                  </Label>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Tags Section */}
                <AccordionItem value="tags">
                  <AccordionTrigger className="text-base font-semibold">
                    🏷️ Tags
                    {pendingFilters['tags']?.length ? (
                      <Badge variant="secondary" className="ml-2">
                        {pendingFilters['tags'].length}
                      </Badge>
                    ) : null}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 space-y-2">
                      <Input
                        placeholder="Search tags..."
                        value={filterSearchQueries.tags}
                        onChange={(e) => setFilterSearchQueries({...filterSearchQueries, tags: e.target.value})}
                        className="h-8 text-sm"
                      />
                      <ScrollArea className="h-40 pr-2">
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            (filterOptions?.tags?.length ? filterOptions.tags.map((t: any) => t.name) : Array.from(new Set((contacts || []).flatMap((c: any) => (c.tags || []).map((t: any) => t.name)))) )
                          ).filter((tagName: string) => tagName.toLowerCase().includes(filterSearchQueries.tags.toLowerCase()))
                          .slice(0, 200).map((tagName: string) => {
                            const isSelected = pendingFilters['tags']?.includes(tagName) || false
                            return (
                              <div key={`tag-${tagName}`} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`tag-${tagName}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleFilterChange('tags', tagName, checked as boolean)}
                                />
                                <Label htmlFor={`tag-${tagName}`} className="text-sm cursor-pointer flex-1">
                                  {tagName}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Value & Equity Ranges Section */}
                <AccordionItem value="ranges">
                  <AccordionTrigger className="text-base font-semibold">
                    💰 Value & Equity Ranges
                    {(minValue || maxValue || minEquity || maxEquity) ? (
                      <Badge variant="secondary" className="ml-2">
                        Active
                      </Badge>
                    ) : null}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                      {/* Estimated Value Range */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm text-gray-700">Estimated Value</h5>
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <Label htmlFor="minValue" className="text-xs text-gray-600">Min Value</Label>
                            <Input
                              id="minValue"
                              type="number"
                              placeholder="e.g., 100000"
                              value={minValue}
                              onChange={(e) => setMinValue(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <span className="text-gray-500 mt-5">to</span>
                          <div className="flex-1">
                            <Label htmlFor="maxValue" className="text-xs text-gray-600">Max Value</Label>
                            <Input
                              id="maxValue"
                              type="number"
                              placeholder="e.g., 500000"
                              value={maxValue}
                              onChange={(e) => setMaxValue(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Estimated Equity Range */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm text-gray-700">Estimated Equity</h5>
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <Label htmlFor="minEquity" className="text-xs text-gray-600">Min Equity</Label>
                            <Input
                              id="minEquity"
                              type="number"
                              placeholder="e.g., 50000"
                              value={minEquity}
                              onChange={(e) => setMinEquity(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <span className="text-gray-500 mt-5">to</span>
                          <div className="flex-1">
                            <Label htmlFor="maxEquity" className="text-xs text-gray-600">Max Equity</Label>
                            <Input
                              id="maxEquity"
                              type="number"
                              placeholder="e.g., 200000"
                              value={maxEquity}
                              onChange={(e) => setMaxEquity(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Preset Management Buttons */}
              <div className="mt-6 flex justify-between items-center gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await refreshFilterOptions()
                      toast({
                        title: "Filter Options Refreshed",
                        description: "Latest tags, cities, and other options loaded",
                      })
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Options
                  </Button>
                  <Dialog open={showLoadPresetDialog} onOpenChange={setShowLoadPresetDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Load Preset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Load Filter Preset</DialogTitle>
                        <DialogDescription>
                          Select a saved filter preset to load
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {filterPresets.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No saved presets</p>
                        ) : (
                          filterPresets.map((preset) => (
                            <div
                              key={preset.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{preset.name}</h4>
                                  {preset.isDefault && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Star className="h-3 w-3 mr-1" />
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                {preset.description && (
                                  <p className="text-sm text-gray-500">{preset.description}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleLoadPreset(preset)}
                                >
                                  Load
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeletePreset(preset.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showSavePresetDialog} onOpenChange={setShowSavePresetDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Save Preset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Save Filter Preset</DialogTitle>
                        <DialogDescription>
                          Save your current filter configuration for quick access later
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="preset-name">Preset Name *</Label>
                          <Input
                            id="preset-name"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="e.g., High Value Florida Properties"
                          />
                        </div>
                        <div>
                          <Label htmlFor="preset-description">Description (Optional)</Label>
                          <Input
                            id="preset-description"
                            value={presetDescription}
                            onChange={(e) => setPresetDescription(e.target.value)}
                            placeholder="Brief description of this filter preset"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="is-default"
                            checked={isDefaultPreset}
                            onCheckedChange={(checked) => setIsDefaultPreset(checked as boolean)}
                          />
                          <Label htmlFor="is-default" className="text-sm cursor-pointer">
                            Set as default preset
                          </Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSavePresetDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSavePreset}>
                          Save Preset
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Apply and Reset Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleResetFilters}
                    disabled={!hasActiveFilters && !hasPendingChanges}
                  >
                    Reset Filters
                  </Button>
                  <Button
                    onClick={handleApplyFilters}
                    disabled={!hasPendingChanges}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact List (optional) */}
        {showList && (
          <ScrollArea className="h-[300px] border rounded-md p-4">
            <div className="space-y-2">
              {filteredContacts.map(contact => {
                const isSelected = selectedContacts.some(c => c.id === contact.id)
                const contactTags = (contact as any).tags || []
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
                      {contactTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contactTags.slice(0, 3).map((tag: any) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                              style={{
                                backgroundColor: tag.color ? `${tag.color}20` : undefined,
                                color: tag.color || undefined,
                                borderColor: tag.color || undefined,
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {contactTags.length > 3 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              +{contactTags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredContacts.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  {isLoading ? "Searching..." : "No contacts match your filters"}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
