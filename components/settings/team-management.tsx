"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  User,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Briefcase
} from "lucide-react"

// Define available sections for role-based access
const AVAILABLE_SECTIONS = [
  { id: 'contacts', label: 'Contacts', description: 'View and manage contacts' },
  { id: 'tasks', label: 'Tasks', description: 'Task management' },
  { id: 'deals', label: 'Deals', description: 'Deal pipeline' },
  { id: 'loan-copilot', label: 'Loan Co-Pilot', description: 'Loan calculations' },
  { id: 'calls', label: 'Calls', description: 'Call history' },
  { id: 'text-center', label: 'Text Center', description: 'SMS messaging' },
  { id: 'power-dialer', label: 'Power Dialer', description: 'Auto-dialing campaigns' },
  { id: 'settings', label: 'Settings', description: 'Account settings' },
]

interface TeamUser {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
  role: 'ADMIN' | 'PROCESSOR' | 'ORIGINATOR'
  allowedSections: string[]
  allowedPhoneNumbers: string[]
  assignedPhoneNumber?: string
  assignedEmailId?: string
  assignedEmail?: {
    emailAddress: string
    displayName: string
  }
  createdAt: string
  lastLoginAt?: string
}

interface EmailAccount {
  id: string
  emailAddress: string
  displayName: string
  status: string
}

interface PhoneNumber {
  number: string
  status: string
}

