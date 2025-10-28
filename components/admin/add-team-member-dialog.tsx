"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye, EyeOff } from "lucide-react"

interface AddTeamMemberDialogProps {
  isOpen: boolean
  onClose: () => void
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

export default function AddTeamMemberDialog({ isOpen, onClose, onSuccess }: AddTeamMemberDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingResources, setIsFetchingResources] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    assignedPhoneNumber: "",
    assignedEmailId: "",
  })

  useEffect(() => {
    if (isOpen) {
      fetchResources()
      // Reset form when dialog opens
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        assignedPhoneNumber: "",
        assignedEmailId: "",
      })
    }
  }, [isOpen])

  const fetchResources = async () => {
    setIsFetchingResources(true)
    try {
      // Fetch available phone numbers
      const phoneResponse = await fetch('/api/admin/phone-numbers')
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json()
        setPhoneNumbers(phoneData.phoneNumbers || [])
      }

      // Fetch available email accounts
      const emailResponse = await fetch('/api/admin/email-accounts')
      if (emailResponse.ok) {
        const emailData = await emailResponse.json()
        setEmailAccounts(emailData.accounts || [])
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
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    if (!formData.assignedPhoneNumber || !formData.assignedEmailId) {
      toast({
        title: 'Validation Error',
        description: 'Please assign both phone number and email account',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/team-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create team member')
      }

      toast({
        title: 'Success',
        description: 'Team member created successfully',
      })

      onSuccess()
    } catch (error) {
      console.error('Error creating team member:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create team member',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>

        {isFetchingResources ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john.doe@example.com"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Phone Number Selection */}
              <div className="space-y-2">
                <Label htmlFor="phone">Assigned Phone Number *</Label>
                <Select 
                  value={formData.assignedPhoneNumber} 
                  onValueChange={(value) => handleChange('assignedPhoneNumber', value)}
                >
                  <SelectTrigger id="phone">
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.number}>
                        {phone.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Email Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="emailAccount">Assigned Email Account *</Label>
                <Select 
                  value={formData.assignedEmailId} 
                  onValueChange={(value) => handleChange('assignedEmailId', value)}
                >
                  <SelectTrigger id="emailAccount">
                    <SelectValue placeholder="Select an email account" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map((email) => (
                      <SelectItem key={email.id} value={email.id}>
                        {email.emailAddress} {email.displayName && `(${email.displayName})`}
                      </SelectItem>
                    ))}
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
                    Creating...
                  </>
                ) : (
                  'Add Team Member'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

