"use client"

import { Menu, Home, Users, MessageSquare, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileHeaderProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  setSidebarOpen: (open: boolean) => void
}

export default function MobileHeader({ activeTab, setActiveTab, setSidebarOpen }: MobileHeaderProps) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "messaging", label: "Text", icon: MessageSquare },
    { id: "import", label: "Import", icon: Upload },
  ]

  return (
    <div className="border-b">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <h1 className="text-lg font-bold">Adler Capital CRM</h1>
        <div className="w-9" />
      </div>
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 text-xs border-b-2 transition-colors ${
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
