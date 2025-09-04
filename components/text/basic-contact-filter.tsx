"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, X, Check, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { useContacts } from "@/lib/context/contacts-context"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import type { Contact } from "@/lib/types"

interface BasicContactFilterProps {
  selectedContacts: Contact[]
  onSelectedContactsChange: (contacts: Contact[]) => void
}

export default function BasicContactFilter({
  selectedContacts,
  onSelectedContactsChange,
}: BasicContactFilterProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const { toast } = useToast()
  const { contacts, pagination, goToPage, searchContacts, currentQuery, currentFilters } = useContacts()
  
  // Debounce search to prevent too many requests
  const debouncedSearchQuery = useDebounce(searchQuery, 800)

  // Trigger search only when debounced value changes
  useEffect(() => {
    // Fire and forget; provider state updates will re-render consumers
    searchContacts(debouncedSearchQuery, {})
    // Intentionally exclude searchContacts from deps to avoid identity changes causing loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery])

  const handleSelectAll = () => {
    onSelectedContactsChange(contacts)
    toast({
      title: "Current page selected",
      description: `Selected ${contacts.length} contacts from current page`,
    })
  }

  const handleSelectAllPages = async () => {
    try {
      // Build base params using current query and filters
      const baseParams = new URLSearchParams({
        page: '1',
        limit: '100', // API caps at 100 per page
        ...(currentQuery ? { search: currentQuery } : {}),
        ...Object.fromEntries(
          Object.entries(currentFilters || {}).map(([k, v]) => [k, String(v)])
        ),
      })

      const fetchPage = async (page: number) => {
        baseParams.set('page', String(page))
        const res = await fetch(`/api/contacts?${baseParams.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const contactsData = data.contacts?.contacts || data.contacts || data
        const paginationData = data.contacts?.pagination || data.pagination || null
        return { contacts: contactsData as Contact[], pagination: paginationData }
      }

      // Fetch first page to discover total pages
      const first = await fetchPage(1)
      let all: Contact[] = Array.isArray(first.contacts) ? first.contacts : []
      const totalPages = first.pagination?.totalPages || 1

      // Fetch remaining pages sequentially
      for (let p = 2; p <= totalPages; p++) {
        const next = await fetchPage(p)
        if (Array.isArray(next.contacts)) {
          all = all.concat(next.contacts)
        }
      }

      onSelectedContactsChange(all)
      toast({
        title: "All contacts selected",
        description: `Selected ${all.length} contacts from all pages`,
      })
    } catch (error) {
      console.error('Error selecting all contacts:', error)
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

  const handleNextPage = async () => {
    console.log('🔍 Next page clicked, pagination:', pagination)
    if (pagination) {
      const currentPage = pagination.currentPage || pagination.page || 1
      const totalPages = pagination.totalPages || Math.ceil((pagination.totalCount || 0) / 50)

      console.log('🔍 Current page:', currentPage, 'Total pages:', totalPages)

      if (currentPage < totalPages) {
        console.log('🔍 Going to page:', currentPage + 1)
        await goToPage(currentPage + 1)
      } else {
        console.log('🔍 Already on last page')
      }
    } else {
      console.log('🔍 No pagination data available')
    }
  }

  const handlePrevPage = async () => {
    if (pagination) {
      const currentPage = pagination.currentPage || pagination.page || 1

      if (currentPage > 1) {
        console.log('🔍 Going to page:', currentPage - 1)
        await goToPage(currentPage - 1)
      }
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

  const clearSearch = () => {
    setSearchQuery("")
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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <Check className="h-4 w-4 mr-2" />
            Select Page ({contacts.length})
          </Button>
          <Button variant="outline" size="sm" onClick={handleSelectAllPages}>
            <Check className="h-4 w-4 mr-2" />
            Select All Pages ({pagination?.totalCount || 'All'})
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            Deselect All
          </Button>
          {searchQuery && (
            <Button variant="outline" size="sm" onClick={clearSearch}>
              <X className="h-4 w-4 mr-2" />
              Clear Search
            </Button>
          )}
        </div>

        {/* Contact List */}
        <div className="h-96 overflow-y-auto border rounded-md">
          <div className="space-y-2 p-2">
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No contacts found
              </div>
            ) : (
              contacts.map(contact => {
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
                      readOnly
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
              })
            )}
          </div>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-500">
              {(() => {
                const currentPage = pagination.currentPage || pagination.page || 1
                const totalCount = pagination.totalCount || 0
                const startItem = ((currentPage - 1) * 50) + 1
                const endItem = Math.min(currentPage * 50, totalCount)
                return `Showing ${startItem} to ${endItem} of ${totalCount} contacts`
              })()}
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const currentPage = pagination.currentPage || pagination.page || 1
                const totalPages = pagination.totalPages || Math.ceil((pagination.totalCount || 0) / 50)

                return (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-500">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
