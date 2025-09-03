"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ManualCalling from "@/components/call/manual-calling"
import PowerDialer from "@/components/call/power-dialer"
import CallHistory from "@/components/call/call-history"

export function CallCenter() {
  const [activeTab, setActiveTab] = useState("manual")

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Call Center</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="manual">Manual Calling</TabsTrigger>
            <TabsTrigger value="power">Power Dialer</TabsTrigger>
            <TabsTrigger value="history">Call History</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="manual" className="m-0">
              <ManualCalling />
            </TabsContent>
            <TabsContent value="power" className="m-0">
              <PowerDialer />
            </TabsContent>
            <TabsContent value="history" className="m-0">
              <CallHistory />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

export default CallCenter
