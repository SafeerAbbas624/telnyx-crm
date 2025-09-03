"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, User, Users } from "lucide-react"
import ProfileSettings from "./profile-settings"
import TeamManagement from "./team-management"

export default function SettingsPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and team settings
            </p>
          </div>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="profile" className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile Settings
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Management
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="profile" className="h-full m-0">
              <div className="h-full overflow-y-auto p-4">
                <ProfileSettings />
              </div>
            </TabsContent>
            <TabsContent value="team" className="h-full m-0">
              <div className="h-full overflow-y-auto p-4">
                <TeamManagement />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
