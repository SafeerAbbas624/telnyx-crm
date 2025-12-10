"use client"

import { Suspense } from "react"
// Note: ContactsProvider and ActivitiesProvider are already in root Providers
import { ProcessProvider } from "@/lib/context/process-context"
import Dashboard from "@/components/dashboard"
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat"

export default function DashboardPage() {
  // Send periodic heartbeat to track online status
  useActivityHeartbeat()

  return (
    <ProcessProvider>
      <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
        <Dashboard />
      </Suspense>
    </ProcessProvider>
  )
}
