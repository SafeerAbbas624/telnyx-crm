"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { Mail } from "lucide-react"
import { TeamEmailConversationsGmail } from "./team-email-conversations-gmail-new"

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  status: 'active' | 'inactive' | 'error'
  provider: string
  lastSyncAt?: string
}

export default function TeamEmailConversations() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (session?.user) {
      loadEmailAccounts()
    }
  }, [session])

  const loadEmailAccounts = async () => {
    if (!session?.user) return

    setIsLoading(true)
    try {
      // Load email accounts - for team members, this will only return assigned accounts
      const response = await fetch('/api/email/accounts')
      if (response.ok) {
        const data = await response.json()
        setEmailAccounts(data.accounts || [])
      } else {
        console.error('Failed to load email accounts')
      }
    } catch (error) {
      console.error('Error loading email accounts:', error)
      toast({
        title: "Error",
        description: "Failed to load email accounts",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading email accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <TeamEmailConversationsGmail emailAccounts={emailAccounts} />
    </div>
  )
}
