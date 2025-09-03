import type { Contact, Conversation, Call } from "./types"
import { mockContacts, getContacts, getCalls, getActivities } from "./mock-contacts"

// Export contacts for compatibility
export const contacts = mockContacts

// Export function to get contacts
export const getContactById = (id: string): Contact | undefined => {
  return mockContacts.find(contact => contact.id === id)
}

// Export calls
export const calls = getCalls()

// Mock conversations data
const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    contactId: "1",
    contactName: "Alice Smith",
    contactPhone: "123-456-7890",
    lastMessage: "Hi, is this still available?",
    lastMessageTime: "2024-01-15T10:00:00Z",
    unreadCount: 2,
    status: "active"
  },
  {
    id: "conv-2",
    contactId: "2",
    contactName: "Bob Johnson",
    contactPhone: "098-765-4321",
    lastMessage: "Thanks for the information",
    lastMessageTime: "2024-01-16T11:00:00Z",
    unreadCount: 0,
    status: "active"
  },
  {
    id: "conv-3",
    contactId: "3",
    contactName: "Carol Davis",
    contactPhone: "555-123-4567",
    lastMessage: "I'll think about it",
    lastMessageTime: "2024-01-17T09:30:00Z",
    unreadCount: 1,
    status: "active"
  }
]

export const getActiveConversations = (): Conversation[] => {
  return mockConversations.filter(conv => conv.status === "active")
}

// Re-export other functions from mock-contacts for compatibility
export { getActivities }
