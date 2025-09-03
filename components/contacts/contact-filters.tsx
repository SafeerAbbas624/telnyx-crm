"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react"
import { useState } from "react"

interface ContactFiltersProps {
  filters?: {
    // Personal Info
    firstName?: string
    lastName?: string
    llcName?: string

    // Contact Info
    phone1?: string
    phone2?: string
    phone3?: string
    email1?: string
    email2?: string
    email3?: string

    // Property Info
    propertyAddress?: string
    city?: string
    state?: string
    propertyCounty?: string
    propertyTypes?: string[]

    // Property Details
    minBedrooms?: number
    maxBedrooms?: number
    minBathrooms?: number
    maxBathrooms?: number
    minSqft?: number
    maxSqft?: number
    minYearBuilt?: number
    maxYearBuilt?: number

    // Financial
    minValue?: number
    maxValue?: number
    minEquity?: number
    maxEquity?: number
    minDebtOwed?: number
    maxDebtOwed?: number

    // Status
    dealStatus?: string[]
    dnc?: boolean | null
    dncReason?: string

    // Dates
    createdAfter?: string
    createdBefore?: string
    updatedAfter?: string
    updatedBefore?: string
  }
  onFiltersChange?: (filters: any) => void
}

export default function ContactFilters({ filters = {}, onFiltersChange }: ContactFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const propertyTypes = [
    { id: "Single Family", label: "Single Family" },
    { id: "Duplex", label: "Duplex" },
    { id: "Triplex", label: "Triplex" },
    { id: "Quadplex", label: "Quadplex" },
    { id: "Multi-Family", label: "Multi-Family (5+ units)" },
    { id: "Condo", label: "Condo" },
    { id: "Townhouse", label: "Townhouse" },
    { id: "Commercial", label: "Commercial" },
    { id: "Land", label: "Land" },
    { id: "Other", label: "Other" },
  ]

  const dealStatuses = [
    { id: "lead", label: "Lead" },
    { id: "qualified", label: "Qualified" },
    { id: "proposal", label: "Proposal" },
    { id: "negotiation", label: "Negotiation" },
    { id: "closed_won", label: "Closed Won" },
    { id: "closed_lost", label: "Closed Lost" },
  ]

  const states = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ]

  const handleFilterChange = (field: string, value: any) => {
    if (onFiltersChange) {
      onFiltersChange({
        ...filters,
        [field]: value === "" ? undefined : value,
      })
    }
  }

  const handleNumberChange = (field: string, value: string) => {
    const numValue = value === "" ? undefined : Number.parseInt(value.replace(/,/g, ""))
    handleFilterChange(field, numValue)
  }

  const handleArrayChange = (field: string, itemId: string) => {
    const currentArray = (filters as any)[field] || []
    const newArray = currentArray.includes(itemId)
      ? currentArray.filter((id: string) => id !== itemId)
      : [...currentArray, itemId]

    handleFilterChange(field, newArray)
  }

  const handleBooleanChange = (field: string, value: boolean | null) => {
    handleFilterChange(field, value)
  }

  const clearAllFilters = () => {
    if (onFiltersChange) {
      onFiltersChange({})
    }
  }

  const clearFilter = (field: string) => {
    if (onFiltersChange) {
      const newFilters = { ...filters }
      delete newFilters[field as keyof typeof filters]
      onFiltersChange(newFilters)
    }
  }

  // Check if any filters are active
  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = (filters as any)[key]
    return value !== undefined && value !== null && value !== "" &&
           (Array.isArray(value) ? value.length > 0 : true)
  })

  const getActiveFilterCount = () => {
    return Object.keys(filters).filter(key => {
      const value = (filters as any)[key]
      return value !== undefined && value !== null && value !== "" &&
             (Array.isArray(value) ? value.length > 0 : true)
    }).length
  }

  const FilterSection = ({ title, children, sectionKey }: { title: string, children: React.ReactNode, sectionKey: string }) => (
    <div className="border-b border-gray-100 last:border-b-0">
      <Button
        variant="ghost"
        onClick={() => setActiveSection(activeSection === sectionKey ? null : sectionKey)}
        className="flex items-center justify-between w-full p-3 h-auto font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
      >
        <span className="text-sm">{title}</span>
        {activeSection === sectionKey ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Button>
      {activeSection === sectionKey && (
        <div className="px-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  )

  return (
    <div className="border-b border-gray-200">
      {/* Filter Header - Always Visible */}
      <div className="px-6 py-3 bg-gray-50">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full p-0 h-auto font-medium text-gray-700 hover:text-gray-900"
        >
          <div className="flex items-center gap-2">
            <Filter size={16} />
            <span>Advanced Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {getActiveFilterCount()} Active
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {/* Collapsible Filter Content */}
      {isExpanded && (
        <div className="bg-white max-h-96 overflow-y-auto">
          {/* Personal Information */}
          <FilterSection title="Personal Information" sectionKey="personal">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">First Name</Label>
                <Input
                  placeholder="John"
                  value={filters.firstName || ""}
                  onChange={(e) => handleFilterChange("firstName", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={filters.lastName || ""}
                  onChange={(e) => handleFilterChange("lastName", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">LLC Name</Label>
              <Input
                placeholder="Company LLC"
                value={filters.llcName || ""}
                onChange={(e) => handleFilterChange("llcName", e.target.value)}
                className="text-sm"
              />
            </div>
          </FilterSection>

          {/* Contact Information */}
          <FilterSection title="Contact Information" sectionKey="contact">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Phone 1</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={filters.phone1 || ""}
                  onChange={(e) => handleFilterChange("phone1", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Phone 2</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={filters.phone2 || ""}
                  onChange={(e) => handleFilterChange("phone2", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Email 1</Label>
                <Input
                  placeholder="john@example.com"
                  value={filters.email1 || ""}
                  onChange={(e) => handleFilterChange("email1", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Email 2</Label>
                <Input
                  placeholder="john.doe@company.com"
                  value={filters.email2 || ""}
                  onChange={(e) => handleFilterChange("email2", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </FilterSection>

          {/* Property Location */}
          <FilterSection title="Property Location" sectionKey="location">
            <div>
              <Label className="text-xs text-gray-600">Property Address</Label>
              <Input
                placeholder="123 Main St"
                value={filters.propertyAddress || ""}
                onChange={(e) => handleFilterChange("propertyAddress", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-600">City</Label>
                <Input
                  placeholder="New York"
                  value={filters.city || ""}
                  onChange={(e) => handleFilterChange("city", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">State</Label>
                <Select value={filters.state || ""} onValueChange={(value) => handleFilterChange("state", value)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">County</Label>
                <Input
                  placeholder="County"
                  value={filters.propertyCounty || ""}
                  onChange={(e) => handleFilterChange("propertyCounty", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </FilterSection>

          {/* Property Details */}
          <FilterSection title="Property Details" sectionKey="property">
            <div>
              <Label className="text-xs text-gray-600 mb-2 block">Property Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {propertyTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type.id}`}
                      checked={(filters.propertyTypes || []).includes(type.id)}
                      onCheckedChange={() => handleArrayChange("propertyTypes", type.id)}
                    />
                    <Label htmlFor={`type-${type.id}`} className="text-xs cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Bedrooms</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={filters.minBedrooms || ""}
                  onChange={(e) => handleNumberChange("minBedrooms", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Bedrooms</Label>
                <Input
                  type="number"
                  placeholder="5"
                  value={filters.maxBedrooms || ""}
                  onChange={(e) => handleNumberChange("maxBedrooms", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Bathrooms</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="1"
                  value={filters.minBathrooms || ""}
                  onChange={(e) => handleNumberChange("minBathrooms", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Bathrooms</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="4"
                  value={filters.maxBathrooms || ""}
                  onChange={(e) => handleNumberChange("maxBathrooms", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Sq Ft</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={filters.minSqft || ""}
                  onChange={(e) => handleNumberChange("minSqft", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Sq Ft</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={filters.maxSqft || ""}
                  onChange={(e) => handleNumberChange("maxSqft", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Year Built</Label>
                <Input
                  type="number"
                  placeholder="1950"
                  value={filters.minYearBuilt || ""}
                  onChange={(e) => handleNumberChange("minYearBuilt", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Year Built</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={filters.maxYearBuilt || ""}
                  onChange={(e) => handleNumberChange("maxYearBuilt", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </FilterSection>

          {/* Financial Information */}
          <FilterSection title="Financial Information" sectionKey="financial">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Property Value</Label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={filters.minValue || ""}
                  onChange={(e) => handleNumberChange("minValue", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Property Value</Label>
                <Input
                  type="number"
                  placeholder="1000000"
                  value={filters.maxValue || ""}
                  onChange={(e) => handleNumberChange("maxValue", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Equity</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={filters.minEquity || ""}
                  onChange={(e) => handleNumberChange("minEquity", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Equity</Label>
                <Input
                  type="number"
                  placeholder="500000"
                  value={filters.maxEquity || ""}
                  onChange={(e) => handleNumberChange("maxEquity", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Debt Owed</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minDebtOwed || ""}
                  onChange={(e) => handleNumberChange("minDebtOwed", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Debt Owed</Label>
                <Input
                  type="number"
                  placeholder="200000"
                  value={filters.maxDebtOwed || ""}
                  onChange={(e) => handleNumberChange("maxDebtOwed", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </FilterSection>

          {/* Status & Preferences */}
          <FilterSection title="Status & Preferences" sectionKey="status">
            <div>
              <Label className="text-xs text-gray-600 mb-2 block">Deal Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {dealStatuses.map((status) => (
                  <div key={status.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.id}`}
                      checked={(filters.dealStatus || []).includes(status.id)}
                      onCheckedChange={() => handleArrayChange("dealStatus", status.id)}
                    />
                    <Label htmlFor={`status-${status.id}`} className="text-xs cursor-pointer">
                      {status.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-2 block">Do Not Call (DNC)</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dnc-yes"
                    checked={filters.dnc === true}
                    onCheckedChange={(checked) => handleBooleanChange("dnc", checked ? true : null)}
                  />
                  <Label htmlFor="dnc-yes" className="text-xs cursor-pointer">DNC Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dnc-no"
                    checked={filters.dnc === false}
                    onCheckedChange={(checked) => handleBooleanChange("dnc", checked ? false : null)}
                  />
                  <Label htmlFor="dnc-no" className="text-xs cursor-pointer">Non-DNC Only</Label>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">DNC Reason</Label>
              <Input
                placeholder="Reason for DNC"
                value={filters.dncReason || ""}
                onChange={(e) => handleFilterChange("dncReason", e.target.value)}
                className="text-sm"
              />
            </div>
          </FilterSection>

          {/* Date Filters */}
          <FilterSection title="Date Filters" sectionKey="dates">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Created After</Label>
                <Input
                  type="date"
                  value={filters.createdAfter || ""}
                  onChange={(e) => handleFilterChange("createdAfter", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Created Before</Label>
                <Input
                  type="date"
                  value={filters.createdBefore || ""}
                  onChange={(e) => handleFilterChange("createdBefore", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Updated After</Label>
                <Input
                  type="date"
                  value={filters.updatedAfter || ""}
                  onChange={(e) => handleFilterChange("updatedAfter", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Updated Before</Label>
                <Input
                  type="date"
                  value={filters.updatedBefore || ""}
                  onChange={(e) => handleFilterChange("updatedBefore", e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </FilterSection>

          {/* Filter Actions */}
          <div className="p-3 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-xs text-gray-600">
              {hasActiveFilters ? `${getActiveFilterCount()} filter(s) active` : "No filters applied"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="text-xs"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
