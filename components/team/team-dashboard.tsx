"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Activity,
  MessageSquare,
  Mail,
  Phone,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  LogOut,
  Bell,
  Mail as MailIcon
} from "lucide-react"
import TeamActivities from "./team-activities"
import TeamConversations from "./team-conversations"
import { TeamEmailConversationsGmail } from "./team-email-conversations-gmail-new"
import TeamCallsCenter from "./team-calls-center-new"
import TeamContacts from "./team-contacts"
import { useToast } from "@/hooks/use-toast"
import { useNotifications } from "@/lib/context/notifications-context"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface DashboardStats {
  assignedContacts: number
  totalActivities: number
  pendingTasks: number
  completedTasks: number
  totalMessages: number
  totalEmails: number
  totalCalls: number
  thisWeekActivities: number
}

export default function TeamDashboard() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { items, unreadCount, markAllRead, clear } = useNotifications()
  const [tabValue, setTabValue] = useState<string>('activities')
  const [stats, setStats] = useState<DashboardStats>({
    assignedContacts: 0,
    totalActivities: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalMessages: 0,
    totalEmails: 0,
    totalCalls: 0,
    thisWeekActivities: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [emailAccounts, setEmailAccounts] = useState<any[]>([])

  useEffect(() => {
    loadDashboardStats()
    loadEmailAccounts()
    try {
      const desiredTab = localStorage.getItem('openTeamTab')
      if (desiredTab === 'conversations' || desiredTab === 'emails' || desiredTab === 'calls' || desiredTab === 'contacts' || desiredTab === 'activities') {
        setTabValue(desiredTab)
        localStorage.removeItem('openTeamTab')
      }
      // If a deep-link was set without the tab key, infer it
      if (!desiredTab) {
        if (localStorage.getItem('openConvContactId')) setTabValue('conversations')
        if (localStorage.getItem('openEmailContactId')) setTabValue('emails')
      }
    } catch {}
  }, [])

  const loadEmailAccounts = async () => {
    try {
      const response = await fetch('/api/team/assigned-email-accounts')
      if (response.ok) {
        const data = await response.json()
        setEmailAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error loading email accounts:', error)
    }
  }

  const loadDashboardStats = async () => {
    try {
      const response = await fetch('/api/team/dashboard-stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      toast({
        title: "Logging out...",
        description: "Please wait while we sign you out.",
      })

      await signOut({
        callbackUrl: "/auth/signin",
        redirect: true
      })
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Logout Error",
        description: "There was an error signing you out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const statCards = [
    {
      title: "Assigned Contacts",
      value: stats.assignedContacts,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Total Activities",
      value: stats.totalActivities,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Pending Tasks",
      value: stats.pendingTasks,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      title: "Completed Tasks",
      value: stats.completedTasks,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Messages Sent",
      value: stats.totalMessages,
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Emails Sent",
      value: stats.totalEmails,
      icon: Mail,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      title: "Calls Made",
      value: stats.totalCalls,
      icon: Phone,
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "This Week",
      value: stats.thisWeekActivities,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    }
  ]

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {session?.user?.name?.split(' ').map(n => n[0]).join('') || 'TU'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold">Welcome back, {session?.user?.name?.split(' ')[0]}</h1>
              <p className="text-sm text-muted-foreground">
                Team Member Dashboard • {session?.user?.assignedPhoneNumber && `Phone: ${session.user.assignedPhoneNumber}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              Active
            </Badge>
            {session?.user?.assignedEmail && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {session.user.assignedEmail.emailAddress}
              </Badge>
            )}

            {/* Notifications bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>
                    <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No notifications</div>
                ) : (
                  items.slice(0, 10).map((n) => (
                    <DropdownMenuItem key={n.id} className="cursor-pointer" onClick={() => {
                      try {
                        if (n.kind === 'sms') {
                          if (n.contactId) localStorage.setItem('openConvContactId', n.contactId)
                          localStorage.setItem('openTeamTab', 'conversations')
                        } else {
                          if (n.contactId) localStorage.setItem('openEmailContactId', n.contactId)
                          localStorage.setItem('openTeamTab', 'emails')
                        }
                        window.location.assign('/team-dashboard')
                      } catch {}
                    }}>
                      <div className="flex items-start gap-3 py-1">
                        {n.kind === 'sms' ? (
                          <MessageSquare className="h-4 w-4 mt-1 text-blue-600" />
                        ) : (
                          <MailIcon className="h-4 w-4 mt-1 text-emerald-600" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{n.contactName || n.fromEmail || 'Unknown'}</p>
                            {!n.read && <Badge variant="destructive">New</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{n.preview || ''}</p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? "..." : stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={tabValue} onValueChange={setTabValue} className="h-full flex flex-col">
          <div className="px-4 pt-4 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="activities" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activities
              </TabsTrigger>
              <TabsTrigger value="conversations" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="calls" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Calls
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contacts
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="activities" className="h-full m-0">
              <TeamActivities />
            </TabsContent>
            <TabsContent value="conversations" className="h-full m-0">
              <TeamConversations />
            </TabsContent>
            <TabsContent value="emails" className="h-full m-0">
              <TeamEmailConversationsGmail emailAccounts={emailAccounts} />
            </TabsContent>
            <TabsContent value="calls" className="h-full m-0">
              <TeamCallsCenter />
            </TabsContent>
            <TabsContent value="contacts" className="h-full m-0">
              <TeamContacts />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
