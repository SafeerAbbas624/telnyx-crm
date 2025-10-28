"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Search, Users, Filter, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useContacts } from "@/lib/context/contacts-context"
import ContactName from "@/components/contacts/contact-name"
import AdvancedFiltersRedesign from "@/components/contacts/advanced-filters-redesign"
import type { Contact } from "@/lib/types"

interface AssignContactsToTeamDialogProps {
  isOpen: boolean
  onClose: () => void
  teamMember: {
    id: string
    firstName: string
    lastName: string
  }
  onSuccess: () => void
}

export default function AssignContactsToTeamDialog({ 
  isOpen, 
  onClose, 
  teamMember,
  onSuccess 
}: AssignContactsToTeamDialogProps) {
  const { toast } = useToast()
  const { contacts, searchContacts, pagination, goToPage, currentFilters, currentQuery, isLoading: contactsLoading } = useContacts()
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedContacts([])
      setSearchQuery("")
      setShowAdvancedFilters(false)
    }
  }, [isOpen])

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== currentQuery) {
        searchContacts(searchQuery, currentFilters)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSelectContact = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.id === contact.id)
    if (isSelected) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id))
    } else {
      setSelectedContacts([...selectedContacts, contact])
    }
  }

  const handleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts([...contacts])
    }
  }

  const handleAssign = async () => {
    if (selectedContacts.length === 0) {
      toast({
        title: 'No Contacts Selected',
        description: 'Please select at least one contact to assign',
        variant: 'destructive',
      })
      return
    }

    setIsAssigning(true)
    try {
      const response = await fetch('/api/admin/assign-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [teamMember.id],
          contactIds: selectedContacts.map(c => c.id),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign contacts')
      }

      toast({
        title: 'Success',
        description: `Assigned ${selectedContacts.length} contact(s) to ${teamMember.firstName} ${teamMember.lastName}`,
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error assigning contacts:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign contacts',
        variant: 'destructive',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Assign Contacts to {teamMember.firstName} {teamMember.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 min-h-0">
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
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Advanced Filters
                {showAdvancedFilters && <X className="h-3 w-3" />}
              </Button>
              {selectedContacts.length > 0 && (
                <Badge variant="default">
                  {selectedContacts.length} selected
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedContacts.length === contacts.length ? 'Deselect All' : 'Select All on Page'}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <Card>
              <CardContent className="p-4">
                <AdvancedFiltersRedesign />
              </CardContent>
            </Card>
          )}

          {/* Contact List */}
          <ScrollArea className="flex-1 border rounded-md h-[400px]">
            <div className="p-2 space-y-1">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No contacts found</p>
                </div>
              ) : (
                contacts.map(contact => {
                  const isSelected = selectedContacts.some(c => c.id === contact.id)
                  const contactTags = (contact as any).tags || []
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center space-x-3 p-3 rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectContact(contact)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectContact(contact)
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <ContactName contact={contact} />
                          {contactTags.length > 0 && (
                            <div className="flex gap-1">
                              {contactTags.slice(0, 2).map((tag: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {typeof tag === 'string' ? tag : tag.name}
                                </Badge>
                              ))}
                              {contactTags.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{contactTags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          {contact.phone1 && <span>{contact.phone1}</span>}
                          {contact.email1 && <span>{contact.email1}</span>}
                          {contact.propertyAddress && (
                            <span className="truncate">{contact.propertyAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                {pagination.totalCount} contacts
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={isAssigning || selectedContacts.length === 0}
            className="bg-[#2563eb] hover:bg-[#1d4ed8]"
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedContacts.length} Contact${selectedContacts.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

