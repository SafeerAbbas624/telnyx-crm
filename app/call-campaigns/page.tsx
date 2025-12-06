'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import Footer from '@/components/footer';
import CallCampaignList from '@/components/calls/call-campaign-list';

export default function CallCampaignsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Body: Sidebar + Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab="call-campaigns"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-background p-6">
            <CallCampaignList />
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}

