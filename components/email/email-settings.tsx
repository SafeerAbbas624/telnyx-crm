'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  Settings, 
  Mail, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Shield,
  Server,
  User
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import EmailAccountSetup from './email-account-setup'
import { EmailAccountEdit } from './email-account-edit'

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  isDefault: boolean
  status: 'active' | 'inactive' | 'error'
  createdAt: string
  updatedAt: string
}

interface EmailSettingsProps {
  onAccountChange?: () => void
}

export function EmailSettings({ onAccountChange }: EmailSettingsProps) {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null)
  const { toast } = useToast()

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
      } else {
        throw new Error('Failed to load email accounts')
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

  const handleAccountAdded = () => {
    setShowAddAccount(false)
    loadEmailAccounts()
    onAccountChange?.()
    toast({
      title: 'Success',
      description: 'Email account added successfully',
    })
  }

  const handleAccountUpdated = () => {
    setEditingAccount(null)
    loadEmailAccounts()
    onAccountChange?.()
    toast({
      title: 'Success',
      description: 'Email account updated successfully',
    })
  }

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email/accounts/${accountId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadEmailAccounts()
        onAccountChange?.()
        toast({
          title: 'Success',
          description: 'Email account deleted successfully',
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete account')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete email account',
        variant: 'destructive',
      })
    }
  }

  const handleSetDefault = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })

      if (response.ok) {
        loadEmailAccounts()
        onAccountChange?.()
        toast({
          title: 'Success',
          description: 'Default email account updated',
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to set default account')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set default account',
        variant: 'destructive',
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading email accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Email Settings</h2>
        </div>
        <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Email Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Email Account</DialogTitle>
            </DialogHeader>
            <EmailAccountSetup onSuccess={handleAccountAdded} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Email Accounts List */}
      {emailAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Email Accounts</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first email account to start sending and receiving emails.
            </p>
            <Button onClick={() => setShowAddAccount(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Email Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {emailAccounts.map((account) => (
            <Card key={account.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{account.displayName}</h3>
                        {account.isDefault && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.emailAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.status)}
                    {getStatusBadge(account.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>Added {new Date(account.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Server className="h-4 w-4" />
                      <span>Updated {new Date(account.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!account.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(account.id)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAccount(account)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Email Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the email account "{account.displayName}" ({account.emailAddress})?
                            This action cannot be undone and will remove all associated email data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAccount(account.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Account Dialog */}
      {editingAccount && (
        <Dialog open={!!editingAccount} onOpenChange={() => setEditingAccount(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Email Account</DialogTitle>
            </DialogHeader>
            <EmailAccountEdit
              accountId={editingAccount.id}
              onSuccess={handleAccountUpdated}
              onCancel={() => setEditingAccount(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
