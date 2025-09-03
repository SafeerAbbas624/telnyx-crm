"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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
  const searchParams = useSearchParams()

  // Handle URL parameters
  useEffect(() => {
    const section = searchParams.get('section')
    const contactId = searchParams.get('contactId')

    if (section) {
      setActiveTab(section)
    }

    if (contactId) {
      setSelectedContactId(contactId)
    }
  }, [searchParams])

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        {isMobile && <MobileHeader activeTab={activeTab} setActiveTab={setActiveTab} setSidebarOpen={setSidebarOpen} />}
        
        {/* Desktop header */}
        {!isMobile && <Header />}

        {/* Dashboard content */}
        <main className="flex-1 overflow-auto bg-background">
          <DashboardTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedContactId={selectedContactId}
          />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}
