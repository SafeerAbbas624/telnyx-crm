"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Phone, Mail, MapPin, Loader2 } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { formatPhoneNumberForDisplay } from "@/lib/utils"
import type { Contact } from "@/lib/types"

interface OptimizedContactsListProps {
  onContactSelect?: (contact: Contact) => void
  onEditContact?: (contact: Contact) => void
  onDeleteContact?: (contactId: string) => void
  selectedContacts?: string[]
  onContactSelectionChange?: (contactId: string, selected: boolean) => void
  showSelection?: boolean
}

interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasMore: boolean
}

export default function OptimizedContactsList({
  onContactSelect,
  onEditContact,
  onDeleteContact,
  selectedContacts = [],
  onContactSelectionChange,
  showSelection = false
}: OptimizedContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dealStatusFilter, setDealStatusFilter] = useState('')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const loadContacts = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20', // Smaller page size for better performance
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(dealStatusFilter && { dealStatus: dealStatusFilter }),
        ...(propertyTypeFilter && { propertyType: propertyTypeFilter }),
        ...(cityFilter && { city: cityFilter }),
        ...(stateFilter && { state: stateFilter }),
      })

      const response = await fetch(`/api/contacts?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      
      if (append && page > 1) {
        setContacts(prev => [...prev, ...(data.contacts || [])])
      } else {
        setContacts(data.contacts || [])
      }
      
      setPagination(data.pagination)
    } catch (err) {
      console.error('Error loading contacts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, dealStatusFilter, propertyTypeFilter, cityFilter, stateFilter])

  // Load contacts when filters change
  useEffect(() => {
    loadContacts(1, false)
  }, [loadContacts])

  const loadMore = () => {
    if (pagination && pagination.hasMore && !loadingMore) {
      loadContacts(pagination.page + 1, true)
    }
  }

  const handleContactClick = (contact: Contact) => {
    onContactSelect?.(contact)
  }

  const handleSelectionChange = (contactId: string, selected: boolean) => {
    onContactSelectionChange?.(contactId, selected)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setDealStatusFilter('')
    setPropertyTypeFilter('')
    setCityFilter('')
    setStateFilter('')
  }

  if (loading && contacts.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => loadContacts(1, false)} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={dealStatusFilter} onValueChange={setDealStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Deal Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="credit_run">Credit Run</SelectItem>
              <SelectItem value="document_collection">Document Collection</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="underwriting">Underwriting</SelectItem>
              <SelectItem value="appraisal_fee">Appraisal Fee</SelectItem>
              <SelectItem value="closing">Closing</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Property Type"
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter(e.target.value)}
          />

          <Input
            placeholder="City"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />

          <Input
            placeholder="State"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          />
        </div>

        {(searchQuery || dealStatusFilter || propertyTypeFilter || cityFilter || stateFilter) && (
          <Button onClick={clearFilters} variant="outline" size="sm">
            Clear Filters
          </Button>
        )}
      </div>

      {/* Results Summary */}
      {pagination && (
        <div className="text-sm text-gray-600">
          Showing {contacts.length} of {pagination.totalCount} contacts
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-2">
        {contacts.map((contact) => (
          <Card 
            key={contact.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleContactClick(contact)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {contact.firstName?.[0]}{contact.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold truncate">
                      {contact.firstName} {contact.lastName}
                    </h3>
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex gap-1">
                        {contact.tags.slice(0, 2).map((tag: any) => (
                          <Badge key={tag.id} variant="secondary" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                        {contact.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{contact.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    {contact.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhoneNumberForDisplay(contact.phone)}
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.propertyAddress && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{contact.propertyAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Load More Button */}
      {pagination && pagination.hasMore && (
        <div className="text-center py-4">
          <Button 
            onClick={loadMore} 
            disabled={loadingMore}
            variant="outline"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}

      {contacts.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No contacts found. Try adjusting your search or filters.
        </div>
      )}
    </div>
  )
}
