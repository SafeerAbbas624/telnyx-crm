"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Phone, Mail, MapPin, Loader2, Filter, X } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { formatPhoneNumberForDisplay } from "@/lib/utils"
import type { Contact } from "@/lib/types"

interface VirtualContactsListProps {
  onContactSelect?: (contact: Contact) => void
  onEditContact?: (contact: Contact) => void
  onDeleteContact?: (contactId: string) => void
  selectedContacts?: string[]
  onContactSelectionChange?: (contactId: string, selected: boolean) => void
  showSelection?: boolean
  height?: number
}

interface ContactItemProps {
  index: number
  style: any
  data: {
    contacts: Contact[]
    onContactSelect?: (contact: Contact) => void
    selectedContacts: string[]
    onContactSelectionChange?: (contactId: string, selected: boolean) => void
    showSelection: boolean
  }
}

const ContactItem = ({ index, style, data }: ContactItemProps) => {
  const { contacts, onContactSelect, selectedContacts, onContactSelectionChange, showSelection } = data
  const contact = contacts[index]

  if (!contact) {
    return (
      <div style={style} className="p-2">
        <Card>
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
      </div>
    )
  }

  const handleContactClick = () => {
    onContactSelect?.(contact)
  }

  const isSelected = selectedContacts.includes(contact.id)

  return (
    <div style={style} className="p-1">
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={handleContactClick}
      >
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            {showSelection && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation()
                  onContactSelectionChange?.(contact.id, e.target.checked)
                }}
                className="rounded"
              />
            )}

            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm">
                {contact.firstName?.[0]}{contact.lastName?.[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate text-sm">
                  {contact.firstName} {contact.lastName}
                </h3>
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex gap-1">
                    {contact.tags.slice(0, 1).map((tag: any) => (
                      <Badge key={tag.id} variant="secondary" className="text-xs">
                        {tag.name}
                      </Badge>
                    ))}
                    {contact.tags.length > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        +{contact.tags.length - 1}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                {contact.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhoneNumberForDisplay(contact.phone)}
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{contact.email}</span>
                  </div>
                )}
                {contact.propertyAddress && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">{contact.propertyAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VirtualContactsList({
  onContactSelect,
  onEditContact,
  onDeleteContact,
  selectedContacts = [],
  onContactSelectionChange,
  showSelection = false,
  height = 600
}: VirtualContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dealStatusFilter, setDealStatusFilter] = useState('')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [minValueFilter, setMinValueFilter] = useState('')
  const [maxValueFilter, setMaxValueFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [pagination, setPagination] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const listRef = useRef<any>(null)
  const debouncedSearch = useDebounce(searchQuery, 150)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const lastRemoteContactsRef = useRef<Contact[]>([])
  const cacheRef = useRef<Map<string, any>>(new Map())
  const [isSearching, setIsSearching] = useState(false)

  const loadContacts = useCallback(async (page = 1, append = false) => {
    try {
      setIsSearching(true)
      if (page === 1) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50', // Larger page size for virtual scrolling
        useElasticsearch: 'true', // Always use Elasticsearch for 500K dataset
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(dealStatusFilter && { dealStatus: dealStatusFilter }),
        ...(propertyTypeFilter && { propertyType: propertyTypeFilter }),
        ...(cityFilter && { city: cityFilter }),
        ...(stateFilter && { state: stateFilter }),
        ...(minValueFilter && { minValue: minValueFilter }),
        ...(maxValueFilter && { maxValueFilter: maxValueFilter }),
      })

      const cacheKey = params.toString()
      const cached = cacheRef.current.get(cacheKey)
      if (cached && page === 1 && !append) {
        setContacts(cached.contacts || [])
        setPagination(cached.pagination)
        setHasMore(cached.pagination?.hasMore || false)
      }

      // Abort any in-flight request before starting a new one
      if (fetchAbortRef.current) {
        try { fetchAbortRef.current.abort() } catch {}
      }
      const controller = new AbortController()
      fetchAbortRef.current = controller

      const response = await fetch(`/api/contacts?${params}`,{ signal: controller.signal })
      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      // Ignore if this request was aborted in the meantime
      if (controller.signal.aborted) return

      lastRemoteContactsRef.current = data.contacts || []

      if (append && page > 1) {
        setContacts(prev => [...prev, ...(data.contacts || [])])
      } else {
        setContacts(data.contacts || [])
        setCurrentPage(1)
      }

      setPagination(data.pagination)
      setHasMore(data.pagination?.hasMore || false)
      setCurrentPage(page)

      cacheRef.current.set(cacheKey, { contacts: data.contacts || [], pagination: data.pagination })
    } catch (err) {
      console.error('Error loading contacts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setIsSearching(false)
    }

  }, [debouncedSearch, dealStatusFilter, propertyTypeFilter, cityFilter, stateFilter, minValueFilter, maxValueFilter])

  // Progressive client-side filtering for instant feedback
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      if (lastRemoteContactsRef.current.length) {
        setContacts(lastRemoteContactsRef.current)
      }
      return
    }
    const base = lastRemoteContactsRef.current.length ? lastRemoteContactsRef.current : contacts
    const quick = base.filter((c: any) => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
      return (
        name.includes(q) ||
        (c.phone1 || '').toLowerCase().includes(q) ||
        (c.propertyAddress || '').toLowerCase().includes(q)
      )
    })
    setContacts(quick)
  }, [searchQuery])

  // Load contacts when filters change
  useEffect(() => {
    loadContacts(1, false)
  }, [loadContacts])

  // Infinite scroll handler
  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested, clientHeight, scrollHeight }: any) => {
    if (scrollUpdateWasRequested) return

    const scrollPercentage = scrollOffset / (scrollHeight - clientHeight)

    // Load more when 80% scrolled and not already loading
    if (scrollPercentage > 0.8 && hasMore && !loadingMore && !loading) {
      loadContacts(currentPage + 1, true)
    }
  }, [hasMore, loadingMore, loading, currentPage, loadContacts])

  const clearFilters = () => {
    setSearchQuery('')
    setDealStatusFilter('')
    setPropertyTypeFilter('')
    setCityFilter('')
    setStateFilter('')
    setMinValueFilter('')
    setMaxValueFilter('')
  }

  const itemData = useMemo(() => ({
    contacts,
    onContactSelect,
    selectedContacts,
    onContactSelectionChange,
    showSelection
  }), [contacts, onContactSelect, selectedContacts, onContactSelectionChange, showSelection])

  if (loading && contacts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 animate-pulse rounded" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
            {isSearching && (<div className="text-xs text-muted-foreground mt-1">Searching...</div>)}

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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search 500K+ contacts instantly..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isSearching && (<div className="text-xs text-muted-foreground mt-1">Searching...</div>)}

          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-4 bg-gray-50 rounded-lg">
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

            <Input
              placeholder="Min Value"
              type="number"
              value={minValueFilter}
              onChange={(e) => setMinValueFilter(e.target.value)}
            />

            <Input
              placeholder="Max Value"
              type="number"
              value={maxValueFilter}
              onChange={(e) => setMaxValueFilter(e.target.value)}
            />
          </div>
        )}

        {(searchQuery || dealStatusFilter || propertyTypeFilter || cityFilter || stateFilter || minValueFilter || maxValueFilter) && (
          <div className="flex items-center gap-2">
            <Button onClick={clearFilters} variant="outline" size="sm">
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
            {pagination && (
              <span className="text-sm text-gray-600">
                {pagination.totalCount.toLocaleString()} contacts found
                {pagination.source && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {pagination.source === 'elasticsearch' ? '⚡ Fast Search' : '🗄️ Database'}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Virtual List */}
      <div className="border rounded-lg">
        <List
          ref={listRef}
          height={height}
          itemCount={contacts.length + (hasMore ? 5 : 0)} // Add placeholder items for loading
          itemSize={90}
          itemData={itemData}
          onScroll={handleScroll}
          overscanCount={10}
        >
          {ContactItem}
        </List>
      </div>

      {/* Loading indicator */}
      {loadingMore && (
        <div className="text-center py-4">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          <p className="text-sm text-gray-600 mt-2">Loading more contacts...</p>
        </div>
      )}

      {contacts.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No contacts found. Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  )
}
