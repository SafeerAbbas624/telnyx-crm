"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Target, 
  CheckCircle,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  MoreVertical
} from "lucide-react"
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { format } from "date-fns"

// Sample data for charts - will be replaced with real data
const revenueData = [
  { month: "Jan", revenue: 45000 },
  { month: "Feb", revenue: 52000 },
  { month: "Mar", revenue: 48000 },
  { month: "Apr", revenue: 61000 },
  { month: "May", revenue: 55000 },
  { month: "Jun", revenue: 67000 },
]

const dealsData = [
  { stage: "Lead", count: 24 },
  { stage: "Qualified", count: 18 },
  { stage: "Proposal", count: 12 },
  { stage: "Negotiation", count: 8 },
  { stage: "Closed", count: 15 },
]

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"]

interface DashboardStats {
  totalRevenue: number
  revenueChange: number
  totalDeals: number
  dealsChange: number
  totalContacts: number
  contactsChange: number
  conversionRate: number
  conversionChange: number
}

export default function DashboardOverviewNew() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 328500,
    revenueChange: 12.5,
    totalDeals: 77,
    dealsChange: 8.2,
    totalContacts: 1234,
    contactsChange: 5.4,
    conversionRate: 24.8,
    conversionChange: 3.2,
  })

  const [recentActivities, setRecentActivities] = useState([
    {
      id: "1",
      type: "call",
      contact: "Sarah Johnson",
      title: "Follow-up call scheduled",
      time: new Date(),
      status: "completed"
    },
    {
      id: "2",
      type: "email",
      contact: "Michael Chen",
      title: "Proposal sent",
      time: new Date(Date.now() - 3600000),
      status: "pending"
    },
    {
      id: "3",
      type: "meeting",
      contact: "David Park",
      title: "Contract negotiation",
      time: new Date(Date.now() - 7200000),
      status: "completed"
    },
  ])

  const [upcomingTasks, setUpcomingTasks] = useState([
    {
      id: "1",
      title: "Call Sarah Johnson",
      dueDate: new Date(),
      priority: "high",
      contact: "Sarah Johnson"
    },
    {
      id: "2",
      title: "Send proposal to Michael Chen",
      dueDate: new Date(Date.now() + 86400000),
      priority: "medium",
      contact: "Michael Chen"
    },
    {
      id: "3",
      title: "Follow up with David Park",
      dueDate: new Date(Date.now() + 172800000),
      priority: "low",
      contact: "David Park"
    },
  ])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4 text-blue-600" />
      case "email":
        return <Mail className="h-4 w-4 text-green-600" />
      case "meeting":
        return <Calendar className="h-4 w-4 text-purple-600" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          This Month
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
              <span className="text-green-600">+{stats.revenueChange}%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeals}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
              <span className="text-green-600">+{stats.dealsChange}%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
              <span className="text-green-600">+{stats.contactsChange}%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
              <span className="text-green-600">+{stats.conversionChange}%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Deals Pipeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Deals Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dealsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="stage" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities and Upcoming Tasks */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activities</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-4">
                  <div className="mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.contact}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <Badge variant={activity.status === "completed" ? "default" : "secondary"} className="text-xs">
                      {activity.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(activity.time, "h:mm a")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Tasks</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-start space-x-4">
                  <div className="mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.contact}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                      {task.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(task.dueDate, "MMM d")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

