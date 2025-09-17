"use client"

import { SessionProvider } from "next-auth/react"
import { ContactsProvider } from "@/lib/context/contacts-context"
import { ActivitiesProvider } from "@/lib/context/activities-context"
import { CallUIProvider } from "@/lib/context/call-ui-context"
import CallInProgressPopup from "@/components/call/call-in-progress-popup"
import { NotificationsProvider } from "@/lib/context/notifications-context"
import GlobalEventsListener from "@/components/global-events-listener"

interface ProvidersProps {
  children: React.ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ContactsProvider>
        <ActivitiesProvider>
          <NotificationsProvider>
            <CallUIProvider>
              {children}
              {/* Global events listener for toasts/notifications */}
              <GlobalEventsListener />
              {/* Global call popup */}
              <CallInProgressPopup />
            </CallUIProvider>
          </NotificationsProvider>
        </ActivitiesProvider>
      </ContactsProvider>
    </SessionProvider>
  )
}
