"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Filter, X, RefreshCw } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"

interface ContactsAdvancedFilterProps {
  onFiltersChange?: (filters: any) => void
}

export default function ContactsAdvancedFilter({ onFiltersChange }: ContactsAdvancedFilterProps) {
  // Separate pending and applied filter states
  const [pendingFilters, setPendingFilters] = useState<{[key: string]: string[]}>({})
  const [appliedFilters, setAppliedFilters] = useState<{[key: string]: string[]}>({})

  // Search within filter options
  const [filterSearchQuery, setFilterSearchQuery] = useState<string>("")

  const { filterOptions, searchContacts, refreshFilterOptions } = useContacts()
  const { toast } = useToast()

  // Check if there are active filters (applied)
  const hasActiveFilters = Object.values(appliedFilters).some(values => values.length > 0)

  // Check if there are pending changes
  const hasPendingChanges = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters)

  // Count active filters for badge
  const activeFilterCount = Object.values(appliedFilters).reduce((count, values) => count + values.length, 0)

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

  // Apply filters - triggers database search
  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)

    // Build and execute search
    const filters = Object.entries(pendingFilters).reduce((acc, [key, values]) => {
      if (values.length > 0) {
        acc[key] = values.join(',')
      }
      return acc
    }, {} as any)

    searchContacts("", filters)

    // Notify parent component
    if (onFiltersChange) {
      onFiltersChange(filters)
    }

    toast({
      title: "Filters Applied",
      description: `${Object.keys(filters).length} filter(s) active`,
    })
  }

  // Reset all filters
  const handleResetFilters = () => {
    setPendingFilters({})
    setAppliedFilters({})
    searchContacts("", {})

    if (onFiltersChange) {
      onFiltersChange({})
    }

    toast({
      title: "Filters Reset",
      description: "All filters have been cleared",
    })
  }

  // Remove individual filter chip
  const handleRemoveFilter = (field: string, value: string) => {
    const newFilters = { ...appliedFilters }
    newFilters[field] = (newFilters[field] || []).filter(v => v !== value)
    if (newFilters[field].length === 0) {
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

    searchContacts("", filters)

    if (onFiltersChange) {
      onFiltersChange(filters)
    }
  }

  console.log('🔍 ContactsAdvancedFilter - filterOptions:', filterOptions)

  if (!filterOptions) {
    return <div>Loading filter options...</div>
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Advanced Filters
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-auto text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-3">
        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex gap-1.5 flex-wrap items-center">
            {Object.entries(appliedFilters).map(([field, values]) =>
              values.map((value) => (
                <Badge key={`${field}-${value}`} variant="secondary" className="gap-1 text-xs py-0.5 px-2">
                  {field}: {value}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveFilter(field, value)}
                  />
                </Badge>
              ))
            )}
          </div>
        )}

        {/* Collapsible Filter Sections with Accordion */}
        <Accordion type="multiple" defaultValue={["location", "property", "deal", "tags"]} className="w-full">
          {getDynamicFilterOptions().map(category => {
            const hasOptions = category.fields.some(field => field.options.length > 0)
            if (!hasOptions) return null

            // Count active filters in this category
            const categoryFilterCount = category.fields.reduce((count, field) => {
              return count + (pendingFilters[field.value]?.length || 0)
            }, 0)

            // Get emoji for category
            const categoryEmoji = category.category === "Location" ? "📍" :
                                 category.category === "Property Type" ? "🏠" :
                                 category.category === "Deal Status" ? "📊" :
                                 category.category === "Tags" ? "🏷️" : "📁"

            return (
              <AccordionItem key={category.category} value={category.category.toLowerCase().replace(/\s+/g, '-')} className="border-b">
                <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span>{categoryEmoji}</span>
                    <span>{category.category}</span>
                    {categoryFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {categoryFilterCount}
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className={`grid ${category.fields.length > 1 ? 'grid-cols-3' : 'grid-cols-1'} gap-4 pt-2`}>
                    {category.fields.map(field => {
                      if (field.options.length === 0) return null

                      return (
                        <div key={field.value} className="space-y-1.5">
                          <h5 className="font-medium text-xs text-gray-600">{field.label}</h5>
                          <Input
                            placeholder={`Search...`}
                            value={filterSearchQuery}
                            onChange={(e) => setFilterSearchQuery(e.target.value)}
                            className="h-7 text-xs"
                          />
                          <ScrollArea className="h-32 pr-2">
                            <div className="space-y-1">
                              {field.options
                                .filter(option => option.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                                .slice(0, 100).map(option => {
                                const isSelected = pendingFilters[field.value]?.includes(option) || false
                                return (
                                  <div key={option} className="flex items-center space-x-1.5 py-0.5">
                                    <Checkbox
                                      id={`${field.value}-${option}`}
                                      checked={isSelected}
                                      onCheckedChange={(checked) =>
                                        handleFilterChange(field.value, option, checked as boolean)
                                      }
                                      className="h-3.5 w-3.5"
                                    />
                                    <Label
                                      htmlFor={`${field.value}-${option}`}
                                      className="text-xs cursor-pointer flex-1 truncate"
                                      title={option}
                                    >
                                      {option}
                                    </Label>
                                  </div>
                                )
                              })}
                              {field.options.filter(option => option.toLowerCase().includes(filterSearchQuery.toLowerCase())).length > 100 && (
                                <div className="text-xs text-gray-500 mt-2">
                                  Showing first 100 of {field.options.filter(option => option.toLowerCase().includes(filterSearchQuery.toLowerCase())).length} options
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        {/* Apply and Reset Buttons */}
        <div className="flex justify-between items-center gap-2 pt-2 border-t">
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
            className="h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Refresh
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters && !hasPendingChanges}
              className="h-8 text-xs"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleApplyFilters}
              disabled={!hasPendingChanges}
              className="h-8 text-xs"
            >
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
