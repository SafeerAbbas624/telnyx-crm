"use client"

import { useState, useMemo, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, UserPlus, Trash2, Search } from "lucide-react"
import ContactsList from "./contacts-list"
import AddContactDialog from "./add-contact-dialog"
import EditContactDialog from "./edit-contact-dialog"
import ContactDetails from "./contact-details" // Import ContactDetails
import AdvancedContactFilter from "../text/advanced-contact-filter"
import { useContacts } from "@/lib/context/contacts-context"
import { useSession } from "next-auth/react"
import AssignContactModal from "@/components/admin/assign-contact-modal"
import type { Contact } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ContactsSection() {
  const { data: session } = useSession()
  const { contacts, addContact, updateContact, deleteContact, isLoading, error, pagination, loadMoreContacts, goToPage, searchContacts, filterOptions, currentQuery, currentFilters } = useContacts()
  const { toast } = useToast()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactToDelete, setContactToDelete] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null) // State for selected contact

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'ADMIN'
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Debounce search - wait longer for user to finish typing
  const debouncedSearchTerm = useDebounce(searchTerm, 800) // 800ms wait

  // Initialize filtered contacts with all contacts when they're first loaded
  useEffect(() => {
    console.log('🔍 ContactsSection - Contacts changed:', {
      contacts,
      contactsLength: Array.isArray(contacts) ? contacts.length : 'Not an array',
      contactsType: typeof contacts,
      filteredContactsLength: filteredContacts.length,
      isArray: Array.isArray(contacts),
      firstContact: Array.isArray(contacts) ? contacts[0] : 'N/A'
    })

    if (contacts.length > 0 && filteredContacts.length === 0) {
      console.log('🔍 ContactsSection - Setting filtered contacts from context')
      setFilteredContacts(contacts)
    }
  }, [contacts, filteredContacts.length])

  // Real-time database search effect
  useEffect(() => {
    console.log('🔍 Search effect triggered:', { searchTerm, debouncedSearchTerm })
    // Trigger database search when debounced term changes
    searchContacts(debouncedSearchTerm)
    // Intentionally exclude searchContacts from deps to avoid identity changes causing loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm])

  // Use filtered contacts when a search or filters are active (even if zero results)
  const isFilteringActive = Boolean(currentQuery) || (currentFilters && Object.values(currentFilters).some(v => String(v).length > 0))
  const finalFilteredContacts = isFilteringActive ? filteredContacts : contacts



  const handleDeleteContact = (contactId: string) => {
    setContactToDelete(contactId)
    setShowDeleteDialog(true)
  }

  const handleBulkDelete = async (contactIds: string[]) => {
    try {
      // Delete each contact
      for (const contactId of contactIds) {
        await deleteContact(contactId)
      }
      // Clear selection after successful deletion
      setSelectedContactIds([])
      toast({
        title: "Success",
        description: `${contactIds.length} contact(s) deleted successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contacts",
        variant: "destructive",
      })
    }
  }

  const handleContactSelectionChange = (contactIds: string[]) => {
    setSelectedContactIds(contactIds)
    // Also update the selectedContacts array with actual contact objects
    const selectedContactObjects = finalFilteredContacts.filter(contact =>
      contactIds.includes(contact.id)
    )
    setSelectedContacts(selectedContactObjects)
  }

  const handleSelectAll = () => {
    const allContactIds = finalFilteredContacts.map(contact => contact.id)
    setSelectedContactIds(allContactIds)
    setSelectedContacts(finalFilteredContacts)
  }

  const handleDeselectAll = () => {
    setSelectedContactIds([])
    setSelectedContacts([])
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setShowEditDialog(true)
  }

  const confirmDelete = () => {
    if (contactToDelete) {
      deleteContact(contactToDelete)
      setContactToDelete(null)
      setShowDeleteDialog(false)
      if (selectedContact?.id === contactToDelete) {
        setSelectedContact(null) // Clear selected contact if it was deleted
      }
    }
  }

  const handleAddContact = async (newContactData: Omit<Contact, "id" | "createdAt">) => {
    try {
      const estValue = newContactData.propertyValue ?? undefined
      const debtOwed = newContactData.debtOwed ?? undefined
      const estEquity = typeof estValue === 'number' && typeof debtOwed === 'number'
        ? Number(estValue) - Number(debtOwed)
        : undefined

      const payload: any = {
        firstName: newContactData.firstName,
        lastName: newContactData.lastName,
        phone1: (newContactData as any).phone || newContactData.phone1 || undefined,
        email1: (newContactData as any).email || newContactData.email1 || undefined,
        propertyAddress: newContactData.propertyAddress || undefined,
        propertyType: newContactData.propertyType || undefined,
        estValue,
        estEquity,
        notes: newContactData.notes || undefined,
      }

      await addContact(payload as any)
      setShowAddDialog(false)
    } catch (e) {
      console.error('Failed to add contact', e)
    }
  }

  const handleUpdateContact = (id: string, updates: Partial<Contact>) => {
    updateContact(id, updates)
    setShowEditDialog(false)
    setEditingContact(null)
    if (selectedContact?.id === id) {
      setSelectedContact((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact)
  }

  const handleBackToList = () => {
    setSelectedContact(null)
  }

  const hasActiveFilters = selectedContacts.length > 0

  if (selectedContact) {
    return <ContactDetails contact={selectedContact} onBack={handleBackToList} />
  }

  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Contacts</h1>
            <p className="text-gray-600">View, filter, and manage your property contacts</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
            <Plus size={16} />
            Add Contact
          </Button>
        </div>


        {/* Advanced Filters (Unified) */}
        <div className="mb-6">
          <AdvancedContactFilter
            contacts={contacts}
            onFilteredContactsChange={setFilteredContacts}
            selectedContacts={selectedContacts}
            onSelectedContactsChange={(arr) => {
              setSelectedContacts(arr)
              setSelectedContactIds(arr.map(c => c.id))
            }}
            showList={false}
            hideHeader

            extraActions={(
              <>
                {selectedContactIds.length > 0 && (
                  <>
                    {isAdmin && (
                      <AssignContactModal
                        contacts={selectedContacts}
                        onAssignmentComplete={() => {
                          toast({
                            title: "Success",
                            description: `${selectedContactIds.length} contact(s) assigned successfully`,
                          })
                          setSelectedContacts([])
                          setSelectedContactIds([])
                        }}
                        buttonVariant="outline"
                        buttonSize="sm"
                        buttonText={`Assign Selected (${selectedContactIds.length})`}
                        trigger={
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Assign Selected ({selectedContactIds.length})
                          </Button>
                        }
                      />
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleBulkDelete(selectedContactIds)}
                      className="ml-2"
                    >
                      Delete All ({selectedContactIds.length})
                    </Button>
                  </>
                )}
              </>
            )}
          />
        </div>


      </div>


      {/* Results Summary */}
      <div className="px-6 py-3 bg-gray-50 border-b">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {pagination ? (
              <>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} contacts
                {selectedContactIds.length > 0 && (
                  <span className="ml-2 text-blue-600">• {selectedContactIds.length} selected</span>
                )}
              </>
            ) : (
              <>
                Showing {finalFilteredContacts.length} of {contacts.length} contacts
                {selectedContactIds.length > 0 && (
                  <span className="ml-2 text-blue-600">• {selectedContactIds.length} selected</span>
                )}
              </>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedContacts([])
                setSelectedContactIds([])
              }}
              className="text-xs"
            >
              Clear selection
            </Button>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div className="px-6 pb-6">
        {finalFilteredContacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters ? (
              <div>
                <p className="mb-2">No contacts found matching your criteria</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedContacts([])
                    setSelectedContactIds([])
                  }}
                >
                  Clear selection
                </Button>
              </div>
            ) : (
              <div>
                <p className="mb-4">No contacts yet</p>
                <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
                  <Plus size={16} />
                  Add your first contact
                </Button>
              </div>
            )}
          </div>
        ) : (
          <ContactsList
            contacts={finalFilteredContacts}
            onDeleteContact={handleDeleteContact}
            onEditContact={handleEditContact}
            onContactSelect={handleContactSelect}
            selectedContacts={selectedContactIds}
            onContactSelectionChange={handleContactSelectionChange}
            onBulkDelete={handleBulkDelete}
          />
        )}
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} contacts
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={!pagination.hasMore}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMoreContacts}
              disabled={!pagination.hasMore}
            >
              Load More
            </Button>
          </div>
        </div>
      )}

      {/* Add Contact Dialog */}
      <AddContactDialog open={showAddDialog} onOpenChange={setShowAddDialog} onAddContact={handleAddContact} />

      {/* Edit Contact Dialog */}
      {editingContact && ( // Ensure editingContact is not null before rendering
        <EditContactDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          contact={editingContact}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
