"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Filter, Tag, Trash2 } from "lucide-react"
import { mockContacts } from "@/lib/mock-contacts"
import type { Contact } from "@/lib/types"

export default function ContactsManager() {
  const [contacts, setContacts] = useState<Contact[]>(mockContacts)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [allPropertyTypes, setAllPropertyTypes] = useState<string[]>([])
  const [allCities, setAllCities] = useState<string[]>([])

  useEffect(() => {
    // Extract unique tags, property types, and cities from contacts
    const tags = new Set<string>()
    const propertyTypes = new Set<string>()
    const cities = new Set<string>()

    contacts.forEach((contact) => {
      if (contact.tags) {
        contact.tags.forEach((tag) => {
          if (typeof tag === "object") {
            tags.add(tag.name)
          } else {
            tags.add(String(tag))
          }
        })
      }
      if (contact.propertyType) {
        propertyTypes.add(contact.propertyType)
      }
      if (contact.cityState) {
        cities.add(contact.cityState)
      }
    })

    setAllTags(Array.from(tags))
    setAllPropertyTypes(Array.from(propertyTypes))
    setAllCities(Array.from(cities))
  }, [contacts])

  const filteredContacts = contacts.filter((contact) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase()
    const searchMatch =
      contact.name?.toLowerCase().includes(searchLower) ||
      false ||
      contact.phoneNumber?.includes(searchLower) ||
      false ||
      contact.propertyAddress?.toLowerCase().includes(searchLower) ||
      false ||
      contact.cityState?.toLowerCase().includes(searchLower) ||
      false ||
      contact.propertyType?.toLowerCase().includes(searchLower) ||
      false ||
      contact.llcName?.toLowerCase().includes(searchLower) ||
      false ||
      // Search in tags
      (contact.tags &&
        contact.tags.some((tag) =>
          typeof tag === "object"
            ? tag.name.toLowerCase().includes(searchLower)
            : String(tag).toLowerCase().includes(searchLower),
        ))

    // Tag filter
    const tagMatch =
      selectedTags.length === 0 ||
      (contact.tags &&
        contact.tags.some((tag) => selectedTags.includes(typeof tag === "object" ? tag.name : String(tag))))

    // Property type filter
    const propertyTypeMatch =
      selectedPropertyTypes.length === 0 || selectedPropertyTypes.includes(contact.propertyType || "")

    // City filter
    const cityMatch = selectedCities.length === 0 || selectedCities.includes(contact.cityState || "")

    return searchMatch && tagMatch && propertyTypeMatch && cityMatch
  })

  const toggleContactSelection = (contactId: string) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter((id) => id !== contactId))
    } else {
      setSelectedContacts([...selectedContacts, contactId])
    }
  }

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map((contact) => contact.id))
    }
  }

  const handleDeleteSelected = () => {
    setContacts(contacts.filter((contact) => !selectedContacts.includes(contact.id)))
    setSelectedContacts([])
  }

  const handleTagFilter = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handlePropertyTypeFilter = (type: string) => {
    if (selectedPropertyTypes.includes(type)) {
      setSelectedPropertyTypes(selectedPropertyTypes.filter((t) => t !== type))
    } else {
      setSelectedPropertyTypes([...selectedPropertyTypes, type])
    }
  }

  const handleCityFilter = (city: string) => {
    if (selectedCities.includes(city)) {
      setSelectedCities(selectedCities.filter((c) => c !== city))
    } else {
      setSelectedCities([...selectedCities, city])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Manage Contacts</h2>
        <p className="text-muted-foreground mb-4">View, filter, and manage your property contacts</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" />
          Filters
          {(selectedTags.length > 0 || selectedPropertyTypes.length > 0 || selectedCities.length > 0) && (
            <Badge variant="secondary" className="ml-1">
              {selectedTags.length + selectedPropertyTypes.length + selectedCities.length}
            </Badge>
          )}
        </Button>

        <Button
          variant="destructive"
          className="flex items-center gap-2"
          disabled={selectedContacts.length === 0}
          onClick={handleDeleteSelected}
        >
          <Trash2 className="h-4 w-4" />
          Delete Selected
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-md bg-muted/30">
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Filter by Tags
            </h3>
            <div className="space-y-2">
              {allTags.map((tag: string) => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tag-${tag}`}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => handleTagFilter(tag)}
                  />
                  <Label htmlFor={`tag-${tag}`}>{tag}</Label>
                </div>
              ))}
              {allTags.length === 0 && <p className="text-sm text-muted-foreground">No tags available</p>}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter by Property Type
            </h3>
            <div className="space-y-2">
              {allPropertyTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={selectedPropertyTypes.includes(type)}
                    onCheckedChange={() => handlePropertyTypeFilter(type)}
                  />
                  <Label htmlFor={`type-${type}`}>{type}</Label>
                </div>
              ))}
              {allPropertyTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">No property types available</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter by Location
            </h3>
            <div className="space-y-2">
              {allCities.map((city) => (
                <div key={city} className="flex items-center space-x-2">
                  <Checkbox
                    id={`city-${city}`}
                    checked={selectedCities.includes(city)}
                    onCheckedChange={() => handleCityFilter(city)}
                  />
                  <Label htmlFor={`city-${city}`}>{city}</Label>
                </div>
              ))}
              {allCities.length === 0 && <p className="text-sm text-muted-foreground">No locations available</p>}
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="rounded-md border">
          <div className="flex items-center p-4 border-b bg-muted/50">
            <div className="flex items-center space-x-2 w-10">
              <Checkbox
                id="select-all"
                checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </div>
            <div className="grid grid-cols-5 flex-1 gap-4 text-sm font-medium">
              <div>Name</div>
              <div>Phone</div>
              <div>Property Address</div>
              <div>Property Type</div>
              <div>Tags</div>
            </div>
          </div>

          <ScrollArea className="h-[500px]">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No contacts found</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`flex items-center p-4 border-b hover:bg-muted/50 ${
                    selectedContacts.includes(contact.id) ? "bg-muted/50" : ""
                  }`}
                >
                  <div className="flex items-center space-x-2 w-10">
                    <Checkbox
                      id={`select-${contact.id}`}
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContactSelection(contact.id)}
                    />
                  </div>
                  <div className="grid grid-cols-5 flex-1 gap-4 text-sm">
                    <div>{contact.name}</div>
                    <div>{contact.phoneNumber}</div>
                    <div>{contact.propertyAddress}</div>
                    <div>{contact.propertyType}</div>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.map((tag) => (
                        <Badge key={typeof tag === "object" ? tag.id : tag} variant="secondary" className="text-xs">
                          {typeof tag === "object" ? tag.name : tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        <div className="mt-2 text-sm text-muted-foreground">
          Showing {filteredContacts.length} of {contacts.length} contacts
        </div>
      </div>
    </div>
  )
}
