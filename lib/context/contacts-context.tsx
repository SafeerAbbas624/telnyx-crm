"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { Contact, Tag } from "@/lib/types"
import { useSession } from "next-auth/react"

interface ContactsContextType {
  contacts: Contact[]
  tags: Tag[]
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  } | null
  addContact: (contact: Contact) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  deleteContact: (id: string) => void
  getContactById: (id: string) => Contact | undefined
  refreshContacts: () => Promise<void>
  loadMoreContacts: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  searchContacts: (query: string, filters?: any) => Promise<void>
  filterOptions: any
  currentQuery: string
  currentFilters: any
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined)

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  } | null>(null)
  const [filterOptions, setFilterOptions] = useState<any>(null)
  const [currentRequest, setCurrentRequest] = useState<AbortController | null>(null)
  const [currentQuery, setCurrentQuery] = useState<string>("")
  const [currentFilters, setCurrentFilters] = useState<any>({})

  const fetchContacts = async (page = 1, limit = 50, search = '', filters = {}) => {
    try {
      // Cancel previous request if it exists
      if (currentRequest) {
        currentRequest.abort()
      }

      // Create new abort controller for this request
      const abortController = new AbortController()
      setCurrentRequest(abortController)

      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...filters
      })

      // Always use the general contacts API here. Team restrictions are handled in team-specific components/pages.
      console.log(`🔍 [FRONTEND DEBUG] Making search request: ${search ? `"${search}"` : 'no search'} with filters:`, filters)

      const response = await fetch(`/api/contacts?${params}`, {
        signal: abortController.signal
      })

      // Persist current query and filters
      setCurrentQuery(search)
      setCurrentFilters(filters)
      if (!response.ok) {
        console.error(`❌ [FRONTEND DEBUG] API request failed: ${response.status} ${response.statusText}`)
        throw new Error('Failed to fetch contacts')
      }
      const data = await response.json()

      console.log(`✅ [FRONTEND DEBUG] API response received:`, {
        totalContacts: data.contacts?.length || 0,
        totalCount: data.pagination?.totalCount || 0,
        source: data.source,
        hasContacts: !!data.contacts,
        hasPagination: !!data.pagination,
        rawDataStructure: Object.keys(data)
      })

      // The API returns { contacts: [...], pagination: {...} }
      // So we should use data.contacts directly, not data.contacts.contacts
      const contactsData = Array.isArray(data.contacts) ? data.contacts : []
      const paginationData = data.pagination || null

      console.log(`📊 [FRONTEND DEBUG] Extracted data:`, {
        contactsCount: contactsData.length,
        contactsIsArray: Array.isArray(contactsData),
        paginationExists: !!paginationData,
        firstContactName: contactsData[0] ? `${contactsData[0].firstName} ${contactsData[0].lastName}` : 'none'
      })



      console.log(`📊 [FRONTEND DEBUG] Processing ${contactsData?.length || 0} contacts for page ${page}`)

      // If it's page 1, replace contacts; otherwise append for infinite scroll
      if (page === 1) {
        setContacts(contactsData)
        console.log(`🔄 [FRONTEND DEBUG] Replaced contacts with ${contactsData?.length || 0} new contacts`)
      } else {
        setContacts(prev => {
          const newContacts = [...prev, ...contactsData]
          console.log(`➕ [FRONTEND DEBUG] Appended ${contactsData?.length || 0} contacts, total now: ${newContacts.length}`)
          return newContacts
        })
      }

      // Update pagination info
      setPagination(paginationData)

      // Clear current request since it completed successfully
      setCurrentRequest(null)
      return paginationData
    } catch (err) {
      // Don't log errors for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was cancelled')
        return null
      }

      console.error('Error fetching contacts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts')
      return null
    } finally {
      setIsLoading(false)
      // Clear current request in finally block
      setCurrentRequest(null)
    }
  }

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/contacts/tags')
      if (!response.ok) {
        throw new Error('Failed to fetch tags')
      }
      const data = await response.json()
      setTags(data)
    } catch (err) {
      console.error('Error fetching tags:', err)
    }
  }

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/contacts/filter-options')
      if (!response.ok) {
        throw new Error('Failed to fetch filter options')
      }
      const data = await response.json()
      setFilterOptions(data)
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchContacts(), fetchTags(), fetchFilterOptions()])
    }
    loadData()
  }, [])

  const refreshContacts = async () => {
    await fetchContacts()
  }

  const loadMoreContacts = async () => {
    if (pagination && pagination.hasMore) {
      await fetchContacts(pagination.page + 1, pagination.limit)
    }
  }

  const goToPage = async (page: number) => {
    await fetchContacts(page, pagination?.limit || 50)
  }

  const searchContacts = async (query: string, filters: any = {}) => {
    console.log('🔍 searchContacts called with:', { query, filters })
    // Reset to page 1 for new search
    await fetchContacts(1, 50, query, filters)
  }

  const addContact = async (contact: Contact) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contact),
      })
      
      if (!response.ok) {
        throw new Error('Failed to add contact')
      }
      
      const newContact = await response.json()
      setContacts(prev => [...prev, newContact])
      return newContact
    } catch (err) {
      console.error('Error adding contact:', err)
      throw err
    }
  }

  const updateContact = async (id: string, updates: Partial<Contact>) => {
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update contact')
      }
      
      const updatedContact = await response.json()
      setContacts(prev => prev.map(contact => 
        contact.id === id ? { ...contact, ...updatedContact } : contact
      ))
      return updatedContact
    } catch (err) {
      console.error('Error updating contact:', err)
      throw err
    }
  }

  const deleteContact = async (id: string) => {
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete contact')
      }
      
      setContacts(prev => prev.filter(contact => contact.id !== id))
      return true
    } catch (err) {
      console.error('Error deleting contact:', err)
      throw err
    }
  }

  const getContactById = (id: string) => {
    return contacts.find((contact) => contact.id === id)
  }

  return (
    <ContactsContext.Provider
      value={{
        contacts,
        tags,
        isLoading,
        error,
        pagination,
        filterOptions,
        addContact,
        updateContact,
        deleteContact,
        getContactById,
        refreshContacts,
        loadMoreContacts,
        goToPage,
        searchContacts,
        currentQuery,
        currentFilters,
      }}
    >
      {children}
    </ContactsContext.Provider>
  )
}

export function useContacts() {
  const context = useContext(ContactsContext)
  if (context === undefined) {
    throw new Error("useContacts must be used within a ContactsProvider")
  }
  return context
}
