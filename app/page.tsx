import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Lightning,
  Eye,
  FileText,
  ArrowRight,
  CheckCircle,
} from '@phosphor-icons/react/dist/ssr';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 md:px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={28} weight="fill" className="text-primary" />
            <span className="font-semibold text-lg">Smart Redaction</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-4xl bg-primary px-3 h-9 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-all"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6">
            AI-Powered Document Protection
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
            Automatically detect and redact{' '}
            <span className="text-primary">sensitive information</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Protect personally identifiable information in your documents with intelligent
            AI detection. Review, customize, and export redacted documents in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-1.5 rounded-4xl bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-all"
            >
              Start Redacting Free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-4xl border border-border bg-input/30 px-4 h-10 text-sm font-medium hover:bg-input/50 transition-all"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-20 px-4 md:px-6 bg-card">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Three simple steps to protect sensitive information in your documents
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-lg border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">1. Upload Document</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upload PDFs, Word documents, or text files. Our OCR technology extracts
                text from scanned documents and images.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Eye size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">2. Review Detections</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI identifies SSNs, credit cards, addresses, names, and more. Review each
                detection and customize what gets redacted.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ShieldCheck size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">3. Export Safely</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Download your redacted document as PDF, Word, or text with a full audit
                log of all redactions for compliance documentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PII Types Section */}
      <section className="py-16 md:py-20 px-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-4">
              Comprehensive PII Detection
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our dual-detection system uses pattern matching and AI analysis to catch
              sensitive information others miss
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Social Security Numbers', example: '123-45-6789' },
              { label: 'Credit Card Numbers', example: '4111-XXXX-XXXX-1111' },
              { label: 'Bank Account Numbers', example: '123456789012' },
              { label: 'Personal Names', example: 'John Smith' },
              { label: 'Street Addresses', example: '123 Main St' },
              { label: 'Phone Numbers', example: '(555) 123-4567' },
              { label: 'Email Addresses', example: 'john@example.com' },
              { label: 'Dates of Birth', example: '01/15/1990' },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-card rounded-lg border border-border p-4 text-center hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle size={16} weight="fill" className="text-primary" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <code className="text-xs text-muted-foreground font-mono">{item.example}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detection Methods Section */}
      <section className="py-16 md:py-20 px-4 md:px-6 bg-card">
        <div className="mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                Multi-Pass Detection
              </Badge>
              <h2 className="text-3xl font-normal tracking-tight mb-4">
                AI + Pattern Matching
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Our system uses multiple detection passes to ensure nothing slips through:
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lightning size={16} weight="fill" className="text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Regex Pattern Matching</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fast, high-precision detection of structured data formats
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lightning size={16} weight="fill" className="text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">LLM Analysis</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI-powered semantic detection catches contextual PII
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lightning size={16} weight="fill" className="text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Retrospective Scan</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Second-pass review finds similar patterns to confirmed detections
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-background p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Detection Confidence</span>
                  <Badge>95%+</Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-[95%] bg-primary rounded-full" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our moderately aggressive approach prioritizes catching all sensitive
                  data, with human review to prevent false positives.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-4">
            Ready to protect your documents?
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Start redacting sensitive information in minutes. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-1.5 rounded-4xl bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-all"
          >
            Create Free Account
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 md:px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} weight="fill" className="text-primary" />
            <span className="text-sm text-muted-foreground">Smart Redaction Tool</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with Case.dev &middot; AI-powered legal technology
          </p>
        </div>
      </footer>
    </div>
  );
}
