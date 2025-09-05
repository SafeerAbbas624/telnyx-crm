"use client"

import { Suspense } from "react"
import { ContactsProvider } from "@/lib/context/contacts-context"
import { ActivitiesProvider } from "@/lib/context/activities-context"
import { ProcessProvider } from "@/lib/context/process-context"
import Dashboard from "@/components/dashboard"

export default function DashboardPage() {
  return (
    <ContactsProvider>
      <ActivitiesProvider>
        <ProcessProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
            <Dashboard />
          </Suspense>
        </ProcessProvider>
      </ActivitiesProvider>
    </ContactsProvider>
  )
}
