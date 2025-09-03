"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { Contact, Tag } from "@/lib/types"

interface ContactsContextType {
  contacts: Contact[]
  tags: Tag[]
  isLoading: boolean
  error: string | null
  addContact: (contact: Contact) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  deleteContact: (id: string) => void
  getContactById: (id: string) => Contact | undefined
  refreshContacts: () => Promise<void>
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined)

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContacts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/contacts')
      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }
      const data = await response.json()
      setContacts(data)
    } catch (err) {
      console.error('Error fetching contacts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts')
    } finally {
      setIsLoading(false)
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

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchContacts(), fetchTags()])
    }
    loadData()
  }, [])

  const refreshContacts = async () => {
    await fetchContacts()
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
        addContact,
        updateContact,
        deleteContact,
        getContactById,
        refreshContacts,
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
