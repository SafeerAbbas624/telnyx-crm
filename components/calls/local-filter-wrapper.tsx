"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { Contact } from "@/lib/types"
import { useContacts } from "@/lib/context/contacts-context"

interface LocalFilterContextType {
  filterOptions: any
  searchContacts: (query: string, filters?: any) => Promise<void>
  currentFilters: any
  refreshFilterOptions: () => Promise<void>
}

const LocalFilterContext = createContext<LocalFilterContextType | undefined>(undefined)

interface LocalFilterWrapperProps {
  children: React.ReactNode
  allContacts: Contact[]
  onFilteredContactsChange: (contacts: Contact[], hasFilters: boolean) => void
  instanceId?: string // Unique ID to separate filter state between tabs
}

export function LocalFilterWrapper({ children, allContacts, onFilteredContactsChange, instanceId = 'default' }: LocalFilterWrapperProps) {
  const { filterOptions: globalFilterOptions, refreshFilterOptions: globalRefreshFilterOptions } = useContacts()
  const [currentFilters, setCurrentFilters] = useState<any>({})

  console.log(`🔍 [LOCAL FILTER ${instanceId}] Wrapper initialized`)

  // Local implementation of searchContacts that filters locally
  const searchContacts = async (query: string, filters?: any) => {
    console.log(`🔍 [LOCAL FILTER ${instanceId}] searchContacts called with:`, { query, filters, totalContacts: allContacts.length })
    setCurrentFilters(filters || {})

    // Apply filters locally
    let filtered = [...allContacts]
    console.log(`🔍 [LOCAL FILTER ${instanceId}] Starting with`, filtered.length, 'contacts')

    if (filters) {
      // Apply state filter
      if (filters.state) {
        const states = filters.state.split(',')
        console.log(`🔍 [LOCAL FILTER ${instanceId}] Filtering by states:`, states)
        filtered = filtered.filter(c => c.state && states.includes(c.state))
        console.log(`🔍 [LOCAL FILTER ${instanceId}] After state filter:`, filtered.length, 'contacts')
      }

      // Apply city filter
      if (filters.city) {
        const cities = filters.city.split(',')
        console.log(`🔍 [LOCAL FILTER ${instanceId}] Filtering by cities:`, cities)
        filtered = filtered.filter(c => c.city && cities.includes(c.city))
        console.log(`🔍 [LOCAL FILTER ${instanceId}] After city filter:`, filtered.length, 'contacts')
      }

      // Apply county filter
      if (filters.propertyCounty) {
        const counties = filters.propertyCounty.split(',')
        console.log(`🔍 [LOCAL FILTER ${instanceId}] Filtering by counties:`, counties)
        filtered = filtered.filter(c => c.propertyCounty && counties.includes(c.propertyCounty))
        console.log(`🔍 [LOCAL FILTER ${instanceId}] After county filter:`, filtered.length, 'contacts')
      }

      // Apply property type filter
      if (filters.propertyType) {
        const types = filters.propertyType.split(',')
        filtered = filtered.filter(c => c.propertyType && types.includes(c.propertyType))
      }

      // Apply deal status filter
      if (filters.dealStatus) {
        const statuses = filters.dealStatus.split(',')
        filtered = filtered.filter(c => c.dealStatus && statuses.includes(c.dealStatus))
      }

      // Apply tags filter
      if (filters.tags) {
        const tagNames = filters.tags.split(',')
        filtered = filtered.filter(c => {
          if (!c.tags || !Array.isArray(c.tags)) return false
          return c.tags.some(tag => tagNames.includes(tag.name))
        })
      }

      // Apply property value range
      if (filters.minValue || filters.maxValue) {
        filtered = filtered.filter(c => {
          const value = c.propertyValue || 0
          const min = filters.minValue ? Number(filters.minValue) : 0
          const max = filters.maxValue ? Number(filters.maxValue) : Infinity
          return value >= min && value <= max
        })
      }

      // Apply equity range
      if (filters.minEquity || filters.maxEquity) {
        filtered = filtered.filter(c => {
          const equity = c.equity || 0
          const min = filters.minEquity ? Number(filters.minEquity) : 0
          const max = filters.maxEquity ? Number(filters.maxEquity) : Infinity
          return equity >= min && equity <= max
        })
      }
    }

    const hasFilters = filters && Object.keys(filters).length > 0
    console.log(`🔍 [LOCAL FILTER ${instanceId}] Final result:`, filtered.length, 'contacts, hasFilters:', hasFilters)
    onFilteredContactsChange(filtered, hasFilters)
  }

  const refreshFilterOptions = async () => {
    await globalRefreshFilterOptions()
  }

  const value: LocalFilterContextType = {
    filterOptions: globalFilterOptions,
    searchContacts,
    currentFilters,
    refreshFilterOptions
  }

  return (
    <LocalFilterContext.Provider value={value}>
      {children}
    </LocalFilterContext.Provider>
  )
}

// Hook to use local filter context
export function useLocalFilters() {
  const context = useContext(LocalFilterContext)
  if (context === undefined) {
    throw new Error('useLocalFilters must be used within LocalFilterWrapper')
  }
  return context
}

