"use client"

import { Home, Users, MessageSquare, Upload, Phone, DollarSign, Mail, Settings, UserCheck } from "lucide-react"

interface SidebarProps {
  activeTab?: string
  setActiveTab?: (tab: string) => void
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ activeTab = "dashboard", setActiveTab, isOpen = true, onClose }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "messaging", label: "Text Center", icon: MessageSquare },
    { id: "email", label: "Email Center", icon: Mail },
    { id: "calls", label: "Calls", icon: Phone },
    { id: "billing", label: "Billing", icon: DollarSign },
    { id: "import", label: "Import", icon: Upload },
    { id: "team-overview", label: "Team Overview", icon: UserCheck },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  const handleTabClick = (tabId: string) => {
    if (setActiveTab) {
      setActiveTab(tabId)
    }
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className={`h-full flex flex-col bg-card border-r ${isOpen ? "block" : "hidden"} lg:block lg:w-64`}>
      <div className="p-6">
        <h1 className="text-2xl md:text-3xl font-bold">Adler Capital CRM</h1>
      </div>
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Your Account</p>
            <p className="text-xs text-muted-foreground">Pro Plan</p>
          </div>
        </div>
      </div>
    </div>
  )
}
