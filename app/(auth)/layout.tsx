import Link from "next/link";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

/**
 * Auth Layout
 *
 * Minimal layout for authentication pages (login, signup, etc.)
 * No navigation or footer - just centered content with branding
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / Branding */}
      <Link href="/" className="flex items-center gap-2 mb-8 text-foreground hover:text-foreground/80 transition-colors">
        <ShieldCheck size={32} weight="fill" className="text-primary" />
        <span className="text-xl font-semibold">Smart Redaction</span>
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        {children}
      </div>
    </div>
  );
}
