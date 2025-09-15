"use client"

import { SessionProvider } from "next-auth/react"
import { ContactsProvider } from "@/lib/context/contacts-context"
import { ActivitiesProvider } from "@/lib/context/activities-context"
import { CallUIProvider } from "@/lib/context/call-ui-context"
import CallInProgressPopup from "@/components/call/call-in-progress-popup"

interface ProvidersProps {
  children: React.ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ContactsProvider>
        <ActivitiesProvider>
          <CallUIProvider>
            {children}
            {/* Global call popup */}
            <CallInProgressPopup />
          </CallUIProvider>
        </ActivitiesProvider>
      </ContactsProvider>
    </SessionProvider>
  )
}
