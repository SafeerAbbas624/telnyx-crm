"use client"

import { ContactsProvider } from "@/lib/context/contacts-context"
import { ActivitiesProvider } from "@/lib/context/activities-context"
import { ProcessProvider } from "@/lib/context/process-context"
import Dashboard from "@/components/dashboard"

export default function DashboardPage() {
  return (
    <ContactsProvider>
      <ActivitiesProvider>
        <ProcessProvider>
          <Dashboard />
        </ProcessProvider>
      </ActivitiesProvider>
    </ContactsProvider>
  )
}