export default function TeamManagement() {
  const { toast } = useToast()
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "PROCESSOR" as 'ADMIN' | 'PROCESSOR' | 'ORIGINATOR',
    allowedSections: [] as string[],
    allowedPhoneNumbers: [] as string[],
    assignedPhoneNumber: "",
    assignedEmailId: ""
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load team users
      const usersResponse = await fetch("/api/admin/team-users")
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setTeamUsers(usersData.users || [])
      }

      // Load email accounts
      const emailResponse = await fetch("/api/email/accounts")
      if (emailResponse.ok) {
        const emailData = await emailResponse.json()
        setEmailAccounts(emailData.accounts || [])
      }

      // Load phone numbers (from Telnyx)
      const phoneResponse = await fetch("/api/telnyx/numbers")
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json()
        setPhoneNumbers(phoneData.numbers || [])
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // For non-admin roles, require section selection
    if (formData.role !== 'ADMIN' && formData.allowedSections.length === 0) {
      setError("Please select at least one section for this user to access")
      return
    }

    try {
      const response = await fetch("/api/admin/team-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to create user")
        return
      }

      setIsCreateDialogOpen(false)
      resetFormData()
      loadData()
      toast({
        title: "Success",
        description: "Team user created successfully",
      })
    } catch (error) {
      setError("An error occurred while creating user")
    }
  }

  const resetFormData = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "PROCESSOR",
      allowedSections: [],
      allowedPhoneNumbers: [],
      assignedPhoneNumber: "",
      assignedEmailId: ""
    })
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError("")

    // For non-admin roles, require section selection
    if (formData.role !== 'ADMIN' && formData.allowedSections.length === 0) {
      setError("Please select at least one section for this user to access")
      return
    }

    try {
      const response = await fetch(`/api/admin/team-users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: formData.role,
          allowedSections: formData.allowedSections,
          allowedPhoneNumbers: formData.allowedPhoneNumbers,
          assignedPhoneNumber: formData.assignedPhoneNumber,
          assignedEmailId: formData.assignedEmailId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to update user")
        return
      }

      setIsEditDialogOpen(false)
      setEditingUser(null)
      loadData()
      toast({
        title: "Success",
        description: "Team user updated successfully",
      })
    } catch (error) {
      setError("An error occurred while updating user")
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/team-users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to delete user",
          variant: "destructive",
        })
        return
      }

      loadData()
      toast({
        title: "Success",
        description: "Team user deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while deleting user",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (user: TeamUser) => {
    setEditingUser(user)
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      role: user.role || "PROCESSOR",
      allowedSections: user.allowedSections || [],
      allowedPhoneNumbers: user.allowedPhoneNumbers || [],
      assignedPhoneNumber: user.assignedPhoneNumber || "",
      assignedEmailId: user.assignedEmailId || ""
    })
    setIsEditDialogOpen(true)
  }

  const handleInputChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleSection = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      allowedSections: prev.allowedSections.includes(sectionId)
        ? prev.allowedSections.filter(s => s !== sectionId)
        : [...prev.allowedSections, sectionId]
    }))
  }

  const togglePhoneNumber = (phoneNumber: string) => {
    setFormData(prev => ({
      ...prev,
      allowedPhoneNumbers: prev.allowedPhoneNumbers.includes(phoneNumber)
        ? prev.allowedPhoneNumbers.filter(p => p !== phoneNumber)
        : [...prev.allowedPhoneNumbers, phoneNumber]
    }))
  }

  const selectAllSections = () => {
    setFormData(prev => ({
      ...prev,
      allowedSections: AVAILABLE_SECTIONS.map(s => s.id)
    }))
  }

  const clearAllSections = () => {
    setFormData(prev => ({
      ...prev,
      allowedSections: []
    }))
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return <ShieldCheck className="h-4 w-4" />
      case 'PROCESSOR': return <Shield className="h-4 w-4" />
      case 'ORIGINATOR': return <Briefcase className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'PROCESSOR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'ORIGINATOR': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default: return ''
    }
  }

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">
            Create and manage team users with assigned resources
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Team User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Team User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    Generate
                  </Button>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'ADMIN' | 'PROCESSOR' | 'ORIGINATOR') => handleInputChange("role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-red-600" />
                        Admin - Full Access
                      </div>
                    </SelectItem>
                    <SelectItem value="PROCESSOR">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        Processor - Configurable Access
                      </div>
                    </SelectItem>
                    <SelectItem value="ORIGINATOR">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-green-600" />
                        Originator - Configurable Access
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Section Access (only for non-admin roles) */}
              {formData.role !== 'ADMIN' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Section Access</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllSections}>
                        Select All
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={clearAllSections}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                    {AVAILABLE_SECTIONS.map((section) => (
                      <div key={section.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`section-${section.id}`}
                          checked={formData.allowedSections.includes(section.id)}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                        <label
                          htmlFor={`section-${section.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {section.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phone Number Access (for non-admin roles) */}
              {formData.role !== 'ADMIN' && phoneNumbers.length > 0 && (
                <div className="space-y-3">
                  <Label>Allowed Phone Numbers</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                    {phoneNumbers.map((phone) => (
                      <div key={phone.number} className="flex items-center space-x-2">
                        <Checkbox
                          id={`phone-${phone.number}`}
                          checked={formData.allowedPhoneNumbers.includes(phone.number)}
                          onCheckedChange={() => togglePhoneNumber(phone.number)}
                        />
                        <label
                          htmlFor={`phone-${phone.number}`}
                          className="text-sm cursor-pointer font-mono"
                        >
                          {phone.number}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignedPhoneNumber">Default Phone Number</Label>
                  <Select
                    value={formData.assignedPhoneNumber}
                    onValueChange={(value) => handleInputChange("assignedPhoneNumber", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((phone) => (
                        <SelectItem key={phone.number} value={phone.number}>
                          {phone.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedEmailId">Email Account</Label>
                  <Select
                    value={formData.assignedEmailId}
                    onValueChange={(value) => handleInputChange("assignedEmailId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select email account" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailAccounts.map((email) => (
                        <SelectItem key={email.id} value={email.id}>
                          {email.displayName} ({email.emailAddress})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetFormData(); }}>
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Users List */}
      <div className="grid gap-4">
        {teamUsers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Team Users</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first team user to start collaborating
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team User
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          teamUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {user.firstName} {user.lastName}
                        </h3>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          <span className="flex items-center gap-1">
                            {getRoleIcon(user.role)}
                            {user.role}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {user.assignedPhoneNumber && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {user.assignedPhoneNumber}
                          </div>
                        )}
                        {user.assignedEmail && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {user.assignedEmail.emailAddress}
                          </div>
                        )}
                      </div>
                      {user.role !== 'ADMIN' && user.allowedSections?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {user.allowedSections.map((section) => (
                            <Badge key={section} variant="outline" className="text-xs">
                              {AVAILABLE_SECTIONS.find(s => s.id === section)?.label || section}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.status === "active" ? "default" : "secondary"}>
                      {user.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'ADMIN' | 'PROCESSOR' | 'ORIGINATOR') => handleInputChange("role", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-red-600" />
                      Admin - Full Access
                    </div>
                  </SelectItem>
                  <SelectItem value="PROCESSOR">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Processor - Configurable Access
                    </div>
                  </SelectItem>
                  <SelectItem value="ORIGINATOR">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-green-600" />
                      Originator - Configurable Access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Section Access (only for non-admin roles) */}
            {formData.role !== 'ADMIN' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Section Access</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllSections}>
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearAllSections}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                  {AVAILABLE_SECTIONS.map((section) => (
                    <div key={section.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-section-${section.id}`}
                        checked={formData.allowedSections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                      <label
                        htmlFor={`edit-section-${section.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {section.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phone Number Access (for non-admin roles) */}
            {formData.role !== 'ADMIN' && phoneNumbers.length > 0 && (
              <div className="space-y-3">
                <Label>Allowed Phone Numbers</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                  {phoneNumbers.map((phone) => (
                    <div key={phone.number} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-phone-${phone.number}`}
                        checked={formData.allowedPhoneNumbers.includes(phone.number)}
                        onCheckedChange={() => togglePhoneNumber(phone.number)}
                      />
                      <label
                        htmlFor={`edit-phone-${phone.number}`}
                        className="text-sm cursor-pointer font-mono"
                      >
                        {phone.number}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editAssignedPhoneNumber">Default Phone Number</Label>
                <Select
                  value={formData.assignedPhoneNumber}
                  onValueChange={(value) => handleInputChange("assignedPhoneNumber", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.number} value={phone.number}>
                        {phone.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editAssignedEmailId">Email Account</Label>
                <Select
                  value={formData.assignedEmailId}
                  onValueChange={(value) => handleInputChange("assignedEmailId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select email account" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map((email) => (
                      <SelectItem key={email.id} value={email.id}>
                        {email.displayName} ({email.emailAddress})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
