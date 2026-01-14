'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ShieldCheck, User, SignOut, Gear } from '@phosphor-icons/react';
import { useSession, signOut } from '@/lib/auth/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Dashboard Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="px-4 md:px-8 lg:px-12 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ShieldCheck size={24} weight="fill" className="text-primary" />
            <span className="font-semibold">Smart Redaction</span>
          </Link>

          <div className="flex items-center gap-4">
            {isPending ? (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-muted/80 transition-colors outline-none">
                  <User size={16} />
                  <span className="hidden sm:inline">{session.user.email}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="font-medium">{session.user.name || 'User'}</div>
                    <div className="text-muted-foreground text-xs">{session.user.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Gear size={16} />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <SignOut size={16} />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 rounded-4xl bg-primary px-3 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
