"use client"

import { useState, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import { Search, Filter, X, Check, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"
import { useToast } from "@/hooks/use-toast"
import type { Contact } from "@/lib/types"

interface SimpleContactFilterProps {
  selectedContacts: Contact[]
  onSelectedContactsChange: (contacts: Contact[]) => void
}

export default function SimpleContactFilter({
  selectedContacts,
  onSelectedContactsChange,
}: SimpleContactFilterProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<{[key: string]: string[]}>({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const { toast } = useToast()
  const { filterOptions, searchContacts, contacts, pagination, fetchContacts } = useContacts()

  // Debounce search to prevent too many requests
  const debouncedSearchQuery = useDebounce(searchQuery, 800)

  // Get dynamic filter options from database
  const getDynamicFilterOptions = () => {
    if (!filterOptions) return []
    
    return [
      {
        category: "Location",
        fields: [
          { value: "city", label: "City", options: filterOptions.cities || [] },
          { value: "state", label: "State", options: filterOptions.states || [] },
          { value: "propertyCounty", label: "County", options: filterOptions.counties || [] },
        ]
      },
      {
        category: "Property Type",
        fields: [
          { value: "propertyType", label: "Property Type", options: filterOptions.propertyTypes || [] },
        ]
      },
      {
        category: "Deal Status",
        fields: [
          { value: "dealStatus", label: "Deal Status", options: filterOptions.dealStatuses || [] },
        ]
      },
      {
        category: "Tags",
        fields: [
          { value: "tags", label: "Tags", options: filterOptions.tags?.map((tag: any) => tag.name) || [] },
        ]
      }
    ]
  }

  // Handle search input change (just update state, debounced effect will handle search)
  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  // Effect to handle debounced search
  useEffect(() => {
    const filters = Object.entries(selectedFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) {
        acc[key] = values.join(',')
      }
      return acc
    }, {} as any)

    searchContacts(debouncedSearchQuery, filters)
  }, [debouncedSearchQuery, selectedFilters]) // Removed searchContacts from dependencies

  // Handle filter changes (effect will handle the search)
  const handleFilterChange = (field: string, value: string, checked: boolean) => {
    const newFilters = { ...selectedFilters }
    const currentValues = newFilters[field] || []

    if (checked) {
      newFilters[field] = [...currentValues, value]
    } else {
      newFilters[field] = currentValues.filter(v => v !== value)
    }

    setSelectedFilters(newFilters)
    // The useEffect will handle the search automatically
  }

  const hasActiveFilters = Object.values(selectedFilters).some(values => values.length > 0)
  const activeFilterCount = Object.values(selectedFilters).reduce((count, values) => count + values.length, 0)

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedFilters({})
    // The useEffect will handle the search automatically
  }

  const handleSelectAll = () => {
    onSelectedContactsChange(contacts)
    toast({
      title: "Current page selected",
      description: `Selected ${contacts.length} contacts from current page`,
    })
  }

  const handleSelectAllPages = async () => {
    try {
      // Fetch all contacts with current filters
      const filters = Object.entries(selectedFilters).reduce((acc, [key, values]) => {
        if (values.length > 0) {
          acc[key] = values.join(',')
        }
        return acc
      }, {} as any)

      const response = await fetch(`/api/contacts/search?query=${encodeURIComponent(searchQuery)}&page=1&limit=10000&${new URLSearchParams(filters)}`)
      const data = await response.json()

      if (data.success && data.contacts) {
        onSelectedContactsChange(data.contacts)
        toast({
          title: "All contacts selected",
          description: `Selected ${data.contacts.length} contacts from all pages`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select all contacts",
        variant: "destructive",
      })
    }
  }

  const handleDeselectAll = () => {
    onSelectedContactsChange([])
    toast({
      title: "All contacts deselected",
      description: "No contacts selected",
    })
  }

  const handleNextPage = () => {
    if (pagination && pagination.currentPage < pagination.totalPages) {
      const filters = Object.entries(selectedFilters).reduce((acc, [key, values]) => {
        if (values.length > 0) {
          acc[key] = values.join(',')
        }
        return acc
      }, {} as any)

      fetchContacts(pagination.currentPage + 1, 50, searchQuery, filters)
    }
  }

  const handlePrevPage = () => {
    if (pagination && pagination.currentPage > 1) {
      const filters = Object.entries(selectedFilters).reduce((acc, [key, values]) => {
        if (values.length > 0) {
          acc[key] = values.join(',')
        }
        return acc
      }, {} as any)

      fetchContacts(pagination.currentPage - 1, 50, searchQuery, filters)
    }
  }

  const toggleContactSelection = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.id === contact.id)
    if (isSelected) {
      onSelectedContactsChange(selectedContacts.filter(c => c.id !== contact.id))
    } else {
      onSelectedContactsChange([...selectedContacts, contact])
    }
  }

  if (!filterOptions) {
    return <div>Loading filter options...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contact Selection
          <Badge variant="secondary" className="ml-auto">
            {selectedContacts.length} of {pagination?.totalCount || contacts.length} selected
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
            onChange={(e) => handleSearch(e.target.value)}
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
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <Check className="h-4 w-4 mr-2" />
            Select Page
          </Button>
          <Button variant="outline" size="sm" onClick={handleSelectAllPages}>
            <Check className="h-4 w-4 mr-2" />
            Select All Pages
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
              {/* Filter Grid */}
              <div className="grid grid-cols-2 gap-8">
                {getDynamicFilterOptions().map(category => {
                  const hasOptions = category.fields.some(field => field.options.length > 0)
                  if (!hasOptions) return null

                  return (
                    <div key={category.category} className="space-y-4">
                      <h4 className="font-semibold text-lg text-gray-900">{category.category}</h4>
                      
                      {category.fields.map(field => {
                        if (field.options.length === 0) return null

                        return (
                          <div key={field.value} className="space-y-2">
                            <h5 className="font-medium text-sm text-gray-700">{field.label}</h5>
                            <div className="h-48 overflow-y-auto border rounded-md p-2">
                              <div className="grid grid-cols-1 gap-2">
                                {field.options.slice(0, 50).map(option => {
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
                                        {option}
                                      </Label>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact List */}
        <div className="h-96 overflow-y-auto border rounded-md">
          <div className="space-y-2 p-2">
            {contacts.map(contact => {
              const isSelected = selectedContacts.some(c => c.id === contact.id)
              const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.llcName || 'Unknown'

              return (
                <div
                  key={contact.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                  }`}
                  onClick={() => toggleContactSelection(contact)}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => {}} // Handled by onClick above
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {contact.phone1} • {contact.propertyAddress}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-500">
              Showing {((pagination.currentPage - 1) * 50) + 1} to {Math.min(pagination.currentPage * 50, pagination.totalCount)} of {pagination.totalCount} contacts
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={pagination.currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={pagination.currentPage >= pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
