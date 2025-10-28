"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Mail, 
  MessageSquare, 
  Phone, 
  Clock,
  Users,
  TrendingUp,
  MoreVertical
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"

// Sample sequences data
const SAMPLE_SEQUENCES = [
  {
    id: "1",
    name: "New Lead Nurture",
    status: "active",
    contacts: 45,
    steps: 5,
    completionRate: 68,
    steps_detail: [
      { type: "email", delay: 0, subject: "Welcome to our platform" },
      { type: "wait", delay: 2, subject: "Wait 2 days" },
      { type: "email", delay: 2, subject: "Getting started guide" },
      { type: "wait", delay: 3, subject: "Wait 3 days" },
      { type: "sms", delay: 5, subject: "Quick check-in" },
    ]
  },
  {
    id: "2",
    name: "Follow-up Sequence",
    status: "active",
    contacts: 32,
    steps: 4,
    completionRate: 75,
    steps_detail: [
      { type: "email", delay: 0, subject: "Thank you for your interest" },
      { type: "wait", delay: 1, subject: "Wait 1 day" },
      { type: "call", delay: 1, subject: "Personal follow-up call" },
      { type: "email", delay: 3, subject: "Additional resources" },
    ]
  },
  {
    id: "3",
    name: "Re-engagement Campaign",
    status: "paused",
    contacts: 18,
    steps: 6,
    completionRate: 42,
    steps_detail: [
      { type: "email", delay: 0, subject: "We miss you!" },
      { type: "wait", delay: 3, subject: "Wait 3 days" },
      { type: "sms", delay: 3, subject: "Special offer inside" },
      { type: "wait", delay: 2, subject: "Wait 2 days" },
      { type: "email", delay: 5, subject: "Last chance" },
      { type: "call", delay: 7, subject: "Personal outreach" },
    ]
  },
]

export default function Sequences() {
  const [searchQuery, setSearchQuery] = useState("")
  const [sequences, setSequences] = useState(SAMPLE_SEQUENCES)
  const [selectedSequence, setSelectedSequence] = useState<typeof SAMPLE_SEQUENCES[0] | null>(null)

  const getStepIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4 text-blue-600" />
      case "sms":
        return <MessageSquare className="h-4 w-4 text-green-600" />
      case "call":
        return <Phone className="h-4 w-4 text-purple-600" />
      case "wait":
        return <Clock className="h-4 w-4 text-gray-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Paused</Badge>
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Draft</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sequences</h1>
            <p className="text-muted-foreground">Automate your outreach with multi-channel sequences</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            New Sequence
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(sequence.status)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3 w-3" />
                      <span>Contacts</span>
                    </div>
                    <div className="text-2xl font-bold">{sequence.contacts}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Steps</span>
                    </div>
                    <div className="text-2xl font-bold">{sequence.steps}</div>
                  </div>
                </div>

                {/* Completion Rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion Rate</span>
                    <span className="font-medium">{sequence.completionRate}%</span>
                  </div>
                  <Progress value={sequence.completionRate} className="h-2" />
                </div>

                {/* Steps Preview */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Sequence Steps:</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {sequence.steps_detail.map((step, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <div className="p-1.5 rounded bg-muted">
                          {getStepIcon(step.type)}
                        </div>
                        {index < sequence.steps_detail.length - 1 && (
                          <div className="w-2 h-0.5 bg-border" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {sequence.status === "active" ? (
                    <Button variant="outline" size="sm" className="flex-1">
                      <Pause className="mr-2 h-3 w-3" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1">
                      <Play className="mr-2 h-3 w-3" />
                      Activate
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sequence Builder Section (Placeholder) */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sequence Builder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Create Your First Sequence</p>
              <p className="text-sm mb-4">Build automated multi-channel outreach campaigns</p>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Start Building
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Sequences Stats */}
        <div className="grid gap-4 md:grid-cols-3 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sequences</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sequences.filter(s => s.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently running
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sequences.reduce((sum, s) => sum + s.contacts, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                In all sequences
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(sequences.reduce((sum, s) => sum + s.completionRate, 0) / sequences.length)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all sequences
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

