"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Phone, Mail, MessageSquare, UserPlus, Users2 } from "lucide-react"
import EditResourcesDialog from "./edit-resources-dialog"
import AddTeamMemberDialog from "./add-team-member-dialog"
import AssignContactsToTeamDialog from "./assign-contacts-to-team-dialog"

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

interface TeamUserWithStats extends TeamUser {
  stats: {
    calls: number
    messages: number
    emails: number
  }
}

export default function TeamOverview() {
  const { toast } = useToast()
  const [teamUsers, setTeamUsers] = useState<TeamUserWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [showEditResourcesDialog, setShowEditResourcesDialog] = useState(false)
  const [showAssignContactsDialog, setShowAssignContactsDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<TeamUserWithStats | null>(null)
  const [assigningToUser, setAssigningToUser] = useState<TeamUserWithStats | null>(null)

  // Helper function to check if user is online
  // User is online if their last activity (heartbeat) was within last 5 minutes
  const isUserOnline = (lastLoginAt?: string) => {
    if (!lastLoginAt) return false
    const lastLogin = new Date(lastLoginAt)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastLogin.getTime()) / (1000 * 60)
    // Consider online if activity within last 5 minutes (heartbeat runs every 2 minutes)
    return diffMinutes < 5
  }

  // Helper function to format last login time
  const formatLastLogin = (lastLoginAt?: string) => {
    if (!lastLoginAt) return 'Never'

    const lastLogin = new Date(lastLoginAt)
    const now = new Date()
    const diffMs = now.getTime() - lastLogin.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return lastLogin.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: lastLogin.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  useEffect(() => {
    loadTeamOverview()
  }, [])

  const loadTeamOverview = async () => {
    setIsLoading(true)
    try {
      // Load team users
      const usersResponse = await fetch('/api/admin/team-users')

      if (!usersResponse.ok) {
        const errorData = await usersResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load team users')
      }

      const usersData = await usersResponse.json()
      const users = usersData.users || []

      // Load stats for each user (last 30 days)
      const usersWithStats = await Promise.all(
        users.map(async (user: TeamUser) => {
          try {
            // Load user stats for last 30 days
            const statsResponse = await fetch(`/api/admin/team-users/${user.id}/stats?days=30`)
            const statsData = statsResponse.ok ? await statsResponse.json() : {
              stats: { calls: 0, messages: 0, emails: 0 }
            }

            return {
              ...user,
              stats: {
                calls: statsData.stats.totalCalls || 0,
                messages: statsData.stats.totalMessages || 0,
                emails: statsData.stats.totalEmails || 0
              }
            }
          } catch (error) {
            console.error(`Error loading stats for user ${user.id}:`, error)
            return {
              ...user,
              stats: { calls: 0, messages: 0, emails: 0 }
            }
          }
        })
      )

      setTeamUsers(usersWithStats)
    } catch (error) {
      console.error('Error loading team overview:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load team overview',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditResources = (user: TeamUserWithStats) => {
    setEditingUser(user)
    setShowEditResourcesDialog(true)
  }

  const handleResourcesUpdated = () => {
    setShowEditResourcesDialog(false)
    setEditingUser(null)
    loadTeamOverview()
  }

  const handleMemberAdded = () => {
    setShowAddMemberDialog(false)
    loadTeamOverview()
  }

  const handleAssignContacts = (user: TeamUserWithStats) => {
    setAssigningToUser(user)
    setShowAssignContactsDialog(true)
  }

  const handleContactsAssigned = () => {
    setShowAssignContactsDialog(false)
    setAssigningToUser(null)
    loadTeamOverview()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa]">
      {/* Header */}
      <div className="border-b bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Overview</h1>
            <p className="text-sm text-gray-600">Manage team members and their assigned resources</p>
          </div>
          <Button
            onClick={() => setShowAddMemberDialog(true)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {teamUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users2 className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Team Members</h3>
            <p className="text-sm text-gray-600 mb-6">
              Add team members to start assigning contacts and resources.
            </p>
            <Button
              onClick={() => setShowAddMemberDialog(true)}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teamUsers.map((user) => {
              const initials = `${user.firstName[0]}${user.lastName[0]}`
              const isOnline = isUserOnline(user.lastLoginAt)

              return (
                <Card key={user.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    {/* Avatar and Name */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12 bg-[#2563eb] text-white">
                          <AvatarFallback className="bg-[#2563eb] text-white text-base font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online/Offline Status Indicator */}
                        <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {user.firstName} {user.lastName}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isOnline
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Assigned Resources */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500">Assigned Phone</p>
                          <p className="text-sm text-gray-900 truncate">
                            {user.assignedPhoneNumber || 'Not assigned'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500">Assigned Email</p>
                          <p className="text-sm text-gray-900 truncate">
                            {user.assignedEmail?.emailAddress || 'Not assigned'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Activity Stats */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500">Activity (Last 30 Days)</p>
                        <p className="text-xs text-gray-500">
                          Last login: <span className="font-medium text-gray-700">{formatLastLogin(user.lastLoginAt)}</span>
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Phone className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{user.stats.calls}</p>
                          <p className="text-xs text-gray-500">Calls</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{user.stats.messages}</p>
                          <p className="text-xs text-gray-500">Messages</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Mail className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{user.stats.emails}</p>
                          <p className="text-xs text-gray-500">Emails</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Users2 className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{user.assignedContactsCount}</p>
                          <p className="text-xs text-gray-500">Contacts</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-sm"
                        onClick={() => handleAssignContacts(user)}
                      >
                        <Users2 className="h-4 w-4 mr-1" />
                        Assign Contacts
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-sm"
                        onClick={() => handleEditResources(user)}
                      >
                        Edit Resources
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Resources Dialog */}
      {editingUser && (
        <EditResourcesDialog
          isOpen={showEditResourcesDialog}
          onClose={() => {
            setShowEditResourcesDialog(false)
            setEditingUser(null)
          }}
          user={editingUser}
          onSuccess={handleResourcesUpdated}
        />
      )}

      {/* Add Team Member Dialog */}
      <AddTeamMemberDialog
        isOpen={showAddMemberDialog}
        onClose={() => setShowAddMemberDialog(false)}
        onSuccess={handleMemberAdded}
      />

      {/* Assign Contacts Dialog */}
      {assigningToUser && (
        <AssignContactsToTeamDialog
          isOpen={showAssignContactsDialog}
          onClose={() => {
            setShowAssignContactsDialog(false)
            setAssigningToUser(null)
          }}
          teamMember={assigningToUser}
          onSuccess={handleContactsAssigned}
        />
      )}
    </div>
  )
}
