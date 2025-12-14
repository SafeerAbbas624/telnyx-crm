"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
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
  Zap,
  CheckSquare,
  LucideIcon
} from "lucide-react"

interface SidebarProps {
  activeTab?: string
  setActiveTab?: (tab: string) => void
  isOpen?: boolean
  onClose?: () => void
}

type UserRole = 'ADMIN' | 'TEAM_USER'

interface MenuItem {
  id: string
  label: string
  icon: LucideIcon
  /** If set, only users with this role can see this menu item */
  requiredRole?: UserRole
}

/**
 * Filter menu items based on user role
 */
function filterMenuItemsByRole(items: MenuItem[], userRole?: string): MenuItem[] {
  return items.filter(item => {
    // If no requiredRole, show to everyone
    if (!item.requiredRole) return true
    // If requiredRole is set, only show to users with that role
    return item.requiredRole === userRole
  })
}

export default function Sidebar({ activeTab = "contacts", setActiveTab, isOpen = true, onClose }: SidebarProps) {
  const { data: session } = useSession()
  const userRole = session?.user?.role

  const allMenuItems: MenuItem[] = [
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "deals", label: "Deals", icon: Target },
    // Loan Co-Pilot removed - it's accessed via the Deals section now
    { id: "sequences", label: "Sequences", icon: Zap },
    { id: "messaging", label: "Text Center", icon: MessageSquare },
    { id: "email", label: "Email Center", icon: Mail },
    { id: "calls", label: "Calls", icon: Phone },
    // Admin-only items below
    { id: "billing", label: "Billing", icon: DollarSign, requiredRole: 'ADMIN' },
    { id: "import", label: "Import", icon: Upload, requiredRole: 'ADMIN' },
    { id: "team-overview", label: "Team", icon: UserCheck, requiredRole: 'ADMIN' },
    { id: "settings", label: "Settings", icon: Settings, requiredRole: 'ADMIN' },
  ]

  // Filter menu items based on user role
  const menuItems = filterMenuItemsByRole(allMenuItems, userRole)

  const router = useRouter()

  const handleTabClick = (tabId: string) => {
    // Special handling for pages with their own routes
    if (tabId === "contacts") {
      router.push("/contacts")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "import") {
      router.push("/import-v2")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "tasks") {
      router.push("/tasks")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "deals") {
      router.push("/deals")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "settings") {
      router.push("/settings")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "billing") {
      router.push("/billing")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "calls") {
      router.push("/calls")
      if (onClose) {
        onClose()
      }
      return
    }



    if (tabId === "sequences") {
      router.push("/sequences")
      if (onClose) {
        onClose()
      }
      return
    }

    if (tabId === "import") {
      router.push("/import-v2")
      if (onClose) {
        onClose()
      }
      return
    }

    // For dashboard sections (messaging, email, etc.), navigate to dashboard with section param
    if (setActiveTab) {
      setActiveTab(tabId)
      router.push(`/dashboard?section=${tabId}`)
      if (onClose) {
        onClose()
      }
    } else {
      // Otherwise, navigate to dashboard with section
      router.push(`/dashboard?section=${tabId}`)
      if (onClose) {
        onClose()
      }
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
