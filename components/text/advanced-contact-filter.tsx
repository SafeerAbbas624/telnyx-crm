"use client"

import { useState, useEffect, useMemo } from "react"
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
import { formatPhoneNumberForDisplay, getBestPhoneNumber } from "@/lib/phone-utils"
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
}: AdvancedContactFilterProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<{[key: string]: string[]}>({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [yearBuiltRange, setYearBuiltRange] = useState<[number, number]>([1900, 2024])
  const [equityRange, setEquityRange] = useState<[number, number]>([0, 1000000])
  const { toast } = useToast()

  // Get unique values for select filters
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

  // Apply filters and search
  const filteredContacts = useMemo(() => {
    let result = contacts

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
    onFilteredContactsChange(filteredContacts)
  }, [filteredContacts, onFilteredContactsChange])

  // Initialize slider ranges when contacts load
  useEffect(() => {
    if (contacts.length > 0) {
      setYearBuiltRange([minYearBuilt, maxYearBuilt])
      setEquityRange([minEquity, maxEquity])
    }
  }, [contacts.length, minYearBuilt, maxYearBuilt, minEquity, maxEquity])

  const handleFilterChange = (field: string, value: string, checked: boolean) => {
    setSelectedFilters(prev => {
      const currentValues = prev[field] || []
      if (checked) {
        return { ...prev, [field]: [...currentValues, value] }
      } else {
        return { ...prev, [field]: currentValues.filter(v => v !== value) }
      }
    })
  }

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedFilters({})
    setShowAdvancedFilters(false)
  }

  const hasActiveFilters = Object.values(selectedFilters).some(values => values.length > 0)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contact Selection
          <Badge variant="secondary" className="ml-auto">
            {selectedContacts.length} of {filteredContacts.length} selected
          </Badge>
        </CardTitle>
      </CardHeader>
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
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
          </Button>
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <Check className="h-4 w-4 mr-2" />
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            Deselect All
          </Button>
          {(searchQuery || hasActiveFilters) && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <Card>
            <CardContent className="p-6">
              {/* Filter Grid - Two Columns */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {FILTER_OPTIONS.map(category => {
                    const hasValues = category.fields.some(field => {
                      if (field.type === "select" && !field.options?.length) {
                        const uniqueValues = getUniqueValues(field.value)
                        return uniqueValues.length > 0
                      }
                      return true
                    })

                    if (!hasValues) return null

                    return (
                      <div key={category.category} className="space-y-3">
                        <h4 className="font-semibold text-lg text-gray-900">{category.category}</h4>

                        {category.fields.map(field => {
                          if (field.type === "select") {
                            const options = field.options?.length ? field.options : getUniqueValues(field.value)
                            if (options.length === 0) return null

                            return (
                              <div key={field.value} className="grid grid-cols-2 gap-2">
                                {options.map(option => {
                                  const count = contacts.filter(c => (c as any)[field.value] === option).length
                                  const isSelected = selectedFilters[field.value]?.includes(option) || false
                                  return (
                                    <div key={option} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${field.value}-${option}`}
                                        checked={isSelected}
                                        onCheckedChange={(checked) =>
                                          handleFilterChange(field.value, option, checked as boolean)
                                        }
                                      />
                                      <Label
                                        htmlFor={`${field.value}-${option}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {option} ({count})
                                      </Label>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Right Column - Empty for now */}
                <div></div>
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

                {/* Estimated Equity Slider */}
                {maxEquity > minEquity && (
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
                      min={minEquity}
                      max={maxEquity}
                      step={1000}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Clear All Button */}
              {(hasActiveFilters || yearBuiltRange[0] !== minYearBuilt || yearBuiltRange[1] !== maxYearBuilt || equityRange[0] !== minEquity || equityRange[1] !== maxEquity) && (
                <div className="mt-6 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFilters({})
                      setYearBuiltRange([minYearBuilt, maxYearBuilt])
                      setEquityRange([minEquity, maxEquity])
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact List */}
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
      </CardContent>
    </Card>
  )
}
