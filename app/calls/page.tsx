"use client"

import { useState } from "react"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import Footer from "@/components/footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Phone, ListOrdered } from "lucide-react"
import CallsCenterModern from "@/components/calls/calls-center-modern"
import PowerDialerListsManager from "@/components/calls/power-dialer-lists-manager"
import { useRouter } from "next/navigation"

export default function CallsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const handleStartDialing = (listId: string) => {
    // For now, just show a toast - we'll implement the actual dialer UI later
    console.log('[CALLS] Starting dialing for list:', listId)
    alert(`Starting dialer for list ${listId}. Dialer UI coming soon!`)
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Body: Sidebar + Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab="calls"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-background">
            <div className="h-full p-6">
              <Tabs defaultValue="manual" className="h-full flex flex-col">
                <TabsList className="mb-4 w-full justify-start">
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Manual Dialer
                  </TabsTrigger>
                  <TabsTrigger value="power-dialer" className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4" />
                    Power Dialer
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="flex-1 overflow-auto mt-0">
                  <CallsCenterModern />
                </TabsContent>

                <TabsContent value="power-dialer" className="flex-1 overflow-auto mt-0">
                  <PowerDialerListsManager onSelectList={handleStartDialing} />
                </TabsContent>
              </Tabs>
            </div>
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}

