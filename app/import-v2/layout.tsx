"use client"

import Providers from "@/components/providers"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { useMediaQuery } from "@/hooks/use-media-query"
import MobileHeader from "@/components/mobile-header"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ImportV2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const router = useRouter()

  const handleSetActiveTab = (tab: string) => {
    setSidebarOpen(false)
    if (tab === "dashboard") {
      router.push("/dashboard")
    } else if (tab === "contacts") {
      router.push("/contacts")
    } else if (tab === "import") {
      router.push("/import-v2")
    } else if (tab === "tasks") {
      router.push("/tasks")
    } else if (tab === "deals") {
      router.push("/deals")
    } else if (tab === "text") {
      router.push("/dashboard?section=text")
    } else if (tab === "email") {
      router.push("/dashboard?section=email")
    } else if (tab === "calls") {
      router.push("/calls")
    } else if (tab === "team-overview") {
      router.push("/dashboard?section=team-overview")
    } else if (tab === "admin") {
      router.push("/dashboard?section=admin")
    }
  }

  return (
    <Providers>
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Desktop header spans full width */}
        {!isMobile && <Header />}

        {/* Body: Sidebar + Main content below header */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            activeTab="import"
            setActiveTab={handleSetActiveTab}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header (only on small screens) */}
            {isMobile && (
              <MobileHeader
                activeTab="import"
                setActiveTab={handleSetActiveTab}
                setSidebarOpen={setSidebarOpen}
              />
            )}

            {/* Import content */}
            <main className="flex-1 overflow-auto bg-background">
              {children}
            </main>

            {/* Footer */}
            <Footer />
          </div>
        </div>
      </div>
    </Providers>
  )
}

