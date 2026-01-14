# UI Style Guide

A quick reference for adjacent apps to maintain visual consistency with the CaseMark design system.

## Typography

### Fonts

```css
/* Body text - Inter */
font-family: 'Inter', system-ui, sans-serif;

/* Headings - Instrument Serif (thin, elegant) */
font-family: 'Instrument Serif', 'Spectral', serif;

/* Code/Monospace - JetBrains Mono */
font-family: 'JetBrains Mono', monospace;
```

### Font Loading (Next.js)

```tsx
// layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// In <head>
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
  rel="stylesheet"
/>
```

### Heading Styles

The key to the elegant heading look is **thin font weight** with serif typography:

```tsx
// Hero heading - Large, thin, serif
<h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight">
  Your heading text here
</h1>

// Section heading - Medium, thin, serif
<h2 className="text-3xl md:text-4xl font-normal tracking-tight">
  Section title
</h2>

// Card/Component heading - Smaller, medium weight
<h3 className="text-lg font-medium">
  Component title
</h3>
```

**Important**: Use `font-normal` (400 weight) for large headings, NOT `font-bold`. The thin weight creates the elegant legal/professional aesthetic.

### Text Hierarchy

| Role | Classes | Example |
|------|---------|---------|
| Hero Title | `text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight` | Page hero |
| Section Title | `text-3xl md:text-4xl font-normal tracking-tight` | Major sections |
| Card Title | `text-lg font-medium` | Card headers |
| Body | `text-base text-foreground` | Paragraphs |
| Muted | `text-sm text-muted-foreground` | Secondary info |
| Caption | `text-xs text-muted-foreground` | Labels, hints |

---

## Color System

### Primary Colors (OKLCH)

```css
:root {
  /* Warm paper-like background */
  --background: oklch(0.97 0.008 80);

  /* Warm dark text */
  --foreground: oklch(0.18 0.02 60);

  /* White cards for elevation */
  --card: oklch(1 0 0);

  /* Bright orange primary - CaseMark brand */
  --primary: oklch(0.65 0.2 45);
  --primary-foreground: oklch(1 0 0);

  /* Warm secondary */
  --secondary: oklch(0.94 0.01 80);

  /* Warm muted tones */
  --muted: oklch(0.93 0.008 80);
  --muted-foreground: oklch(0.48 0.02 60);

  /* Warm borders */
  --border: oklch(0.88 0.015 70);

  /* Destructive red */
  --destructive: oklch(0.55 0.2 25);
}
```

### Dark Mode

```css
.dark {
  --background: oklch(0.14 0.01 60);
  --foreground: oklch(0.95 0.005 80);
  --card: oklch(0.18 0.012 60);
  --primary: oklch(0.7 0.2 45);
  --primary-foreground: oklch(0.14 0.01 60);
  --muted: oklch(0.22 0.01 60);
  --muted-foreground: oklch(0.65 0.01 70);
  --border: oklch(1 0 0 / 12%);
}
```

### Semantic Usage

```tsx
// Backgrounds
className="bg-background"    // Page background (warm sepia)
className="bg-card"          // Cards, elevated surfaces (white)
className="bg-muted"         // Subtle backgrounds
className="bg-primary"       // Primary buttons, accents

// Text
className="text-foreground"        // Primary text
className="text-muted-foreground"  // Secondary text
className="text-primary"           // Accent text, links
className="text-destructive"       // Error text

// Borders
className="border-border"    // Standard borders
```

---

## Layout Patterns

### Full-Width Header

```tsx
<header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
  <div className="px-4 md:px-8 lg:px-12 py-4 flex items-center justify-between">
    {/* Logo left, nav right */}
  </div>
</header>
```

### Centered Content Sections

```tsx
<section className="py-16 md:py-24 px-4 md:px-6">
  <div className="mx-auto max-w-4xl text-center">
    {/* Hero content */}
  </div>
</section>
```

### Card Grid

```tsx
<div className="grid md:grid-cols-3 gap-6">
  <div className="rounded-lg border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
    {/* Card content */}
  </div>
</div>
```

---

## Component Patterns

### Buttons

```tsx
// Primary CTA
<Link
  href="/signup"
  className="inline-flex items-center justify-center gap-1.5 rounded-4xl bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-all"
>
  Get Started
  <ArrowRight size={18} />
</Link>

// Secondary/Outline
<Link
  href="/login"
  className="inline-flex items-center justify-center gap-1.5 rounded-4xl border border-border bg-input/30 px-4 h-10 text-sm font-medium hover:bg-input/50 transition-all"
>
  Sign In
</Link>
```

