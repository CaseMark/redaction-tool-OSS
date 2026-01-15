'use client';

import Link from 'next/link';
import { ShieldCheck } from '@phosphor-icons/react';
import { UsageProvider } from '@/lib/contexts/usage-context';
import { UsageBanner, LimitExceededDialog } from '@/components/demo';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UsageProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Dashboard Header */}
        <header className="border-b border-border bg-card sticky top-0 z-50">
          <div className="px-4 md:px-8 lg:px-12 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck size={24} weight="fill" className="text-primary" />
              <span className="font-semibold">Smart Redaction</span>
            </Link>

            {/* Usage Banner in header */}
            <div className="flex-1 max-w-md mx-4">
              <UsageBanner />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Limit Exceeded Dialog */}
        <LimitExceededDialog />
      </div>
    </UsageProvider>
  );
}
