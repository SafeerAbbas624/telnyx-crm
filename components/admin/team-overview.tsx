"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Users, Phone, Mail, User, Calendar, Activity, MessageSquare, PhoneCall, UserPlus, Settings } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import AssignContactModal from "./assign-contact-modal"
import { useContacts } from "@/lib/context/contacts-context"
import type { Contact } from "@/lib/types"

interface TeamUser {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
  assignedPhoneNumber?: string
  assignedEmailId?: string
  assignedEmail?: {
    id: string
    emailAddress: string
    displayName: string
  }
  assignedContactsCount: number
  createdAt: string
  lastLoginAt?: string
}

interface ContactAssignment {
  id: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email1?: string
    phone1?: string
  }
  assignedAt: string
}

interface TeamUserWithAssignments extends TeamUser {
  assignedContacts: ContactAssignment[]
  stats: {
    totalActivities: number
    totalMessages: number
    totalCalls: number
    totalEmails: number
  }
}

export default function TeamOverview() {
  const { toast } = useToast()
  const { contacts } = useContacts()
  const [teamUsers, setTeamUsers] = useState<TeamUserWithAssignments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<TeamUserWithAssignments | null>(null)

  useEffect(() => {
    loadTeamOverview()
  }, [])

  const loadTeamOverview = async () => {
    setIsLoading(true)
    try {
      // Load team users
      const usersResponse = await fetch('/api/admin/team-users')
      if (!usersResponse.ok) throw new Error('Failed to load team users')
      
      const usersData = await usersResponse.json()
      const users = usersData.users || []

      // Load assignments and stats for each user
      const usersWithData = await Promise.all(
        users.map(async (user: TeamUser) => {
          try {
            // Load user's assigned contacts
            const assignmentsResponse = await fetch(`/api/admin/assign-contacts?userId=${user.id}`)
            const assignmentsData = assignmentsResponse.ok ? await assignmentsResponse.json() : { assignments: [] }

            // Load user stats (you might want to create this API endpoint)
            const statsResponse = await fetch(`/api/admin/team-users/${user.id}/stats`)
            const statsData = statsResponse.ok ? await statsResponse.json() : { 
              stats: { totalActivities: 0, totalMessages: 0, totalCalls: 0, totalEmails: 0 }
            }

            return {
              ...user,
              assignedContacts: assignmentsData.assignments || [],
              stats: statsData.stats || { totalActivities: 0, totalMessages: 0, totalCalls: 0, totalEmails: 0 }
            }
          } catch (error) {
            console.error(`Error loading data for user ${user.id}:`, error)
            return {
              ...user,
              assignedContacts: [],
              stats: { totalActivities: 0, totalMessages: 0, totalCalls: 0, totalEmails: 0 }
            }
          }
        })
      )

      setTeamUsers(usersWithData)
    } catch (error) {
      console.error('Error loading team overview:', error)
      toast({
        title: 'Error',
        description: 'Failed to load team overview',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAssignment = async (userId: string, contactId: string) => {
    try {
      const response = await fetch(`/api/admin/assign-contacts?userId=${userId}&contactId=${contactId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove assignment')
      }

      toast({
        title: 'Success',
        description: 'Contact assignment removed successfully',
      })

      // Reload data
      loadTeamOverview()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove assignment',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Overview</h1>
          <p className="text-muted-foreground">
            Manage your team members, their resources, and client assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {teamUsers.length} Team Members
          </Badge>
        </div>
      </div>

      {teamUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Team Members</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create team members in Settings to start assigning contacts and resources.
            </p>
            <Button onClick={() => window.location.href = '/dashboard?tab=settings'}>
              <Settings className="h-4 w-4 mr-2" />
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {teamUsers.map((user) => (
            <Card key={user.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg font-semibold">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {user.firstName} {user.lastName}
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {user.status}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                        </span>
                        {user.lastLoginAt && (
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Last active {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AssignContactModal
                      contacts={contacts}
                      onAssignmentComplete={loadTeamOverview}
                      buttonVariant="outline"
                      buttonSize="sm"
                      buttonText="Assign Contacts"
                      trigger={
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign Contacts
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resources Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Assigned Resources
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">Phone Number</p>
                        <p className="text-xs text-muted-foreground">
                          {user.assignedPhoneNumber || 'Not assigned'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <Mail className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">Email Account</p>
                        <p className="text-xs text-muted-foreground">
                          {user.assignedEmail?.emailAddress || 'Not assigned'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Statistics Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Activity Statistics
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-center mb-1">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-lg font-semibold text-blue-600">{user.stats.totalActivities}</p>
                      <p className="text-xs text-blue-600">Activities</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-center mb-1">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                      </div>
                      <p className="text-lg font-semibold text-green-600">{user.stats.totalMessages}</p>
                      <p className="text-xs text-green-600">Messages</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center justify-center mb-1">
                        <PhoneCall className="h-4 w-4 text-purple-600" />
                      </div>
                      <p className="text-lg font-semibold text-purple-600">{user.stats.totalCalls}</p>
                      <p className="text-xs text-purple-600">Calls</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center justify-center mb-1">
                        <Mail className="h-4 w-4 text-orange-600" />
                      </div>
                      <p className="text-lg font-semibold text-orange-600">{user.stats.totalEmails}</p>
                      <p className="text-xs text-orange-600">Emails</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Assigned Contacts Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assigned Contacts ({user.assignedContacts.length})
                  </h4>
                  {user.assignedContacts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No contacts assigned</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {user.assignedContacts.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {assignment.contact.firstName[0]}{assignment.contact.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {assignment.contact.firstName} {assignment.contact.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {assignment.contact.email1 || assignment.contact.phone1}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(assignment.assignedAt), { addSuffix: true })}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAssignment(user.id, assignment.contact.id)}
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
