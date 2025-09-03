"use client"

import { SessionProvider } from "next-auth/react"
import { ContactsProvider } from "@/lib/context/contacts-context"
import { ActivitiesProvider } from "@/lib/context/activities-context"

interface ProvidersProps {
  children: React.ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ContactsProvider>
        <ActivitiesProvider>
          {children}
        </ActivitiesProvider>
      </ContactsProvider>
    </SessionProvider>
  )
}