**Key details:**
- `rounded-4xl` for pill-shaped buttons
- `h-9` (default), `h-10` (large)
- `gap-1.5` for icon spacing
- `transition-all` for smooth hover

### Cards (Paper-Like Design)

```tsx
// Standard card - NO shadows, border only
<div className="rounded-lg border border-border bg-card p-6">
  <h3 className="text-lg font-medium mb-2">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>

// Interactive card with hover
<div className="rounded-lg border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
  {/* Content */}
</div>
```

**Important**: Use `border` for elevation, NOT shadows. This creates the "paper-like" design.

### Feature Icons

```tsx
<div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
  <IconName size={24} className="text-primary" />
</div>
```

### Badges

```tsx
<Badge variant="secondary" className="mb-6">
  AI-Powered
</Badge>

<Badge variant="outline">
  Beta
</Badge>

<Badge>
  95%+
</Badge>
```

### Form Inputs

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
  />
  <p className="text-xs text-muted-foreground">Help text here</p>
</div>
```

---

## Spacing Scale

| Token | Size | Use |
|-------|------|-----|
| `gap-2` | 8px | Tight (icon+text) |
| `gap-3` | 12px | Button groups |
| `gap-4` | 16px | Standard |
| `gap-6` | 24px | Card grids, sections |
| `py-16 md:py-24` | 64-96px | Major sections |

### Page Padding

```tsx
// Header/full-width elements
className="px-4 md:px-8 lg:px-12"

// Centered content
className="px-4 md:px-6"
```

---

## Border Radius

- `rounded-lg` (8px) - Cards, inputs, containers
- `rounded-4xl` (2rem) - Buttons (pill shape)
- `rounded-full` - Avatars, icon containers

---

## Transitions

```tsx
// Standard hover transition
className="transition-colors"

// All properties (buttons)
className="transition-all"

// Specific timing
className="duration-200"
```

---

## Icons

Using **Phosphor Icons** (`@phosphor-icons/react`):

```tsx
import { ShieldCheck, ArrowRight, CheckCircle } from '@phosphor-icons/react';

// Standard size
<ShieldCheck size={24} className="text-primary" />

// Filled variant for emphasis
<CheckCircle size={16} weight="fill" className="text-primary" />

// In buttons
<ArrowRight size={18} />
```

---

## Quick Copy-Paste Examples

### Hero Section

```tsx
<section className="py-16 md:py-24 px-4 md:px-6">
  <div className="mx-auto max-w-4xl text-center">
    <Badge variant="secondary" className="mb-6">
      Your Badge Text
    </Badge>
    <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
      Your headline with{' '}
      <span className="text-primary">accent text</span>
    </h1>
    <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
      Your supporting description text goes here.
    </p>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
      <Link
        href="/signup"
        className="inline-flex items-center justify-center gap-1.5 rounded-4xl bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-all"
      >
        Primary CTA
        <ArrowRight size={18} />
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-1.5 rounded-4xl border border-border bg-input/30 px-4 h-10 text-sm font-medium hover:bg-input/50 transition-all"
      >
        Secondary CTA
      </Link>
    </div>
  </div>
</section>
```

### Feature Card

```tsx
<div className="rounded-lg border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
    <YourIcon size={24} className="text-primary" />
  </div>
  <h3 className="text-lg font-medium mb-2">Feature Title</h3>
  <p className="text-sm text-muted-foreground leading-relaxed">
    Feature description text explaining the benefit.
  </p>
</div>
```

### Auth Card Layout

```tsx
<div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
  <Link href="/" className="flex items-center gap-2 mb-8">
    <YourLogo size={32} weight="fill" className="text-primary" />
    <span className="text-xl font-semibold">App Name</span>
  </Link>
  <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
    <h1 className="text-2xl font-normal tracking-tight text-center mb-2">
      Welcome back
    </h1>
    <p className="text-sm text-muted-foreground text-center mb-6">
      Sign in to continue
    </p>
    {/* Form content */}
  </div>
</div>
```

---

## Design Principles Summary

1. **Thin serif headings** - Use `font-normal` with Instrument Serif for elegance
2. **Paper-like elevation** - Borders, not shadows
3. **Warm color palette** - Sepia backgrounds, orange accents
4. **Generous whitespace** - `py-16 md:py-24` for sections
5. **Pill-shaped buttons** - `rounded-4xl` for CTAs
6. **Subtle interactions** - `hover:border-foreground/20`, `transition-colors`
7. **Professional restraint** - Minimal decoration, let content breathe
