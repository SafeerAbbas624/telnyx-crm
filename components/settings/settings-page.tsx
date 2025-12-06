"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, User, Users, ListChecks, Phone, Mail, MessageSquare, Copy, FileText } from "lucide-react"
import ProfileSettings from "./profile-settings"
import TeamManagement from "./team-management"
import TaskTypesSettings from "./task-types-settings"
import TelnyxPhoneNumbers from "./telnyx-phone-numbers"
import { EmailSettings } from "@/components/email/email-settings"
import TemplatesSettings from "./templates-settings"
import DuplicateManagement from "./duplicate-management"
import CallScriptsSettings from "./call-scripts-settings"

const VALID_TABS = ['profile', 'team', 'task-types', 'templates', 'call-scripts', 'phone-numbers', 'email-accounts', 'duplicates']

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize from URL if valid, otherwise default to profile
    return tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'profile'
  })

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and team settings</p>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-8 max-w-7xl mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="task-types" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Task Types
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="call-scripts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Call Scripts
            </TabsTrigger>
            <TabsTrigger value="phone-numbers" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Numbers
            </TabsTrigger>
            <TabsTrigger value="email-accounts" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Accounts
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Duplicates
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="profile" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <ProfileSettings />
              </div>
            </TabsContent>
            <TabsContent value="team" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <TeamManagement />
              </div>
            </TabsContent>
            <TabsContent value="task-types" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <TaskTypesSettings />
              </div>
            </TabsContent>
            <TabsContent value="templates" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <TemplatesSettings />
              </div>
            </TabsContent>
            <TabsContent value="call-scripts" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <CallScriptsSettings />
              </div>
            </TabsContent>
            <TabsContent value="phone-numbers" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <TelnyxPhoneNumbers />
              </div>
            </TabsContent>
            <TabsContent value="email-accounts" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <EmailSettings />
              </div>
            </TabsContent>
            <TabsContent value="duplicates" className="h-full m-0">
              <div className="h-full overflow-y-auto">
                <DuplicateManagement />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
