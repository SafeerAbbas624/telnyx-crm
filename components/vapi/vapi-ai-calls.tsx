'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Phone, Settings, History, Key } from 'lucide-react'
import VapiApiKeyManager from './vapi-api-key-manager'
import VapiCallCenter from './vapi-call-center'
import VapiCallHistory from './vapi-call-history'
import VapiSettings from './vapi-settings'
import { useVapiStore } from '@/lib/stores/useVapiStore'

export default function VapiAiCalls() {
  const { activeTab, setActiveTab } = useVapiStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize store on mount
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Vapi AI Calls...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Phone className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Vapi AI Calls</h1>
            <p className="text-sm text-gray-600">Make AI-powered phone calls to your contacts</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as any)}
          className="h-full flex flex-col"
        >
          <TabsList className="w-full justify-start rounded-none border-b bg-white px-6 py-0">
            <TabsTrigger
              value="keys"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600"
            >
              <Key className="w-4 h-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger
              value="calls"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600"
            >
              <Phone className="w-4 h-4" />
              Make Calls
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600"
            >
              <History className="w-4 h-4" />
              Call History
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600"
            >
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="keys" className="h-full overflow-auto">
              <VapiApiKeyManager />
            </TabsContent>

            <TabsContent value="calls" className="h-full overflow-auto">
              <VapiCallCenter />
            </TabsContent>

            <TabsContent value="history" className="h-full overflow-auto">
              <VapiCallHistory />
            </TabsContent>

            <TabsContent value="settings" className="h-full overflow-auto">
              <VapiSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

