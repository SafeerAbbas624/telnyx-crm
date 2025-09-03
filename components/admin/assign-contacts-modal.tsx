"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Users, Phone, Mail, CheckCircle } from "lucide-react"
import type { Contact } from "@/lib/types"

interface TeamUser {
  id: string
  firstName: string
  lastName: string
  email: string
  assignedPhoneNumber?: string
  assignedEmail?: {
    emailAddress: string
    displayName: string
  }
  assignedContactsCount: number
}

interface AssignContactsModalProps {
  contacts: Contact[]
  onAssignmentComplete: () => void
  trigger?: React.ReactNode
}

export default function AssignContactsModal({ 
  contacts, 
  onAssignmentComplete, 
  trigger 
}: AssignContactsModalProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadTeamUsers()
    }
  }, [isOpen])

  const loadTeamUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/team-users')
      if (response.ok) {
        const data = await response.json()
        setTeamUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error loading team users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleAssignContacts = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one team member',
        variant: 'destructive',
      })
      return
    }

    setIsAssigning(true)
    try {
      const response = await fetch('/api/admin/assign-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactIds: contacts.map(c => c.id),
          userIds: selectedUsers,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to assign contacts',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: `Successfully assigned ${contacts.length} contact(s) to ${selectedUsers.length} team member(s)`,
      })

      setIsOpen(false)
      setSelectedUsers([])
      onAssignmentComplete()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while assigning contacts',
        variant: 'destructive',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const defaultTrigger = (
    <Button variant="outline" className="flex items-center gap-2">
      <UserPlus className="h-4 w-4" />
      Assign to Team
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Contacts to Team
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Contacts Summary */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {contacts.length} Contact{contacts.length !== 1 ? 's' : ''} Selected
              </span>
            </div>
            <div className="text-xs text-blue-700">
              {contacts.slice(0, 3).map(contact => 
                `${contact.firstName} ${contact.lastName}`
              ).join(', ')}
              {contacts.length > 3 && ` and ${contacts.length - 3} more`}
            </div>
          </div>

          {/* Team Members List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Select Team Members:</h4>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : teamUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No team members available</p>
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {teamUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUsers.includes(user.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleUserToggle(user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.firstName[0]}{user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {user.firstName} {user.lastName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {user.assignedContactsCount} assigned
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {user.assignedPhoneNumber && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span className="truncate">{user.assignedPhoneNumber}</span>
                              </div>
                            )}
                            {user.assignedEmail && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{user.assignedEmail.emailAddress}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignContacts}
              disabled={isAssigning || selectedUsers.length === 0}
              className="flex items-center gap-2"
            >
              {isAssigning ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Assign Contacts
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
