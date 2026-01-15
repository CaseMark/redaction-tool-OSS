# Smart Redaction Tool

**AI-Powered PII Detection and Document Redaction**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)](https://tailwindcss.com)

A production-ready document redaction application that automatically detects and masks personally identifiable information (PII) using a combination of pattern matching and AI-powered detection.

## Overview

The Smart Redaction Tool helps users protect sensitive information in documents by:

1. **Uploading documents** - Supports PDF, DOCX, TXT, and image files
2. **Detecting PII** - Uses regex patterns and LLM-based detection to find sensitive data
3. **Reviewing redactions** - Interactive preview with manual redaction capabilities
4. **Exporting** - Download redacted documents as PDF, DOCX, or TXT

### Supported PII Types

- Social Security Numbers (SSN)
- Credit Card Numbers
- Bank Account Numbers
- Personal Names
- Physical Addresses
- Phone Numbers
- Email Addresses
- Dates of Birth

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) + [Shadcn UI](https://ui.shadcn.com)
- **Fonts**: Inter (body), Instrument Serif (headings), JetBrains Mono (code)
- **Icons**: [Phosphor Icons](https://phosphoricons.com)
- **Package Manager**: [Bun](https://bun.sh)
- **AI/OCR**: [Case.dev SDK](https://case.dev)
- **File Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Usage Tracking**: localStorage (client-side session isolation)

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd redaction-tool-demo
bun install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Configure your environment variables:

```env
# Case.dev SDK (required for LLM detection and OCR)
CASEDEV_API_KEY=sk_case_...
CASEDEV_API_URL=https://api.case.dev

# Vercel Blob (required for PDF/DOCX/Image processing)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Demo Limits
DEMO_SESSION_HOURS=24
DEMO_SESSION_PRICE_LIMIT=5
```

### 3. Run Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## API Pricing

The application uses the Case.dev API for LLM-based PII detection and OCR processing. Usage is metered based on the following rates:

### LLM Detection (PII Analysis)

| Metric | Cost |
|--------|------|
| Input Tokens | $3.00 per 1 million tokens |
| Output Tokens | $15.00 per 1 million tokens |

### OCR Processing (Document Extraction)

| Metric | Cost |
|--------|------|
| Per Page | $0.02 per page |

### Example Costs

| Operation | Typical Cost |
|-----------|--------------|
| 1-page PDF scan | ~$0.02 |
| PII detection (1000 words) | ~$0.01 |
| Full document processing | ~$0.05 - $0.15 |

## Demo Usage Limits

The application enforces usage limits for demo/trial access:

| Limit | Value |
|-------|-------|
| **Session Duration** | 24 hours |
| **Cost Limit** | $5.00 USD |

### How Limits Work

- Usage is tracked across all API operations (LLM detection + OCR)
- A progress banner displays current usage at 50%, 75%, and 90% thresholds
- When the $5 limit is reached, API operations are blocked

### Unlimited Access

To continue using the application beyond demo limits, create a free account at [console.case.dev](https://console.case.dev). Registered users receive:

- Unlimited document processing
- Advanced AI detection features
- Full export capabilities
- Team collaboration tools

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── detect-pii/     # PII detection endpoint
│   │   ├── extract/        # Document text extraction (OCR)
│   │   └── export-pdf/     # PDF export generation
│   ├── dashboard/          # Main redaction workflow
│   └── page.tsx            # Landing page
├── components/
│   ├── demo/               # Usage tracking UI
│   ├── redaction/          # Core redaction components
│   └── ui/                 # Shadcn UI primitives
├── lib/
│   ├── contexts/           # React contexts (usage tracking)
│   ├── export/             # Document export utilities
│   ├── redaction/          # Detection logic
│   └── usage/              # Usage tracking module
├── types/                  # TypeScript definitions
└── skills/                 # AI agent documentation
```

## Detection Methods

The application uses a multi-pass detection approach:

1. **Regex Patterns** - Fast, high-precision pattern matching for structured data (SSN, credit cards, etc.)
2. **LLM Detection** - AI-powered analysis for contextual PII (names, addresses)
3. **Retrospective Pass** - Second-pass review to catch missed items based on initial findings

## Export Formats

Redacted documents can be exported in three formats:

- **PDF** - Full document with redactions rendered as black boxes
- **DOCX** - Microsoft Word format with redacted text replaced
- **TXT** - Plain text with redactions applied

## License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

Built with [Case.dev](https://case.dev) - The Legal AI Platform
