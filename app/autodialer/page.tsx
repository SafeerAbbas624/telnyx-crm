'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import Footer from '@/components/footer';
import AutodialerPanel from '@/components/calls/autodialer-panel';

export default function AutodialerPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Body: Sidebar + Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab="autodialer"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden bg-background">
            <AutodialerPanel />
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}

