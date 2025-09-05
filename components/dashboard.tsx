"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Sidebar from "./sidebar"
import MobileHeader from "./mobile-header"
import DashboardTabs from "./dashboard-tabs"
import Header from "./header"
import Footer from "./footer"
import { useMediaQuery } from "@/hooks/use-media-query"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const router = useRouter()
  const pathname = usePathname()

  const searchParams = useSearchParams()

  // Guard to initialize from URL only once to avoid race conditions
  const initializedRef = useRef(false)

  // Initialize from URL exactly once (on mount)
  useEffect(() => {
    if (initializedRef.current) return
    const url = new URL(window.location.href)
    const section = url.searchParams.get('section')
    const contactId = url.searchParams.get('contactId')

    if (section) setActiveTab(section)
    if (contactId) setSelectedContactId(contactId)

    initializedRef.current = true
  }, [])

  // Only update URL when user intentionally changes tabs (avoids stale writes)
  const handleSetActiveTab = useCallback((tab: string) => {
    setActiveTab(prev => {
      if (prev === tab) return prev
      const url = new URL(window.location.href)
      url.searchParams.set('section', tab)
      window.history.replaceState(null, '', url.toString())
      return tab
    })
  }, [])

  // Update active tab when URL search params change (e.g., from Header settings)
  useEffect(() => {
    if (!initializedRef.current) return
    const section = searchParams.get('section')
    if (section) setActiveTab(section)
  }, [searchParams])

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Desktop header spans full width */}
      {!isMobile && <Header />}

      {/* Body: Sidebar + Main content below header */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header (only on small screens) */}
          {isMobile && (
            <MobileHeader
              activeTab={activeTab}
              setActiveTab={handleSetActiveTab}
              setSidebarOpen={setSidebarOpen}
            />
          )}

          {/* Dashboard content */}
          <main className="flex-1 overflow-auto bg-background">
            <DashboardTabs
              activeTab={activeTab}
              setActiveTab={handleSetActiveTab}
              selectedContactId={selectedContactId}
            />
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  )
}
