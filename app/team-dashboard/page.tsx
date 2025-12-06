"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * Legacy team-dashboard page - now redirects to the unified layout.
 * All users (admin and team) now use the same layout with role-based menu visibility.
 * This page exists to handle any old bookmarks or links.
 */
export default function TeamDashboardPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to unified contacts page
    router.replace("/contacts")
  }, [router])

  // Show loading spinner during redirect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  )
}
