"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface TeamUser {
  id: string
  firstName: string
  lastName: string
  email: string
  assignedPhoneNumber?: string
  assignedEmailId?: string
  assignedEmail?: {
    id: string
    emailAddress: string
    displayName: string
  }
}

interface EditResourcesDialogProps {
  isOpen: boolean
  onClose: () => void
  user: TeamUser
  onSuccess: () => void
}

interface PhoneNumber {
  id: string
  number: string
}

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
}

export default function EditResourcesDialog({ isOpen, onClose, user, onSuccess }: EditResourcesDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingResources, setIsFetchingResources] = useState(true)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string>("")
  const [selectedEmail, setSelectedEmail] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      setSelectedPhone(user.assignedPhoneNumber || "")
      setSelectedEmail(user.assignedEmailId || "")
      fetchResources()
    }
  }, [isOpen, user])

  const fetchResources = async () => {
    setIsFetchingResources(true)
    try {
      // Fetch available phone numbers
      const phoneResponse = await fetch('/api/admin/phone-numbers')
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json()
        setPhoneNumbers(phoneData.phoneNumbers || [])
      } else {
        console.error('Failed to fetch phone numbers:', phoneResponse.status)
      }

      // Fetch available email accounts
      const emailResponse = await fetch('/api/admin/email-accounts')
      if (emailResponse.ok) {
        const emailData = await emailResponse.json()
        setEmailAccounts(emailData.accounts || [])
      } else {
        console.error('Failed to fetch email accounts:', emailResponse.status)
      }
    } catch (error) {
      console.error('Error fetching resources:', error)
      toast({
        title: 'Error',
        description: 'Failed to load available resources',
        variant: 'destructive',
      })
    } finally {
      setIsFetchingResources(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedPhone || !selectedEmail) {
      toast({
        title: 'Validation Error',
        description: 'Please select both phone number and email account',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/team-users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedPhoneNumber: selectedPhone,
          assignedEmailId: selectedEmail,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update resources')
      }

      toast({
        title: 'Success',
        description: 'Team member resources updated successfully',
      })

      onSuccess()
    } catch (error) {
      console.error('Error updating resources:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update resources',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Resources - {user.firstName} {user.lastName}</DialogTitle>
        </DialogHeader>

        {isFetchingResources ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Phone Number Selection */}
              <div className="space-y-2">
                <Label htmlFor="phone">Assigned Phone Number</Label>
                <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                  <SelectTrigger id="phone">
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No phone numbers available</div>
                    ) : (
                      phoneNumbers.map((phone) => (
                        <SelectItem key={phone.id} value={phone.number}>
                          {phone.number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Email Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="email">Assigned Email Account</Label>
                <Select value={selectedEmail} onValueChange={setSelectedEmail}>
                  <SelectTrigger id="email">
                    <SelectValue placeholder="Select an email account" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No email accounts available</div>
                    ) : (
                      emailAccounts.map((email) => (
                        <SelectItem key={email.id} value={email.id}>
                          {email.emailAddress} {email.displayName && `(${email.displayName})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Resources'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

