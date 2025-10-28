"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, User, Users } from "lucide-react"
import ProfileSettings from "./profile-settings"
import TeamManagement from "./team-management"

export default function SettingsPage() {
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
        <Tabs defaultValue="profile" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile Settings
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Management
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
          </div>
        </Tabs>
      </div>
    </div>
  )
}
