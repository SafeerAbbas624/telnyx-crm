"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Search, X, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Contact } from "@/lib/types"

interface FilterCriteria {
  field: string
  operator: string
  value: string
}

interface ContactFiltersSimpleProps {
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
      ] },
    ]
  },
  {
    category: "Property Details",
    fields: [
      { value: "bedrooms", label: "Bedrooms", type: "range", min: 0, max: 10 },
      { value: "totalBathrooms", label: "Bathrooms", type: "range", min: 0, max: 10 },
      { value: "buildingSqft", label: "Square Feet", type: "range", min: 0, max: 10000 },
      { value: "effectiveYearBuilt", label: "Year Built", type: "range", min: 1800, max: 2024 },
    ]
  },
  {
    category: "Financial",
    fields: [
      { value: "estValue", label: "Estimated Value", type: "range", min: 0, max: 2000000 },
      { value: "estEquity", label: "Estimated Equity", type: "range", min: 0, max: 1000000 },
    ]
  },
  {
    category: "Contact Info",
    fields: [
      { value: "dnc", label: "Do Not Call", type: "boolean" },
    ]
  }
]

const ContactFiltersSimple: React.FC<ContactFiltersSimpleProps> = ({
  contacts,
  onFilteredContactsChange,
  selectedContacts,
  onSelectedContactsChange,
}) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filters, setFilters] = useState<FilterCriteria[]>([])
  const { toast } = useToast()

  // Generate dynamic options for select fields
  const filterOptionsWithData = useMemo(() => {
    return FILTER_OPTIONS.map(category => ({
      ...category,
      fields: category.fields.map(field => {
        if (field.type === "select" && field.options.length === 0) {
          const uniqueValues = [...new Set(
            contacts
              .map(contact => (contact as any)[field.value])
              .filter(Boolean)
              .map(val => String(val))
          )].sort()
          return { ...field, options: uniqueValues }
        }
        return field
      })
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

  // Apply filters
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Search filter
      if (!matchesSearch(contact, searchTerm)) return false

      // Advanced filters
      return filters.every(filter => {
        const contactValue = (contact as any)[filter.field]
        const filterValue = filter.value

        if (!contactValue && filterValue) return false

        switch (filter.operator) {
          case "equals":
            return String(contactValue).toLowerCase() === filterValue.toLowerCase()
          case "contains":
            return String(contactValue).toLowerCase().includes(filterValue.toLowerCase())
          case "greater_than":
            return Number(contactValue) > Number(filterValue)
          case "less_than":
            return Number(contactValue) < Number(filterValue)
          case "between":
            const [min, max] = filterValue.split(",").map(Number)
            return Number(contactValue) >= min && Number(contactValue) <= max
          case "is_true":
            return Boolean(contactValue) === true
          case "is_false":
            return Boolean(contactValue) === false
          default:
            return true
        }
      })
    })
  }, [contacts, searchTerm, filters])

  // Update filtered contacts when they change
  useEffect(() => {
    onFilteredContactsChange(filteredContacts)
  }, [filteredContacts, onFilteredContactsChange])

  const addFilter = () => {
    setFilters([...filters, { field: "", operator: "equals", value: "" }])
  }

  const updateFilter = (index: number, updates: Partial<FilterCriteria>) => {
    const newFilters = [...filters]
    newFilters[index] = { ...newFilters[index], ...updates }
    setFilters(newFilters)
  }

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index))
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setFilters([])
    onSelectedContactsChange([])
  }

  const selectAll = () => {
    onSelectedContactsChange(filteredContacts)
    toast({
      title: "All contacts selected",
      description: `Selected ${filteredContacts.length} contacts`,
    })
  }

  const deselectAll = () => {
    onSelectedContactsChange([])
    toast({
      title: "All contacts deselected",
      description: "No contacts selected",
    })
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Search Bar */}
        <div className="relative mb-4">
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

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2"
          >
            <Filter size={16} />
            Advanced Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={filteredContacts.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={selectedContacts.length === 0}
          >
            Deselect All
          </Button>
          {(searchTerm || filters.length > 0 || selectedContacts.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-red-600 hover:text-red-700"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Selection Summary */}
        {selectedContacts.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Advanced Filters</h3>
              <Button variant="outline" size="sm" onClick={addFilter}>
                Add Filter
              </Button>
            </div>

            {filters.map((filter, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label className="text-xs">Field</Label>
                  <Select
                    value={filter.field}
                    onValueChange={(value) => updateFilter(index, { field: value })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptionsWithData.map(category => (
                        <div key={category.category}>
                          <div className="px-2 py-1 text-xs font-medium text-gray-500">
                            {category.category}
                          </div>
                          {category.fields.map(field => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-3">
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={filter.operator}
                    onValueChange={(value) => updateFilter(index, { operator: value })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="greater_than">Greater than</SelectItem>
                      <SelectItem value="less_than">Less than</SelectItem>
                      <SelectItem value="between">Between</SelectItem>
                      <SelectItem value="is_true">Is true</SelectItem>
                      <SelectItem value="is_false">Is false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-4">
                  <Label className="text-xs">Value</Label>
                  <Input
                    value={filter.value}
                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                    placeholder="Enter value"
                    className="h-8"
                  />
                </div>

                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(index)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>
            ))}

            {filters.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No filters added. Click "Add Filter" to start filtering contacts.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ContactFiltersSimple
