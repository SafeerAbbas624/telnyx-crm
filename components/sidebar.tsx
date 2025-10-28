"use client"

import {
  Home,
  Users,
  MessageSquare,
  Upload,
  Phone,
  DollarSign,
  Mail,
  Settings,
  UserCheck,
  Target,
  FileText,
  Zap
} from "lucide-react"

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
    { id: "deals", label: "Deals", icon: Target },
    { id: "loan-copilot", label: "Loan Co-Pilot", icon: FileText },
    { id: "sequences", label: "Sequences", icon: Zap },
    { id: "messaging", label: "Text Center", icon: MessageSquare },
    { id: "email", label: "Email Center", icon: Mail },
    { id: "calls", label: "Calls", icon: Phone },
    { id: "billing", label: "Billing", icon: DollarSign },
    { id: "import", label: "Import", icon: Upload },
    { id: "team-overview", label: "Team", icon: UserCheck },
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
    <div className={`h-full flex flex-col bg-[#f8f9fa] border-r border-gray-200 ${isOpen ? "block" : "hidden"} lg:block lg:w-64`}>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    activeTab === item.id
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
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
    </div>
  )
}
