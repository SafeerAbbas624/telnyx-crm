'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import Footer from '@/components/footer';
import SequenceEditor from '@/components/sequences/sequence-editor';

export default function SequenceEditPage() {
  const params = useParams();
  const sequenceId = params.id as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Body: Sidebar + Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab="sequences"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-background">
            <SequenceEditor sequenceId={sequenceId} />
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}

