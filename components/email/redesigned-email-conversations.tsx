'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Search,
  Inbox,
  Star,
  Archive,
  Trash2,
  Plus,
  CheckCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import EnhancedEmailModal from './enhanced-email-modal'
import ImprovedConversationView from './improved-conversation-view'
import { useEmailUpdates } from '@/lib/hooks/use-socket'

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  isDefault: boolean
  status: 'active' | 'inactive' | 'error'
  signature?: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email1: string
  email2?: string
  avatarUrl?: string
}

interface EmailConversation {
  id: string
  contact: Contact
  lastMessage?: {
    subject: string
    preview: string
    sentAt: string
    isRead: boolean
    direction: 'inbound' | 'outbound'
  }
  unreadCount: number
  messageCount: number
}

interface RedesignedEmailConversationsProps {
  emailAccounts: EmailAccount[]
}

export default function RedesignedEmailConversations({ emailAccounts }: RedesignedEmailConversationsProps) {
  const { toast } = useToast()
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<EmailConversation | null>(null)
  const [conversations, setConversations] = useState<EmailConversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [view, setView] = useState<'inbox' | 'starred' | 'archived' | 'trash'>('inbox')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Real-time updates
  const { newEmailCount, resetCount } = useEmailUpdates(selectedAccount?.id)

  // Log email accounts received
  useEffect(() => {
    console.log('📧 [REDESIGNED-CONVERSATIONS] Received email accounts:', emailAccounts.length, emailAccounts)
  }, [emailAccounts])

  // Auto-select first account
  useEffect(() => {
    if (emailAccounts.length > 0 && !selectedAccount) {
      const defaultAccount = emailAccounts.find(acc => acc.isDefault) || emailAccounts[0]
      console.log('📧 [REDESIGNED-CONVERSATIONS] Auto-selecting account:', defaultAccount)
      setSelectedAccount(defaultAccount)
    }
  }, [emailAccounts, selectedAccount])

  // Load conversations when account or view changes
  useEffect(() => {
    if (selectedAccount) {
      setCurrentPage(1)
      loadConversations(1)
    }
  }, [selectedAccount, view])

  // Reload on new emails
  useEffect(() => {
    if (newEmailCount > 0 && selectedAccount) {
      console.log(`📧 [REAL-TIME] ${newEmailCount} new email(s), reloading...`)
      loadConversations()
      resetCount()
    }
  }, [newEmailCount, selectedAccount])

  const loadConversations = async (page = 1) => {
    if (!selectedAccount) return

    try {
      setIsLoading(true)
      // Load ALL conversations by setting a very high limit (10000)
      // This ensures we get all conversations in a single request
      const response = await fetch(
        `/api/email/conversations?accountId=${selectedAccount.id}&view=${view}&page=1&limit=10000`
      )
      if (response.ok) {
        const data = await response.json()
        console.log('📧 [LOAD-CONVERSATIONS] Loaded:', data.conversations?.length, 'of', data.total, 'total conversations')
        setConversations(data.conversations || [])
        setCurrentPage(data.page || 1)
        setTotalPages(data.totalPages || 1)
        setHasMore(data.hasMore || false)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }



  const filteredConversations = conversations.filter(conv =>
    searchQuery === '' ||
    conv.contact.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.email1.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.lastMessage?.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getInitials = (contact: Contact) => {
    return `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase() || 'U'
  }

  // Debug: Log conversations count
  useEffect(() => {
    console.log('📧 [CONVERSATIONS] Total conversations:', filteredConversations.length)
    console.log('📧 [CONVERSATIONS] Selected account:', selectedAccount?.displayName)
  }, [filteredConversations, selectedAccount])

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm border">
      {/* Left Sidebar - Account Selector & Navigation */}
      <div className="w-64 border-r bg-gray-50 flex flex-col">
        {/* Compose Button */}
        <div className="p-4">
          <Button
            onClick={() => setShowComposeModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 shadow-md"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Compose
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <div className="px-2 space-y-1">
            <button
              onClick={() => setView('inbox')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                view === 'inbox' 
                  ? "bg-blue-100 text-blue-700 font-medium" 
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <Inbox className="h-5 w-5" />
              <span>Inbox</span>
              {conversations.filter(c => c.unreadCount > 0).length > 0 && (
                <Badge className="ml-auto bg-blue-600">
                  {conversations.filter(c => c.unreadCount > 0).length}
                </Badge>
              )}
            </button>

            <button
              onClick={() => setView('starred')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                view === 'starred' 
                  ? "bg-blue-100 text-blue-700 font-medium" 
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <Star className="h-5 w-5" />
              <span>Starred</span>
            </button>

            <button
              onClick={() => setView('archived')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                view === 'archived' 
                  ? "bg-blue-100 text-blue-700 font-medium" 
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <Archive className="h-5 w-5" />
              <span>Archived</span>
            </button>

            <button
              onClick={() => setView('trash')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                view === 'trash'
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <Trash2 className="h-5 w-5" />
              <span>Trash</span>
            </button>
          </div>

          {/* Account Selector */}
          <div className="px-2 mt-6">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Accounts ({emailAccounts.length})
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {emailAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                    selectedAccount?.id === account.id
                      ? "bg-white shadow-sm border border-gray-200"
                      : "hover:bg-gray-100"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold",
                    selectedAccount?.id === account.id ? "bg-blue-600" : "bg-gray-400"
                  )}>
                    {account.displayName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {account.displayName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {account.emailAddress}
                    </p>
                  </div>
                  {account.status === 'active' && (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Middle - Conversations List */}
      <div className="w-96 border-r flex flex-col bg-white overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900">
              {view === 'inbox' ? 'Inbox' : view === 'starred' ? 'Starred' : 'Archived'}
            </h2>
            <div className="flex items-center gap-2">
              {/* Auto-syncing indicator */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Auto-syncing</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading...</p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={cn(
                    "w-full p-4 hover:bg-gray-50 transition-colors text-left",
                    conversation.unreadCount > 0 && "bg-blue-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className={cn(
                        "text-white font-semibold",
                        conversation.unreadCount > 0 ? "bg-blue-600" : "bg-gray-400"
                      )}>
                        {getInitials(conversation.contact)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn(
                          "text-sm truncate",
                          conversation.unreadCount > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-700"
                        )}>
                          {conversation.contact.firstName} {conversation.contact.lastName}
                        </p>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {conversation.lastMessage?.sentAt && 
                            formatDistanceToNow(new Date(conversation.lastMessage.sentAt), { addSuffix: true })
                          }
                        </span>
                      </div>

                      <p className={cn(
                        "text-sm truncate mb-1",
                        conversation.unreadCount > 0 ? "font-medium text-gray-900" : "text-gray-600"
                      )}>
                        {conversation.lastMessage?.subject || 'No subject'}
                      </p>

                      <p className="text-xs text-gray-500 truncate">
                        {conversation.lastMessage?.preview || 'No preview available'}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        {conversation.unreadCount > 0 && (
                          <Badge className="bg-blue-600 text-xs">
                            {conversation.unreadCount} new
                          </Badge>
                        )}
                        {conversation.lastMessage?.direction === 'outbound' && (
                          <CheckCheck className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t p-4 flex items-center justify-between bg-white flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newPage = currentPage - 1
                setCurrentPage(newPage)
                loadConversations(newPage)
              }}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newPage = currentPage + 1
                setCurrentPage(newPage)
                loadConversations(newPage)
              }}
              disabled={!hasMore}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Right - Conversation View or Empty State */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedConversation ? (
          <ImprovedConversationView
            conversationId={selectedConversation.id}
            emailAccount={selectedAccount!}
            contact={selectedConversation.contact}
            onBack={() => setSelectedConversation(null)}
            onUpdate={() => loadConversations(currentPage)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Select a conversation
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Choose a conversation from the list to view messages
              </p>
              <Button
                onClick={() => setShowComposeModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Compose New Email
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showComposeModal && (
        <EnhancedEmailModal
          isOpen={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          emailAccount={selectedAccount}
          onEmailSent={() => {
            setShowComposeModal(false)
            loadConversations()
          }}
        />
      )}
    </div>
  )
}

