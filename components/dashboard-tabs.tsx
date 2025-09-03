"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import ContactsSection from "./contacts/contacts-section"
import TextCenter from "./text/text-center"
import EmailCenter from "./email/email-center"
import DashboardOverview from "./dashboard-overview"
import CallsCenter from "./calls/calls-center"
import BillingDashboard from "./billing/billing-dashboard"
import SettingsPage from "./settings/settings-page"
import TeamOverview from "./admin/team-overview"
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";

// Dynamically import the ImportPage component with no SSR
const ImportPage = dynamic(() => import('@/app/import/page'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64">Loading...</div>
});

interface DashboardTabsProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  selectedContactId?: string | null
}

export default function DashboardTabs({ activeTab, setActiveTab, selectedContactId }: DashboardTabsProps) {
  const [contactCount, setContactCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContactCount = async () => {
      try {
        const response = await fetch('/api/contacts/count');
        if (!response.ok) {
          throw new Error('Failed to fetch contact count');
        }
        const data = await response.json();
        setContactCount(data.count);
      } catch (error) {
        console.error('Error fetching contact count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContactCount();
  }, []);

  // Render content based on activeTab without the tab header
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardOverview />
      case "contacts":
        return <ContactsSection />
      case "messaging":
        return <TextCenter selectedContactId={selectedContactId} />
      case "email":
        return <EmailCenter selectedContactId={selectedContactId} />
      case "calls":
        return <CallsCenter />
      case "billing":
        return <BillingDashboard />
      case "import":
        return <ImportPage />
      case "team-overview":
        return <TeamOverview />
      case "settings":
        return <SettingsPage />
      default:
        return <DashboardOverview />
    }
  }

  return (
    <div className="h-full">
      {renderContent()}
    </div>
  )
}
