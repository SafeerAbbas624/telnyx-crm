"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Phone, Zap } from "lucide-react"
import ManualDialingTab from "./manual-dialing-tab"
import PowerDialerTab from "./power-dialer-tab"

export default function CallsCenter() {
  const [activeTab, setActiveTab] = useState<'manual' | 'power'>('manual')

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Calls</h1>
        <p className="text-sm text-gray-600">Make calls and view call history</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <div className="bg-white border-b px-6 shrink-0">
          <TabsList className="bg-transparent border-b-0">
            <TabsTrigger
              value="manual"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
            >
              <Phone className="h-4 w-4 mr-2" />
              Manual Dialing
            </TabsTrigger>
            <TabsTrigger
              value="power"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
            >
              <Zap className="h-4 w-4 mr-2" />
              Power Dialer
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="manual" className="flex-1 m-0 min-h-0">
          <ManualDialingTab />
        </TabsContent>

        <TabsContent value="power" className="flex-1 m-0 min-h-0">
          <PowerDialerTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
