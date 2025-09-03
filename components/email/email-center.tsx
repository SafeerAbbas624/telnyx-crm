"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Send, Settings, Plus, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import EmailConversationsList from "./email-conversations-list"
import EmailConversation from "./email-conversation"
import EmailBlast from "./email-blast"
import EmailAccountSetup from "./email-account-setup"
import { EmailSettings } from "./email-settings"
import { EmailConversationsGmail } from "./email-conversations-gmail"
import type { Contact } from "@/lib/types"

interface EmailCenterProps {
  selectedContactId?: string
}

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  isDefault: boolean
  status: 'active' | 'inactive' | 'error'
}

export default function EmailCenter({ selectedContactId }: EmailCenterProps) {
  const { toast } = useToast()
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [showAccountSetup, setShowAccountSetup] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load email accounts
  useEffect(() => {
    loadEmailAccounts()
  }, [])

  const loadEmailAccounts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/email/accounts')
      if (response.ok) {
        const data = await response.json()
        setEmailAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error loading email accounts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load email accounts',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)
  }

  const handleAccountAdded = () => {
    setShowAccountSetup(false)
    loadEmailAccounts()
    toast({
      title: 'Success',
      description: 'Email account added successfully',
    })
  }

  const syncEmails = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/email/sync', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        toast({
          title: 'Success',
          description: data.message || 'Emails synced successfully',
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to sync emails',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync emails',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Only show setup if explicitly requested
  // Don't block the entire Email Center if no accounts exist

  if (showAccountSetup) {
    return (
      <EmailAccountSetup
        onSuccess={handleAccountAdded}
        onCancel={() => setShowAccountSetup(false)}
      />
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Email Center</h1>
              <p className="text-sm text-muted-foreground">
                Manage email conversations and send email blasts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              {emailAccounts.filter(acc => acc.status === 'active').length} Active
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={syncEmails}
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Emails'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="conversations" className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conversations" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Conversations
              </TabsTrigger>
              <TabsTrigger value="blast" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Email Blast
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="conversations" className="h-full m-0">
              <EmailConversationsGmail emailAccounts={emailAccounts} />
            </TabsContent>
            <TabsContent value="blast" className="h-full m-0">
              <EmailBlast emailAccounts={emailAccounts} />
            </TabsContent>
            <TabsContent value="settings" className="h-full m-0 p-4 overflow-y-auto">
              <EmailSettings onAccountChange={loadEmailAccounts} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
