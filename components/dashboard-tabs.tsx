"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import ContactsRedesign from "./contacts-redesign"
import TextCenter from "./text/text-center"
import EmailCenter from "./email/email-center"
import DashboardOverviewFigma from "./dashboard-overview-figma"
import CallsCenter from "./calls/calls-center"
import BillingRedesign from "./billing/billing-redesign"
import SettingsPage from "./settings/settings-page"
import TeamOverview from "./admin/team-overview"
import DealsPipeline from "./deals/deals-pipeline"
import LoanCoPilot from "./loan-copilot/loan-copilot"
import Sequences from "./sequences/sequences"
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
        return <DashboardOverviewFigma />
      case "contacts":
        return <ContactsRedesign />
      case "deals":
        return <DealsPipeline />
      case "loan-copilot":
        return <LoanCoPilot />
      case "sequences":
        return <Sequences />
      case "messaging":
        return <TextCenter selectedContactId={selectedContactId} />
      case "email":
        return <EmailCenter selectedContactId={selectedContactId} />
      case "calls":
        return <CallsCenter />
      case "billing":
        return <BillingRedesign />
      case "import":
        return <ImportPage />
      case "team-overview":
        return <TeamOverview />
      case "settings":
        return <SettingsPage />
      default:
        return <DashboardOverviewFigma />
    }
  }

  return (
    <div className="h-full">
      {renderContent()}
    </div>
  )
}
