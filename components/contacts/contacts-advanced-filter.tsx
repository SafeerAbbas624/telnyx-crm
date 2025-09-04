"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Filter, X } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"

interface ContactsAdvancedFilterProps {
  onFiltersChange?: (filters: any) => void
}

export default function ContactsAdvancedFilter({ onFiltersChange }: ContactsAdvancedFilterProps) {
  const [selectedFilters, setSelectedFilters] = useState<{[key: string]: string[]}>({})
  const { filterOptions, searchContacts } = useContacts()

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
    
    // Trigger database search with filters
    searchContacts("", filters)
    
    // Notify parent component
    if (onFiltersChange) {
      onFiltersChange(filters)
    }
  }

  const clearAllFilters = () => {
    setSelectedFilters({})
    searchContacts("", {})
    if (onFiltersChange) {
      onFiltersChange({})
    }
  }

  const hasActiveFilters = Object.values(selectedFilters).some(values => values.length > 0)
  const activeFilterCount = Object.values(selectedFilters).reduce((count, values) => count + values.length, 0)

  console.log('🔍 ContactsAdvancedFilter - filterOptions:', filterOptions)

  if (!filterOptions) {
    return <div>Loading filter options...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Advanced Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {activeFilterCount} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          </div>
        )}

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
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                        {field.options.slice(0, 20).map(option => { // Limit to first 20 options for performance
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
                                className="text-sm cursor-pointer flex-1 truncate"
                                title={option}
                              >
                                {option}
                              </Label>
                            </div>
                          )
                        })}
                        {field.options.length > 20 && (
                          <div className="text-xs text-gray-500 mt-2">
                            Showing first 20 of {field.options.length} options
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="pt-4 border-t">
            <h5 className="font-medium text-sm text-gray-700 mb-2">Active Filters:</h5>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedFilters).map(([field, values]) =>
                values.map(value => (
                  <Badge key={`${field}-${value}`} variant="secondary" className="text-xs">
                    {field}: {value}
                    <button
                      onClick={() => handleFilterChange(field, value, false)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
