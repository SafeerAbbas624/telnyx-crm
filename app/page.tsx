import { Suspense } from "react"
import Dashboard from "@/components/dashboard"
import { ProcessProvider } from "@/lib/context/process-context"
import { ContactsProvider } from "@/lib/context/contacts-context"
import { ActivitiesProvider } from "@/lib/context/activities-context"
import ClientWrapper from "@/components/client-wrappers"

export default function Home() {
  return (
    <ClientWrapper>
      <ProcessProvider>
        <ContactsProvider>
          <ActivitiesProvider>
            <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
              <Dashboard />
            </Suspense>
          </ActivitiesProvider>
        </ContactsProvider>
      </ProcessProvider>
    </ClientWrapper>
  )
}
