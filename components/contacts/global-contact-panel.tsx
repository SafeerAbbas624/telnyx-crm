"use client"

import { useContactPanel } from "@/lib/context/contact-panel-context"
import ContactSidePanel from "./contact-side-panel"

/**
 * Global contact side panel that can be opened from anywhere in the app
 * via the useContactPanel hook.
 */
export default function GlobalContactPanel() {
  const { contact, isOpen, closeContactPanel } = useContactPanel()

  return (
    <ContactSidePanel
      contact={contact}
      open={isOpen}
      onClose={closeContactPanel}
    />
  )
}

