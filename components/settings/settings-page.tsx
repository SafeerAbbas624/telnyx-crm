"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Settings, User, Users, ListChecks, Phone, Mail, MessageSquare, Copy, FileText, Clock, PhoneCall, Volume2 } from "lucide-react"
import ProfileSettings from "./profile-settings"
import TeamManagement from "./team-management"
import TaskTypesSettings from "./task-types-settings"
import TelnyxPhoneNumbers from "./telnyx-phone-numbers"
import { EmailSettings } from "@/components/email/email-settings"
import TemplatesSettings from "./templates-settings"
import DuplicateManagement from "./duplicate-management"
import CallScriptsSettings from "./call-scripts-settings"
import ScheduledMessagesSettings from "./scheduled-messages"
import DispositionsSettings from "./dispositions-settings"
import VoicemailMessagesSettings from "./voicemail-messages-settings"

const VALID_TABS = ['profile', 'team', 'task-types', 'templates', 'call-scripts', 'dispositions', 'voicemail-messages', 'phone-numbers', 'email-accounts', 'duplicates', 'scheduled']

// Define settings sections with their items
const settingsSections = [
  {
    id: 'account',
    label: 'Account',
    icon: User,
    items: [
      { id: 'profile', label: 'My Profile', icon: User },
      { id: 'team', label: 'Team Members', icon: Users },
    ]
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: Phone,
    items: [
      { id: 'phone-numbers', label: 'Phone Numbers', icon: Phone },
      { id: 'email-accounts', label: 'Email Accounts', icon: Mail },
      { id: 'templates', label: 'Message Templates', icon: MessageSquare },
      { id: 'scheduled', label: 'Scheduled Messages', icon: Clock },
    ]
  },
  {
    id: 'calling',
    label: 'Power Dialer',
    icon: PhoneCall,
    items: [
      { id: 'call-scripts', label: 'Call Scripts', icon: FileText },
      { id: 'dispositions', label: 'Dispositions', icon: PhoneCall },
      { id: 'voicemail-messages', label: 'Voicemail Messages', icon: Volume2 },
    ]
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: ListChecks,
    items: [
      { id: 'task-types', label: 'Task Types', icon: ListChecks },
    ]
  },
  {
    id: 'data',
    label: 'Data Management',
    icon: Copy,
    items: [
      { id: 'duplicates', label: 'Duplicate Detection', icon: Copy },
    ]
  },
]

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    return tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'profile'
  })

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Expand the section that contains the active tab
    for (const section of settingsSections) {
      if (section.items.some(item => item.id === activeTab)) {
        return [section.id]
      }
    }
    return ['account']
  })

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
      // Expand the section containing this tab
      for (const section of settingsSections) {
        if (section.items.some(item => item.id === tabFromUrl)) {
          setExpandedSections(prev => prev.includes(section.id) ? prev : [...prev, section.id])
          break
        }
      }
    }
  }, [tabFromUrl])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileSettings />
      case 'team': return <TeamManagement />
      case 'task-types': return <TaskTypesSettings />
      case 'templates': return <TemplatesSettings />
      case 'call-scripts': return <CallScriptsSettings />
      case 'dispositions': return <DispositionsSettings />
      case 'voicemail-messages': return <VoicemailMessagesSettings />
      case 'phone-numbers': return <TelnyxPhoneNumbers />
      case 'email-accounts': return <EmailSettings />
      case 'duplicates': return <DuplicateManagement />
      case 'scheduled': return <ScheduledMessagesSettings />
      default: return <ProfileSettings />
    }
  }

  // Get current section and item labels
  const getCurrentLabels = () => {
    for (const section of settingsSections) {
      const item = section.items.find(i => i.id === activeTab)
      if (item) return { section: section.label, item: item.label }
    }
    return { section: 'Settings', item: 'Profile' }
  }
  const { section: currentSection, item: currentItem } = getCurrentLabels()

  return (
    <div className="h-full flex bg-background">
      {/* Vertical Sidebar Navigation */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {settingsSections.map((section) => {
            const isExpanded = expandedSections.includes(section.id)
            const SectionIcon = section.icon
            const hasActiveItem = section.items.some(item => item.id === activeTab)

            return (
              <div key={section.id} className="mb-1">
                {/* Section Header (Collapsible) */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    hasActiveItem && "bg-accent/50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <SectionIcon className="h-4 w-4" />
                    {section.label}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="mt-1 ml-4 space-y-1">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon
                      const isActive = activeTab === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                          )}
                        >
                          <ItemIcon className="h-4 w-4" />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Header */}
        <div className="border-b bg-card px-6 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{currentSection}</p>
          <h2 className="text-2xl font-semibold">{currentItem}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
