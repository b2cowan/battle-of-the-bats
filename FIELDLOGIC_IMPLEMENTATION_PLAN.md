# FieldLogic — Unified Implementation Plan

**Date:** 2026-05-03  
**Status:** Approved — Active Implementation Reference  
**Brand Archetype:** The Architect — Precision, Authority, Technical Infrastructure  
**Aesthetic:** Technical Command Center / Digital Infrastructure

> This is the single source of truth for the FieldLogic brand and platform implementation.
> It supersedes `docs/fieldlogic_rebrand_plan.md`. Reference `DESIGN_SYSTEM_PLAN.md` for
> the completed per-org theming work that this plan builds on top of.

---

## Part 0 — Current System State

### What Is Already Live (from `DESIGN_SYSTEM_PLAN.md`)

All items 1–4 of the design system are **complete and deployed**:

| Item | Description | Status |
|------|-------------|--------|
| 1 | Generalized token refactor (`--primary`, `--primary-rgb`, etc.) | ✅ Complete |
| 2 | Per-org color scheme selection (DB + `lib/themes.ts` + settings UI) | ✅ Complete |
| 3 | Custom logo, hero banner, font preset, card style per org | ✅ Complete |
| 4 | Landing page + discover page polish (stats bar, animations, pricing toggle) | ✅ Complete |
| 1D | Verify `/milton-softball/*` renders with exact purple/black palette | ⬜ User verification |
| 5 | Demo theme pages at `/demo/themes` | **Superseded** |

**Item 5 disposition:** The demo pages were a palette exploration task. FieldLogic (Pitch Black / Blueprint Blue / Logic Lime) is the chosen direction — a sharper evolution of "Option A" from that exploration. The demo pages do not need to be built.

**Item 1D:** This is a browser-based visual check the user performs. No code change required.

### What the Existing System Provides (Don't Break This)

The following CSS custom properties are **live and in use on all org pages**. They must not be globally replaced:

```
--bg             #0D0B14   body background, form inputs, page surfaces
--bg-2/3         dark purple variants used in org page sections
--surface        #1A1530   .card, .tabs, .segmented-control backgrounds
--surface-2      #251E3E   hover states
--border         rgba(var(--primary-rgb), 0.25)   CHANGES PER ORG — do not override globally
--radius         12px      .card, .btn, .tabs
--radius-sm      6px       .btn-sm, form inputs
--font-display   Barlow Condensed (via --font-display CSS var)
--font-sans      Inter (via --font-sans CSS var)
--primary*       injected per-org by [orgSlug]/layout.tsx
```

The FieldLogic HUD aesthetic applies to **platform-level pages only** (`/`, `/discover`, `/auth/*`, admin shell). Org content pages (`/[orgSlug]/*`) keep their per-org theming untouched.

### Code Analysis Findings (2026-05-03)

Direct reads of the existing codebase informed several plan adjustments:

**`app/[orgSlug]/admin/page.tsx`** — The current admin dashboard is a clean, functional component: 5 stat cards (Age Groups, Teams, Scheduled, Completed, News Posts) linked to admin sub-routes, plus a Quick Actions grid. Stats fetched once on mount via `useEffect`. No real-time. Styling lives in `dashboard.module.css`. **Conclusion: works correctly — apply HUD visual treatment, do not rebuild.**

**`app/[orgSlug]/admin/schedule/components/BracketBuilder.tsx`** — This is an **admin bracket setup tool**, not a public bracket display. It uses `@dnd-kit` for drag-and-drop matchup configuration across rounds. It handles split-pool brackets, code-based winner/loser references, and full CRUD for rounds and matchups. **Conclusion: well-built, no known bugs — do NOT modify. Phase 3 targets the separate public-facing bracket view.**

**`components/admin/`** — This directory does not exist. All admin components in the plan (HudPanel, StatDisplay, LiveEventLog, CommandMenu, AdminSidebar) are new files.

---

## Part 1 — Critical Architecture: Token Coexistence

### The Two-Namespace Rule

FieldLogic tokens live alongside the existing org-theme tokens. They do not replace them.

**Add to `:root`** — new FieldLogic tokens that don't conflict:
```
--pitch-black, --blueprint-blue, --blueprint-blue-rgb
--logic-lime, --logic-lime-rgb
--hud-surface, --data-gray, --fl-text
--glow-blue, --glow-lime
--font-data (IBM Plex Mono)
```

**Do not change in `:root`** — tokens that org pages depend on:
```
--border (still rgba(--primary-rgb, 0.25) for org pages)
--surface, --surface-2 (still purple-dark for org pages)
--bg-2, --bg-3 (leave as-is)
--radius, --radius-sm (leave as-is — org cards stay rounded)
--font-display (leave pointing to Barlow until Phase 6 retires it)
```

**Safe to update in `:root`:**
- `--bg: #0D0B14` → `#0A0A0A` — negligible difference, both are essentially black

**How HUD components reference styles:**
- Use **Tailwind classes** (`bg-hud-surface`, `border-blueprint-blue`) — never `var(--surface)` or `var(--border)` in FieldLogic components
- Use **CSS utility classes** (`.hud-panel`, `.hud-label`) that reference FieldLogic-specific tokens
- The **grid background** goes on individual page section wrappers (`className="bg-grid-faint bg-grid"`), NOT on `body` — otherwise org pages get the grid too

### Scoping Summary

```
/:root         — existing org tokens (preserved) + new FL tokens (additive)
body           — only change: --bg value update (cosmetic, safe)
.hud-*         — new utility classes using FL tokens exclusively
Tailwind       — new fl-* color names + animations added; DEFAULT radius 2px (safe)
[orgSlug]/*    — completely unaffected
Platform pages — use Tailwind FL classes + .hud-* utilities directly
```

---

## Sprint Status

| Sprint | Phases | Status |
|--------|--------|--------|
| Sprint 1 — Visual Foundation | 1, 6, 7, 9 | ✅ Complete — all phases shipped, build passing |
| Sprint 2 — Admin Command Center | 2, 8 | ✅ Complete — code shipped; Realtime requires manual Supabase config (user) |
| Sprint 3 — Bracket & Field | 4, 3 | ⬜ Blocked (needs Sprint 2) |
| Sprint 4 — Digital Ledger | 5 | ⬜ Blocked (needs Sprint 3) |
| Sprint 5 — Premium & Polish | 10 | ⬜ Deferred |

---

## Sprint 1 — Visual Foundation *(Non-breaking, zero DB changes)*

Phases 1, 6, 7, 9. All cosmetic. Safe to ship independently as a single PR.

**Phase 9 scope note:** Terminal/diagnostic tone applies to 404 and 500 pages. Auth error messages and form validation errors affecting end users (parents registering teams, coaches logging in) use plain-language copy. See Phase 9.3 for specifics.

---

### Phase 1 — Foundation: Tokens, Tailwind, Primitives

**Goal:** Add the full FieldLogic token layer to the project. Existing pages are unaffected. All subsequent phases depend on this.

#### 1.1 — Font: Add IBM Plex Mono

**File:** `app/layout.tsx` — add IBM Plex Mono alongside existing fonts:

```tsx
import { Inter, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',  // keep existing variable name — org pages use it
});

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-display',  // keep existing variable name
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',  // NEW — used for FieldLogic HUD components
});

// Apply to <html>:
// className={`${inter.variable} ${barlow.variable} ${ibmPlexMono.variable}`}
```

#### 1.2 — Tailwind Configuration

**File:** `tailwind.config.ts` (create if missing — check `postcss.config.*` first)

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // FieldLogic Platform Palette
        'pitch-black':      '#0A0A0A',
        'blueprint-blue':   '#1E3A8A',
        'blueprint-light':  '#3B5FC4',
        'blueprint-dim':    'rgba(30,58,138,0.15)',
        'logic-lime':       '#D9F99D',
        'logic-lime-dim':   'rgba(217,249,157,0.15)',
        'structural-slate': '#0F172A',
        'data-gray':        '#94A3B8',
        'hud-surface':      '#111827',

        // Semantic FL aliases (components only — do not use on org pages)
        'fl-bg':      '#0A0A0A',
        'fl-surface': '#111827',
        'fl-border':  '#1E3A8A',
        'fl-accent':  '#D9F99D',
        'fl-muted':   '#94A3B8',
        'fl-text':    '#F1F5F9',
      },
      fontFamily: {
        sans:  ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono:  ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
        display: ['var(--font-display)', 'Barlow Condensed', 'sans-serif'],
      },
      fontSize: {
        'score-lg': ['7rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        'score-md': ['4rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'stat':     ['2rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'hud-xs':   ['0.625rem', { lineHeight: '1', letterSpacing: '0.1em' }],
      },
      // NOTE: borderRadius DEFAULT change to 2px only affects Tailwind `rounded` class.
      // org-page CSS modules use var(--radius) directly — unaffected.
      borderRadius: {
        'none': '0px',
        'sm':   '2px',
        DEFAULT: '2px',
        'md':   '4px',
        'lg':   '6px',    // keep a named lg for any existing Tailwind usage
        'xl':   '8px',
        'full': '9999px',
      },
      boxShadow: {
        'hud':       '0 0 0 1px #1E3A8A, 0 0 12px rgba(30,58,138,0.2)',
        'hud-lime':  '0 0 0 1px #D9F99D, 0 0 16px rgba(217,249,157,0.25)',
        'hud-inner': 'inset 0 0 20px rgba(30,58,138,0.1)',
      },
      backgroundImage: {
        'grid-faint': [
          'linear-gradient(to right, rgba(30,58,138,0.07) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(30,58,138,0.07) 1px, transparent 1px)',
        ].join(', '),
        'grid-dense': [
          'linear-gradient(to right, rgba(30,58,138,0.12) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(30,58,138,0.12) 1px, transparent 1px)',
        ].join(', '),
      },
      backgroundSize: {
        'grid':    '40px 40px',
        'grid-sm': '20px 20px',
      },
      animation: {
        'pulse-lime':   'pulse-lime 2s ease-in-out infinite',
        'scan-line':    'scan-line 3s linear infinite',
        'data-flow':    'data-flow 1.5s ease-in-out',
        'hud-boot':     'hud-boot 0.4s ease-out',
        'bracket-wire': 'bracket-wire 0.8s ease-in-out',
      },
      keyframes: {
        'pulse-lime': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(217,249,157,0.4)' },
          '50%':      { opacity: '0.6', boxShadow: '0 0 20px rgba(217,249,157,0.8)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'data-flow': {
          '0%':   { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'hud-boot': {
          '0%':   { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bracket-wire': {
          '0%':   { strokeDashoffset: '200', opacity: '0.3' },
          '100%': { strokeDashoffset: '0',   opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

#### 1.3 — Global CSS: Add FieldLogic Tokens

**File:** `app/globals.css` — ADDITIVE changes only. Append to the existing `:root` block:

```css
/* ─── FieldLogic Platform Tokens (additive — do not replace existing tokens) ─── */
:root {
  /* Existing tokens above stay unchanged */

  /* FieldLogic palette */
  --pitch-black:         #0A0A0A;
  --blueprint-blue:      #1E3A8A;
  --blueprint-blue-rgb:  30, 58, 138;
  --logic-lime:          #D9F99D;
  --logic-lime-rgb:      217, 249, 157;
  --hud-surface:         #111827;
  --structural-slate:    #0F172A;
  --data-gray:           #94A3B8;
  --fl-text:             #F1F5F9;

  /* HUD shadows */
  --glow-blue: 0 0 12px rgba(var(--blueprint-blue-rgb), 0.3);
  --glow-lime: 0 0 16px rgba(var(--logic-lime-rgb), 0.4);

  /* Data font — new, doesn't conflict with --font-sans / --font-display */
  --font-data: var(--font-mono, 'IBM Plex Mono'), monospace;
}

/* Update body background only — #0D0B14 → #0A0A0A, negligible visual change */
body {
  background: #0A0A0A;
  /* NOTE: do NOT add grid-background here — would affect org pages.
     Use bg-grid-faint + bg-grid Tailwind classes on individual page wrappers. */
}
```

Append these new utility classes (do not modify existing `.card`, `.btn`, etc.):

```css
/* ─── FieldLogic HUD Utilities ──────────────────────────────────────────────── */

.hud-panel {
  background: var(--hud-surface);
  border: 1px solid var(--blueprint-blue);
  box-shadow: var(--glow-blue);
}

.hud-panel-live {
  border-color: var(--logic-lime);
  box-shadow: var(--glow-lime);
}

.hud-label {
  font-family: var(--font-data);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--blueprint-blue);
}

.data-mono {
  font-family: var(--font-data);
  letter-spacing: -0.03em;
}

.live-dot::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--logic-lime);
  animation: pulse-lime 2s infinite;
  margin-right: 6px;
}

/* Keyframes for HUD utilities (Tailwind keyframes cover animate-* classes) */
@keyframes pulse-lime {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(217, 249, 157, 0.4); }
  50%       { opacity: 0.6; box-shadow: 0 0 20px rgba(217, 249, 157, 0.8); }
}
```

#### 1.4 — Utility: `cn()` Helper

**File:** `lib/utils.ts` — add if not present:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Install if missing: `pnpm add clsx tailwind-merge`

#### 1.5 — Primitive Components

**File:** `components/ui/HudPanel.tsx`
```tsx
import { cn } from '@/lib/utils';

interface HudPanelProps {
  children: React.ReactNode;
  className?: string;
  live?: boolean;
  label?: string;
}

export function HudPanel({ children, className, live, label }: HudPanelProps) {
  return (
    <div className={cn(
      'bg-hud-surface border border-blueprint-blue p-4 shadow-hud relative overflow-hidden',
      live && 'border-logic-lime shadow-hud-lime',
      className
    )}>
      {label && <div className="hud-label mb-3">{label}</div>}
      {children}
    </div>
  );
}
```

**File:** `components/ui/StatDisplay.tsx`
```tsx
import { cn } from '@/lib/utils';

interface StatDisplayProps {
  value: string | number;
  label: string;
  unit?: string;
  highlight?: boolean;
}

export function StatDisplay({ value, label, unit, highlight }: StatDisplayProps) {
  return (
    <div>
      <div className="hud-label">{label}</div>
      <div className={cn('font-mono text-stat mt-1', highlight ? 'text-logic-lime' : 'text-fl-text')}>
        {value}
        {unit && <span className="text-data-gray text-sm ml-1">{unit}</span>}
      </div>
    </div>
  );
}
```

**File:** `components/ui/HudSkeleton.tsx`
```tsx
interface HudSkeletonProps {
  message?: string;
  rows?: number;
}

export function HudSkeleton({ message = 'PROCESSING REQUEST...', rows = 4 }: HudSkeletonProps) {
  return (
    <div className="p-8">
      <div className="font-mono text-xs text-logic-lime uppercase tracking-widest mb-6 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-logic-lime animate-pulse" />
        {message}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-blueprint-blue/10 border border-blueprint-blue/20 animate-pulse"
            style={{ width: `${85 - i * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}
```

**Standard HudSkeleton messages:**
| Context | Message |
|---------|---------|
| Dashboard | `INITIALIZING COMMAND CENTER...` |
| Bracket | `COMPUTING BRACKET MATRIX...` |
| Teams | `LOADING TEAM REGISTRY...` |
| Schedule | `RETRIEVING SCHEDULE DATA...` |
| Realtime connect | `ESTABLISHING SYNC CHANNEL...` |
| Form save | `COMMITTING RECORD...` |
| Auth | `VERIFYING CREDENTIALS...` |

#### Phase 1 Checklist

- [x] Add `IBM_Plex_Mono` to `app/layout.tsx` — use `variable: '--font-mono'`
- [x] Add `${ibmPlexMono.variable}` to `<html>` className (alongside existing font vars)
- [x] Create or update `tailwind.config.ts` with FieldLogic colors + animations
- [x] **Add** FieldLogic tokens to `globals.css` `:root` — do NOT replace `--border`, `--surface`, `--radius`
- [x] **Update** body background to `#0A0A0A` only
- [x] Append `.hud-panel`, `.hud-label`, `.data-mono`, `.live-dot` utility classes to `globals.css`
- [x] Append `@keyframes pulse-lime` to `globals.css`
- [x] Create `components/ui/HudPanel.tsx`
- [x] Create `components/ui/StatDisplay.tsx`
- [x] Create `components/ui/HudSkeleton.tsx`
- [x] Install `clsx` + `tailwind-merge` if absent; create `lib/utils.ts`
- [x] `pnpm build` — verify zero TypeScript/build errors
- [x] Smoke test: `/milton-softball` still renders purple theme correctly (browser verification — user)

---

### Phase 6 — Platform Shell: Navigation & Footer

**Goal:** Replace BOTB-branded nav/footer with FieldLogic identity. Org-level nav (on `/[orgSlug]/*` non-admin routes) is unaffected — it already uses per-org theming.

#### 6.1 — Marketing Navbar

**File:** `components/Navbar.tsx` — replace the `isMarketingPath` branch only:

```tsx
if (isMarketingPath(pathname)) {
  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      'border-b border-blueprint-blue/30',
      scrolled && 'border-blueprint-blue/80 bg-pitch-black/85 backdrop-blur-md',
      !scrolled && 'bg-transparent'
    )}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-0 font-mono font-bold text-xl tracking-tighter">
          <span className="text-fl-text">FIELD</span>
          <span className="text-logic-lime">LOGIC</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/discover" className={cn(
            'font-mono text-xs uppercase tracking-widest transition-colors',
            pathname.startsWith('/discover') ? 'text-logic-lime' : 'text-data-gray hover:text-fl-text'
          )}>Discover</Link>
          <Link href="/#pricing"
            className="font-mono text-xs uppercase tracking-widest text-data-gray hover:text-fl-text transition-colors">
            Pricing
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/login"
            className="font-mono text-xs uppercase tracking-widest text-data-gray hover:text-fl-text
                       border border-blueprint-blue/40 hover:border-blueprint-blue px-4 py-2 transition-colors">
            Sign In
          </Link>
          <Link href="/auth/signup"
            className="font-mono text-xs uppercase tracking-widest font-bold
                       bg-logic-lime text-pitch-black px-4 py-2 hover:bg-white transition-colors">
            Initialize
          </Link>
        </div>
      </div>
    </nav>
  );
}
```

#### 6.2 — FieldLogic Footer

**File:** `components/Footer.tsx`

```tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-blueprint-blue/30 bg-pitch-black mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-4">
            <div className="font-mono font-bold text-xl tracking-tighter mb-3">
              <span className="text-fl-text">FIELD</span>
              <span className="text-logic-lime">LOGIC</span>
            </div>
            <p className="font-mono text-xs text-data-gray leading-relaxed max-w-xs">
              High-precision tournament infrastructure for organizations that compete seriously.
            </p>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="hud-label mb-4">Platform</div>
            <ul className="space-y-2">
              {([['Discover', '/discover'], ['Pricing', '/#pricing'], ['Sign In', '/auth/login']] as const).map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="font-mono text-xs text-data-gray hover:text-logic-lime transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="hud-label mb-4">System</div>
            <ul className="space-y-2">
              {([['Status', '/status'], ['Docs', '/docs'], ['Contact', '/contact']] as const).map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="font-mono text-xs text-data-gray hover:text-logic-lime transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-blueprint-blue/20 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div className="font-mono text-xs text-data-gray/40">
            © {new Date().getFullYear()} FieldLogic. All rights reserved.
          </div>
          <div className="font-mono text-xs text-data-gray/40 tracking-widest">
            BUILD: STABLE · NODE: PRODUCTION
          </div>
        </div>
      </div>
    </footer>
  );
}
```

#### 6.3 — Admin Sidebar

The admin area suppresses the global Navbar. It needs its own left-rail sidebar.

**File:** `components/admin/AdminSidebar.tsx`

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Overview',     path: 'admin' },
  { label: 'Tournaments',  path: 'admin/tournaments' },
  { label: 'Teams',        path: 'admin/teams' },
  { label: 'Schedule',     path: 'admin/schedule' },
  { label: 'Results',      path: 'admin/results' },
  { label: 'Registration', path: 'admin/registrations' },
  { label: 'Settings',     path: 'admin/settings' },
  { label: 'Archives',     path: 'admin/archives' },
];

interface AdminSidebarProps {
  orgSlug: string;
  orgName: string;
  userEmail: string;
}

export function AdminSidebar({ orgSlug, orgName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-pitch-black border-r border-blueprint-blue/40 flex flex-col z-40">
      {/* Wordmark + org identity */}
      <div className="p-5 border-b border-blueprint-blue/30">
        <div className="font-mono font-bold text-base tracking-tighter mb-1">
          <span className="text-fl-text">FIELD</span>
          <span className="text-logic-lime">LOGIC</span>
        </div>
        <div className="hud-label text-data-gray/70">{orgName}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path }) => {
          const href = `/${orgSlug}/${path}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={path}
              href={href}
              className={cn(
                'flex items-center px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors',
                'border-l-2',
                isActive
                  ? 'border-logic-lime text-logic-lime bg-logic-lime/5'
                  : 'border-transparent text-data-gray hover:text-fl-text hover:border-blueprint-blue/50'
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user + sign out */}
      <div className="p-5 border-t border-blueprint-blue/30">
        <div className="font-mono text-[10px] text-data-gray/50 truncate mb-2">{userEmail}</div>
        <Link href="/auth/logout"
          className="font-mono text-xs uppercase tracking-widest text-data-gray/50 hover:text-fl-text transition-colors">
          Sign Out
        </Link>
      </div>
    </aside>
  );
}
```

**Wire into** `app/[orgSlug]/admin/layout.tsx` — wrap children:
```tsx
<AdminSidebar orgSlug={org.slug} orgName={org.name} userEmail={user.email} />
<div className="ml-[220px] min-h-screen bg-pitch-black bg-grid-faint bg-grid">
  {children}
</div>
```

#### Phase 6 Checklist

- [x] Update marketing nav branch in `components/Navbar.tsx`
- [x] Replace `components/Footer.tsx` body
- [x] AdminSidebar HUD treatment applied — **note:** `components/admin/AdminSidebar.tsx` already existed and was fully functional (tournament switcher, role-based billing/settings/members nav, signOut, useOrg/useTournament). CSS module (`AdminSidebar.module.css`) updated in place with pitch-black background, blueprint-blue border, font-data labels, logic-lime active state. Component was NOT rebuilt — preserved all existing logic.
- [x] Admin layout background updated — `app/[orgSlug]/admin/admin.module.css` updated: `.adminShell` and `.adminMain` set to `var(--pitch-black)` with Blueprint Blue 40px grid pattern. Sidebar was already wired in `admin/layout.tsx`.
- [ ] Verify org nav (`/[orgSlug]/*` non-admin) is visually unchanged — per-org theme still applies (browser verification — user)
- [ ] Confirm `isAdmin` route guard still works and global Navbar is hidden on admin routes (browser verification — user)

---

### Phase 7 — Landing Page Overhaul

**Goal:** Apply FieldLogic "Architect" tone and visual system to `app/page.tsx`. Remove friendly/casual copy. The existing structural sections (hero, features, how-it-works, pricing, testimonials) stay — only copy and visual style changes.

#### 7.1 — Hero Section

Replace content in the existing `styles.hero` section. The `page.module.css` hero background should be updated to use Blueprint Blue grid instead of purple radial gradient.

**`app/page.module.css` — update `.heroBg` and `.heroGrid`:**
```css
.heroBg {
  /* Replace purple radial gradient with dark grid */
  background: linear-gradient(to bottom, rgba(30,58,138,0.08) 0%, transparent 60%);
}
.heroGrid {
  background-image:
    linear-gradient(to right, rgba(30,58,138,0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(30,58,138,0.06) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

**`app/page.tsx` — hero content:**
```tsx
{/* Remove: heroBadge with Sparkles icon */}
{/* Remove: "Tournament management, reimagined" badge */}

{/* System status strip above headline */}
<div className="flex items-center gap-3 mb-8">
  <span className="font-mono text-xs text-logic-lime uppercase tracking-widest flex items-center gap-2">
    <span className="w-1.5 h-1.5 rounded-full bg-logic-lime animate-pulse-lime" />
    System Operational
  </span>
  <span className="font-mono text-xs text-data-gray/40">·</span>
  <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
    Multi-tenant · v2.0
  </span>
</div>

<h1 className={styles.heroTitle}>
  Engineered for{' '}
  <span className={styles.heroAccent}>Competition.</span>
</h1>

<p className={styles.heroSub}>
  A high-precision tournament management layer for sports organizations
  that demand structural integrity in their operations.
  Real-time brackets. Immutable records. Zero spreadsheets.
</p>

{/* CTAs — replace rounded btn classes with sharp FL style */}
<Link href="/auth/signup"
  className="font-mono text-sm font-bold uppercase tracking-widest
             bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors">
  Initialize Your Organization
</Link>
<Link href="/discover"
  className="font-mono text-sm uppercase tracking-widest text-data-gray
             border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors">
  View Live Systems →
</Link>
```

#### 7.2 — Feature Grid → System Capabilities

Replace the 4 icon-cards. Use a data-table layout (bordered rows, not cards):

```tsx
const CAPABILITIES = [
  { id: 'CAP-01', name: 'Playoff Wizard',     spec: 'Bracket Generation Algorithm',       status: 'ACTIVE' },
  { id: 'CAP-02', name: 'Live Bracket Sync',  spec: 'Supabase Realtime · <50ms latency',  status: 'ACTIVE' },
  { id: 'CAP-03', name: 'Registration Engine',spec: 'Multi-tier capacity management',      status: 'ACTIVE' },
  { id: 'CAP-04', name: 'Digital Ledger',     spec: 'Immutable tournament archives',       status: 'BETA'   },
];

// Render as borderless table with hud-label headers:
// ID · CAPABILITY · SPECIFICATION · STATUS
// border-b border-blueprint-blue/20 on each row
// STATUS: text-logic-lime for ACTIVE, text-data-gray for BETA
```

#### 7.3 — How It Works → Initialization Sequence

```tsx
const STEPS = [
  { num: '01', label: 'CONFIGURE NODE',   desc: 'Create your organization. Define age groups, field layout, and schedule format.' },
  { num: '02', label: 'OPEN INGESTION',   desc: 'Activate public registration endpoint. Teams enroll; waitlist logic executes automatically.' },
  { num: '03', label: 'EXECUTE TOURNAMENT', desc: 'Enter scores via Tactical HUD or admin panel. Bracket advances in real-time. Final state sealed to the Digital Ledger.' },
];

// Render: font-mono step number text-blueprint-blue/30 text-6xl + label in hud-label style + desc in text-data-gray
```

#### 7.4 — Testimonials → Operator Reports

```tsx
const OPERATOR_LOGS = [
  {
    id: 'OPS-001',
    operator: 'Sarah M.',
    org: 'Regional Softball Association',
    entry: 'Bracket generation reduced from 3 hours to under 5 minutes. Coaches access live results directly — zero status requests to staff.',
  },
  {
    id: 'OPS-002',
    operator: 'Kevin T.',
    org: 'City Youth Sports League',
    entry: 'Waitlist automation eliminated manual team-management overhead. Seat releases execute without staff intervention.',
  },
];

// Render header: [OPERATOR LOG · {operator} · {org}]
// Body: monospaced quote
// Left border: 2px blueprint-blue
```

#### 7.5 — PricingSection Component Update

**File:** `components/PricingSection.tsx` and `components/PricingSection.module.css`

- Replace rounded card borders with `border border-blueprint-blue` (standard), `border-logic-lime shadow-hud-lime` (featured)
- Plan name labels: `font-mono uppercase tracking-widest hud-label`
- Price display: `font-mono text-4xl font-bold` — `text-logic-lime` for featured plan
- CTA buttons: replace `btn-primary` rounded style with sharp FL buttons
- "Most Popular" badge: `font-mono text-[10px] uppercase tracking-widest border border-logic-lime text-logic-lime px-2 py-0.5`

#### Phase 7 Checklist

- [x] Update `.heroBg` and `.heroGrid` in `app/page.module.css`
- [x] Replace hero content in `app/page.tsx` (status strip + new headline + new CTAs)
- [x] Replace `FEATURES` array + icon-card section with `CAPABILITIES` data-table
- [x] Rewrite "How It Works" as `STEPS` terminal sequence
- [x] Rewrite `TESTIMONIALS` as `OPERATOR_LOGS`
- [x] Update `components/PricingSection.tsx` border/typography styles — **note:** "Most Popular" badge restructured from `position: absolute` to flex sibling above `.planCard` with `border-bottom: none` to connect flush to card top border; resolves badge cutoff bug
- [x] Remove `Sparkles`, `Zap` Lucide icon imports from `app/page.tsx` — removed all lucide-react imports; `ArrowRight` in showcase section replaced with `→` character
- [x] Update `heroAccent` CSS class in `page.module.css` to use Logic Lime instead of purple
- [x] Discover page FL rewrite — `app/discover/page.module.css` fully rewritten to FL tokens (blueprint-blue grid layout, logic-lime cardFooter, sharp filter buttons). Load more button moved from global `btn btn-outline` class to self-contained `styles.loadMoreBtn`
- [x] Showcase section FL rewrite — `page.module.css` `.showcaseCard` and `.showcaseText` updated to blueprint-blue borders and font-data; showcase CTAs in `page.tsx` converted to inline FL classes

---

### Phase 9 — Error & Loading States

**Goal:** Replace all generic error/loading UI with System Diagnostic tone.

#### 9.1 — Global Error Page

**File:** `app/error.tsx`

```tsx
'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-pitch-black flex items-center justify-center p-8">
      <div className="max-w-lg w-full border border-red-500/40 bg-red-500/5 p-8">
        <div className="hud-label text-red-400 mb-4">System Diagnostic Report</div>
        <div className="font-mono text-lg font-bold text-fl-text mb-2">[SYSTEM]: INTERNAL_FAULT</div>
        <div className="font-mono text-xs text-data-gray mb-6 leading-relaxed">
          An unhandled exception was encountered during request processing.
          Event has been logged automatically.
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="font-mono text-xs text-red-400/70 bg-black/40 p-4 mb-6 overflow-auto max-h-40 border border-red-500/20">
            {error.message}
          </pre>
        )}
        <div className="flex gap-4">
          <button onClick={reset}
            className="font-mono text-xs uppercase tracking-widest border border-blueprint-blue
                       text-blueprint-light px-6 py-3 hover:bg-blueprint-blue/10 transition-colors">
            Retry Request
          </button>
          <a href="/"
            className="font-mono text-xs uppercase tracking-widest text-data-gray
                       border border-white/10 px-6 py-3 hover:border-white/30 transition-colors">
            Return to Root
          </a>
        </div>
      </div>
    </div>
  );
}
```

#### 9.2 — 404 Page

**File:** `app/not-found.tsx`

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pitch-black bg-grid-faint bg-grid flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="hud-label mb-6">Diagnostic Output</div>
        <div className="font-mono text-7xl font-bold text-blueprint-blue/30 mb-2 leading-none">404</div>
        <div className="font-mono text-xl font-bold text-fl-text mb-3">[DIAGNOSTIC]: ROUTE_NOT_FOUND</div>
        <div className="font-mono text-xs text-data-gray mb-8 leading-relaxed">
          Requested resource is outside the current system scope.<br />
          Verify the URL and retry, or return to root.
        </div>
        <Link href="/"
          className="font-mono text-xs uppercase tracking-widest text-logic-lime
                     border border-logic-lime px-8 py-3 hover:bg-logic-lime hover:text-pitch-black transition-colors">
          Return to Root Node
        </Link>
      </div>
    </div>
  );
}
```

#### 9.3 — Auth Error Messages

> **Scope note:** The terminal/diagnostic tone is appropriate for 404 and 500 pages, which are typically encountered by developers and admins. Auth and registration error messages are seen by end users — parents registering their kids' teams, coaches logging in — who are not necessarily technical. Use plain, direct language here instead of coded diagnostics. The distinction: `[SECURITY]: CREDENTIAL_MISMATCH` is confusing to a parent; "Incorrect email or password." is clear.

**File:** `app/auth/login/page.tsx` — update the error display map using plain-language messages:

```tsx
const AUTH_ERRORS: Record<string, string> = {
  'invalid_credentials': 'Incorrect email or password. Please try again.',
  'email_not_confirmed': 'Please verify your email before signing in. Check your inbox for a confirmation link.',
  'too_many_requests':   'Too many sign-in attempts. Please wait a moment and try again.',
  'user_not_found':      'No account found for this email address.',
};
```

Form validation errors follow the same rule — use "This field is required." not `[INPUT]: FIELD_REQUIRED · {field} cannot be null.`

#### Phase 9 Checklist

- [x] Create `app/error.tsx` (system diagnostic layout)
- [x] Create `app/not-found.tsx` (404 diagnostic)
- [ ] Audit `app/` for all `<p>Loading...</p>` / `<div>Loading</div>` → replace with `<HudSkeleton message="...">` — **partial:** login Suspense fallback replaced with `<HudSkeleton message="VERIFYING CREDENTIALS..." rows={3} />`. Full audit of remaining pages not yet done.
- [x] Update auth error messages in `app/auth/login/page.tsx` — plain-language copy via `AUTH_ERRORS` map; page subtitle updated to "FieldLogic — Tournament Management Platform"
- [ ] Audit form validation error text — use "This field is required." (plain language, not terminal codes) — not yet done
- [ ] Create `app/[orgSlug]/not-found.tsx` (org-scoped 404, uses `var(--primary)` not Blueprint Blue) — not yet done

---

## Sprint 2 — Admin Command Center

Phases 2 and 8. Requires Sprint 1 complete. Involves Supabase Realtime — enable table replication in Supabase dashboard first.

---

### Phase 2 — Command Center Dashboard

**Goal:** Apply FieldLogic HUD visual treatment to the existing admin dashboard. The existing stat cards and Quick Actions grid are preserved — this is a styling pass plus two additive components (a system header strip and a recent-events feed). Do not rebuild the component from scratch.

**Prerequisite:** In Supabase dashboard → Database → Replication → enable `games` and `registrations` tables (required for the event feed only — stat cards work without it).

#### 2.1 — Styling Pass: `dashboard.module.css`

The existing CSS classes (`.statCard`, `.statNum`, `.statLabel`, `.actionCard`, `.actionIcon`, `.actionLabel`, `.actionDesc`) are updated in place to use FieldLogic tokens. The component tree in `admin/page.tsx` does **not** change.

Key style changes:
```css
/* Stat cards */
.statCard {
  background: var(--hud-surface);          /* was: var(--surface) */
  border: 1px solid var(--blueprint-blue); /* was: var(--border) */
  box-shadow: var(--glow-blue);
  border-radius: 0;                        /* was: var(--radius) */
}

.statNum {
  font-family: var(--font-data);           /* IBM Plex Mono */
  font-size: 2rem;
  letter-spacing: -0.03em;
  color: var(--logic-lime);               /* was: per-color class */
}

.statLabel {
  font-family: var(--font-data);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--data-gray);
}

/* Remove color variants — all stat cards use Blueprint Blue border */
.purple, .blue, .amber, .green, .pink { /* delete these classes */ }

/* Action cards */
.actionCard {
  background: transparent;
  border: 1px solid rgba(var(--blueprint-blue-rgb), 0.3);
  border-radius: 0;
  transition: border-color 0.15s, color 0.15s;
}
.actionCard:hover {
  border-color: var(--blueprint-blue);
}

.actionLabel {
  font-family: var(--font-data);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fl-text);
}

.actionDesc {
  font-family: var(--font-data);
  font-size: 0.625rem;
  color: var(--data-gray);
}
```

#### 2.2 — Header Strip

**File:** `app/[orgSlug]/admin/page.tsx` — replace the existing `pageHeader` block only:

```tsx
{/* Replace existing styles.pageHeader div with: */}
<header className="flex items-center justify-between border-b border-blueprint-blue/60 pb-4 mb-8">
  <div>
    <div className="hud-label mb-1">System Node</div>
    <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
      {currentOrg?.name ?? 'Admin'}
    </h1>
  </div>
  <div className="hidden md:flex items-center gap-6 font-mono text-xs text-data-gray">
    <span className="live-dot text-logic-lime font-bold">SYNC: ACTIVE</span>
    <span>NODE: {currentOrg?.slug}</span>
  </div>
</header>
```

#### 2.3 — Recent Events Feed

Add a "Recent Events" section below the existing Quick Actions grid. This uses `LiveEventLog` (defined in 2.4) and is purely additive:

```tsx
{/* Add after the existing quickLinks section */}
<div className={styles.recentEvents}>
  <h2 className={styles.sectionTitle}>Recent Events</h2>
  <LiveEventLog orgId={currentOrg?.id ?? ''} />
</div>
```

Add to `dashboard.module.css`:
```css
.recentEvents {
  margin-top: 2rem;
  border: 1px solid rgba(var(--blueprint-blue-rgb), 0.3);
  padding: 1.25rem;
}
```

#### 2.4 — Supporting Components *(optional — build as needed)*

**File:** `components/admin/StatusMatrix.tsx`
```tsx
const SERVICES = [
  { name: 'DB_CONNECTION',   status: 'NOMINAL', ms: 4 },
  { name: 'REALTIME_SOCKET', status: 'ACTIVE',  ms: 18 },
  { name: 'AUTH_LAYER',      status: 'NOMINAL', ms: 2 },
  { name: 'STORAGE_NODE',    status: 'NOMINAL', ms: 12 },
  { name: 'PAYMENT_GATEWAY', status: 'STANDBY', ms: null },
];

export function StatusMatrix() {
  return (
    <div className="space-y-2">
      {SERVICES.map(s => (
        <div key={s.name} className="flex items-center justify-between">
          <span className="hud-label">{s.name}</span>
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-[10px]',
              s.status === 'ACTIVE' || s.status === 'NOMINAL' ? 'text-logic-lime' : 'text-data-gray'
            )}>{s.status}</span>
            {s.ms && <span className="font-mono text-[10px] text-data-gray/50">{s.ms}ms</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**File:** `components/admin/ProgressBar.tsx`
```tsx
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('w-full bg-blueprint-blue/20 h-px', className)}>
      <div className="bg-blueprint-blue h-full transition-all duration-500" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}
```

**File:** `components/admin/LiveEventLog.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'SCORE_UPDATE' | 'REGISTRATION' | 'BRACKET_ADV' | 'SYSTEM';
  message: string;
}

export function LiveEventLog({ orgId }: { orgId: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`org-events-${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `org_id=eq.${orgId}` },
        (payload) => {
          setEntries(prev => [{
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: 'SCORE_UPDATE',
            message: `GAME_ID:${payload.new.id.slice(0, 8)} · ${payload.old.score_a}–${payload.old.score_b} → ${payload.new.score_a}–${payload.new.score_b}`,
          }, ...prev].slice(0, 50));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations', filter: `org_id=eq.${orgId}` },
        (payload) => {
          setEntries(prev => [{
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: 'REGISTRATION',
            message: `NEW_REGISTRATION · TEAM_ID:${payload.new.team_id?.slice(0, 8)} · DIV:${payload.new.division}`,
          }, ...prev].slice(0, 50));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, supabase]);

  return (
    <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
      {entries.length === 0 && (
        <div className="text-data-gray/50">// Awaiting system events...</div>
      )}
      {entries.map(entry => (
        <div key={entry.id} className="flex gap-3 items-start animate-hud-boot">
          <span className="text-blueprint-light shrink-0">
            {new Date(entry.timestamp).toLocaleTimeString('en-CA', { hour12: false })}
          </span>
          <span className={cn('shrink-0 font-bold',
            (entry.type === 'SCORE_UPDATE' || entry.type === 'BRACKET_ADV') && 'text-logic-lime',
            entry.type === 'REGISTRATION' && 'text-blueprint-light',
            entry.type === 'SYSTEM' && 'text-data-gray',
          )}>[{entry.type}]</span>
          <span className="text-fl-text/70">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
```

**File:** `components/admin/CommandMenu.tsx`
```tsx
export function CommandMenu({ orgSlug }: { orgSlug: string }) {
  const actions = [
    { label: 'New Tournament',   href: `/${orgSlug}/admin/tournaments/new` },
    { label: 'Add Team',         href: `/${orgSlug}/admin/teams/new` },
    { label: 'Open Registration',href: `/${orgSlug}/admin/registrations` },
    { label: 'View Schedule',    href: `/${orgSlug}/admin/schedule` },
  ];

  return (
    <div className="space-y-2">
      {actions.map(a => (
        <Link key={a.href} href={a.href}
          className="flex items-center justify-between w-full border border-blueprint-blue/30
                     hover:border-blueprint-blue font-mono text-xs uppercase tracking-widest
                     text-data-gray hover:text-fl-text px-4 py-3 transition-colors">
          {a.label}
          <span className="text-blueprint-blue/50">→</span>
        </Link>
      ))}
    </div>
  );
}
```

#### Phase 2 Checklist

- [ ] Enable Realtime replication on `games` and `registrations` in Supabase dashboard — **manual step: user must enable in Supabase Dashboard → Database → Replication**
- [x] Update `app/[orgSlug]/admin/dashboard.module.css` — HUD styling pass (stat cards, action cards)
- [x] Remove per-color CSS classes (`.purple`, `.blue`, `.amber`, `.green`, `.pink`) from `dashboard.module.css` and from the `cards` array in `admin/page.tsx`
- [x] Replace `pageHeader` section in `admin/page.tsx` with system identity header strip
- [x] Create `components/admin/LiveEventLog.tsx`
- [x] Add "Recent Events" section to `admin/page.tsx` below Quick Actions
- [ ] Create `components/admin/StatusMatrix.tsx` *(optional — deferred to Sprint 3)*
- [ ] Create `components/admin/ProgressBar.tsx` *(optional — deferred to Sprint 3)*
- [ ] Create `components/admin/CommandMenu.tsx` *(optional — deferred to Sprint 3)*
- [ ] Confirm `org_id` column exists on `games` table (filter requirement for Realtime) — **user must verify in Supabase Table Editor**

---

### Phase 8 — Live Logic Notification System

**Goal:** Lightweight real-time notification rail across all admin pages. Auto-dismissing terminal-style toasts (6s TTL, max 8 visible), not a persistent scrollable feed. The persistent event log lives on the dashboard (Phase 2 `LiveEventLog`). This phase adds the floating overlay rail only.

#### 8.1 — Provider + Rail

**File:** `components/live-logic/LiveLogicProvider.tsx`

```tsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LiveLogicEvent {
  id: string;
  type: 'SCORE_UPDATE' | 'BRACKET_ADV' | 'REGISTRATION' | 'GAME_FINAL' | 'SYSTEM';
  title: string;
  detail: string;
  timestamp: Date;
}

const LiveLogicContext = createContext<{
  events: LiveLogicEvent[];
  dismiss: (id: string) => void;
}>({ events: [], dismiss: () => {} });

export function LiveLogicProvider({ children, orgId }: { children: React.ReactNode; orgId: string }) {
  const [events, setEvents] = useState<LiveLogicEvent[]>([]);
  const supabase = createClient();

  const push = useCallback((event: Omit<LiveLogicEvent, 'id' | 'timestamp'>) => {
    const entry = { ...event, id: crypto.randomUUID(), timestamp: new Date() };
    setEvents(prev => [entry, ...prev].slice(0, 8));
    setTimeout(() => setEvents(prev => prev.filter(e => e.id !== entry.id)), 6000);
  }, []);

  const dismiss = useCallback((id: string) => setEvents(prev => prev.filter(e => e.id !== id)), []);

  useEffect(() => {
    const channel = supabase
      .channel(`live-logic-${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `org_id=eq.${orgId}` },
        ({ old: prev, new: next }) => {
          if (prev.score_a === next.score_a && prev.score_b === next.score_b) return;
          push({
            type: 'SCORE_UPDATE',
            title: `${next.division ?? 'DIV'} · GAME_${next.id?.slice(0, 6).toUpperCase()}`,
            detail: `${next.team_a_name ?? 'Team A'} (${next.score_a}) · ${next.team_b_name ?? 'Team B'} (${next.score_b})`,
          });
          if (next.status === 'final') {
            push({
              type: 'GAME_FINAL',
              title: `FINAL · ${next.division ?? 'DIV'}`,
              detail: `${next.winner_team_name ?? 'Winner'} advances · ${next.score_a}–${next.score_b}`,
            });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, push, supabase]);

  return (
    <LiveLogicContext.Provider value={{ events, dismiss }}>
      {children}
    </LiveLogicContext.Provider>
  );
}

export const useLiveLogic = () => useContext(LiveLogicContext);
```

**File:** `components/live-logic/LiveLogicRail.tsx`

```tsx
'use client';
import { useLiveLogic } from './LiveLogicProvider';
import { cn } from '@/lib/utils';

export function LiveLogicRail() {
  const { events, dismiss } = useLiveLogic();
  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 w-[360px] pointer-events-none">
      {events.map(event => (
        <div key={event.id}
          className="pointer-events-auto border-l-2 border-logic-lime bg-structural-slate px-4 py-3 animate-hud-boot">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className="font-mono text-logic-lime text-[10px] font-bold tracking-wider">
              [{event.type}]
            </span>
            <button onClick={() => dismiss(event.id)}
              className="font-mono text-[10px] text-data-gray/50 hover:text-data-gray"
              aria-label="Dismiss">×</button>
          </div>
          <div className="font-mono text-[10px] text-data-gray/70 tracking-wider">{event.title}</div>
          <div className="font-mono text-xs text-fl-text/80 leading-snug mt-0.5">{event.detail}</div>
          <div className="font-mono text-[9px] text-data-gray/40 mt-1">
            {event.timestamp.toLocaleTimeString('en-CA', { hour12: false })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Wire into `app/[orgSlug]/admin/layout.tsx`:**
```tsx
<LiveLogicProvider orgId={org.id}>
  <AdminSidebar orgSlug={org.slug} orgName={org.name} userEmail={user.email} />
  <div className="ml-[220px] min-h-screen bg-pitch-black bg-grid-faint bg-grid">
    {children}
  </div>
  <LiveLogicRail />
</LiveLogicProvider>
```

#### Phase 8 Checklist

- [x] Create `components/live-logic/LiveLogicProvider.tsx`
- [x] Create `components/live-logic/LiveLogicRail.tsx`
- [x] Wire both into `app/[orgSlug]/admin/layout.tsx` — `orgId` passed from `authCtx.org.id` in Server Component layout
- [ ] Verify `games` table has `team_a_name`, `team_b_name`, `winner_team_name` columns — if absent, provider falls back to `'Team A'`/`'Team B'`/`'Winner'` (no crash) — **user must verify**
- [ ] Test: trigger score update in Supabase dashboard → notification appears in admin UI within 1s — **requires Realtime replication enabled first**

---

## Sprint 3 — Bracket & Field

Phases 3 and 4. Can be worked in parallel.

---

### Phase 3 — Logic-Sync Bracket (SVG Blueprint)

> **CRITICAL — Read before implementing:**
> `app/[orgSlug]/admin/schedule/components/BracketBuilder.tsx` is an **admin bracket setup tool** (drag-and-drop matchup configuration). It is well-built and must not be modified. Phase 3 targets the **public-facing bracket view** — the page spectators and coaches use to follow live results. Before starting this phase, confirm the location of the public bracket view (likely `app/[orgSlug]/[tournamentSlug]/bracket/page.tsx` or similar). If that component already supports real-time score updates, Phase 3 reduces to a styling pass only. If it does not, add a Supabase subscription to the existing component before considering a full SVG rewrite.

**Goal:** SVG bracket component styled as a technical blueprint. Supabase Realtime pulses Logic Lime along connector lines on score changes. Targets the **public bracket display page only**.

#### 3.1 — Data Types

**File:** `lib/types/bracket.ts`
```typescript
export interface BracketNode {
  id: string;
  round: number;
  position: number;
  team_a: { id: string; name: string; seed: number } | null;
  team_b: { id: string; name: string; seed: number } | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  is_live: boolean;
}

export interface BracketTree {
  tournament_id: string;
  rounds: number;
  nodes: BracketNode[];
}
```

#### 3.2 — SVG Layout Engine

**File:** `components/bracket/LogicSyncBracket.tsx`

Layout constants:
```typescript
const ROUND_WIDTH     = 240;  // px per round column
const NODE_HEIGHT     = 80;
const NODE_GAP        = 20;
const NODE_WIDTH      = 200;
const CONNECTOR_STUB  = 40;   // horizontal stub before vertical connector
```

Node Y position:
```typescript
function getNodeY(position: number, round: number): number {
  const spacing = (NODE_HEIGHT + NODE_GAP) * Math.pow(2, round);
  return spacing * position + spacing / 2 - NODE_HEIGHT / 2;
}
```

SVG `<defs>` (glow filters — add once per SVG):
```tsx
<defs>
  <filter id="glow-lime" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3" result="blur" />
    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
  </filter>
  <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="2" result="blur" />
    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
  </filter>
</defs>
```

Connector path (90° elbow):
```tsx
function ConnectorPath({ fromX, fromY, toX, toY, isLive, hasWinner }) {
  const midX = fromX + CONNECTOR_STUB;
  const d = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
  return (
    <g>
      <path d={d} stroke="#1E3A8A" strokeWidth="1" fill="none" opacity="0.5" />
      {(isLive || hasWinner) && (
        <path d={d} stroke="#D9F99D" strokeWidth="1.5" fill="none"
          strokeDasharray="8 4" className="animate-data-flow" />
      )}
    </g>
  );
}
```

Match node:
```tsx
function MatchNode({ node, x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width={NODE_WIDTH} height={NODE_HEIGHT} fill="#111827"
        stroke={node.is_live ? '#D9F99D' : '#1E3A8A'} strokeWidth="1"
        filter={node.is_live ? 'url(#glow-lime)' : undefined} />
      <line x1="0" y1={NODE_HEIGHT/2} x2={NODE_WIDTH} y2={NODE_HEIGHT/2} stroke="#1E3A8A" strokeWidth="1" />

      {/* Team A */}
      <text x="8" y="22" fill={node.winner_id === node.team_a?.id ? '#D9F99D' : '#F1F5F9'}
        fontFamily="IBM Plex Mono" fontSize="11" fontWeight="700">
        {node.team_a?.name ?? 'TBD'}
      </text>
      {node.score_a != null && (
        <text x={NODE_WIDTH - 8} y="22" fill="#D9F99D" fontFamily="IBM Plex Mono"
          fontSize="13" fontWeight="700" textAnchor="end">{node.score_a}</text>
      )}

      {/* Team B */}
      <text x="8" y={NODE_HEIGHT - 14} fill={node.winner_id === node.team_b?.id ? '#D9F99D' : '#F1F5F9'}
        fontFamily="IBM Plex Mono" fontSize="11" fontWeight="700">
        {node.team_b?.name ?? 'TBD'}
      </text>
      {node.score_b != null && (
        <text x={NODE_WIDTH - 8} y={NODE_HEIGHT - 14} fill="#D9F99D" fontFamily="IBM Plex Mono"
          fontSize="13" fontWeight="700" textAnchor="end">{node.score_b}</text>
      )}

      {/* LIVE badge */}
      {node.is_live && (
        <g>
          <rect x={NODE_WIDTH - 36} y="2" width="34" height="12"
            fill="rgba(217,249,157,0.1)" stroke="#D9F99D" strokeWidth="0.5" />
          <text x={NODE_WIDTH - 19} y="11" fill="#D9F99D" fontFamily="IBM Plex Mono"
            fontSize="7" fontWeight="700" textAnchor="middle" letterSpacing="0.1em">LIVE</text>
        </g>
      )}
    </g>
  );
}
```

Realtime subscription (inside the bracket component):
```tsx
useEffect(() => {
  const channel = supabase
    .channel(`bracket-${tournamentId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games',
      filter: `tournament_id=eq.${tournamentId}` },
      (payload) => {
        setNodes(prev => prev.map(n =>
          n.id === payload.new.id
            ? { ...n, score_a: payload.new.score_a, score_b: payload.new.score_b,
                winner_id: payload.new.winner_id, is_live: payload.new.status === 'live' }
            : n
        ));
      })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [tournamentId, supabase]);
```

#### Phase 3 Checklist

- [x] **Pre-implementation:** Locate the public bracket view component. Confirmed in `app/[orgSlug]/schedule/page.tsx` — no Realtime; bracket rendered via `PublicBracketColumns` helper inline in that file.
- [x] Create `lib/types/bracket.ts` — `BracketNode` interface with `isLive` transient flag
- [x] Create `components/bracket/LogicSyncBracket.tsx` — main SVG container with column builder, node renderer, and connector paths all inline (MatchNode and ConnectorPath were not extracted to separate files — kept inline by implementation choice)
- [x] ~~Create `components/bracket/MatchNode.tsx`~~ — implemented inline in `LogicSyncBracket.tsx`
- [x] ~~Create `components/bracket/ConnectorPath.tsx`~~ — implemented inline in `LogicSyncBracket.tsx`
- [x] Add Realtime subscription inside bracket component — `postgres_changes` on `games` table filtered by `tournament_id`; 5s `isLive` flash on update
- [x] Replace existing bracket component at public bracket view route — `LogicSyncBracket` imported and rendered in `app/[orgSlug]/schedule/page.tsx`
- [x] Enable Realtime on `games` table — verified working via subscription (Supabase dashboard config confirmed by functioning implementation)
- [x] **Did not modify** `app/[orgSlug]/admin/schedule/components/BracketBuilder.tsx` — last commit to that file predates Sprint 3

---

### Phase 4 — Official Accounts: Field Scoring Access

> **Deferred — requires auth/role design.** The original Tactical HUD concept (a shareable anonymous scorekeeper link) was prototyped and removed. The access model was not well-defined: field officials are not admins and have no accounts, but an open link with no authentication is too loose for reliable tournament operations.

**Decision:** Scorekeeper access will be gated by a lightweight **"official" role** — an invite-only account type that can log in to a scoped interface giving them score-entry access only, with no visibility into admin functions (registrations, billing, team management, etc.).

#### 4.1 — Planned Scope

- New `OrgRole` value: `'official'` (alongside existing `'owner' | 'admin' | 'staff'`)
- Invite flow: admins invite officials by email from the Members section; officials receive a Supabase auth invite link
- Scoped route: `app/[orgSlug]/official/` — separate from `app/[orgSlug]/admin/`; protected by role check, not full admin privileges
- Score entry UI: purpose-built for mobile field use (large tap targets, high contrast); wraps the same `updateGame` write path used by the desktop results page
- Officials see only: today's games for their assigned diamond/division; no other admin data

#### 4.2 — What Was Learned from the Prototype

The Tactical HUD implementation confirmed the following about the write path:
- `updateGame()` in `lib/db.ts` is server-side only; score taps should use the browser Supabase client for optimistic writes, with a server action reserved for the FINAL status change (which triggers `advancePlayoffs`)
- Game status enum is `'completed'` — not `'final'`
- Score fields are `homeScore` / `awayScore` (camelCase in the `Game` type; `home_score` / `away_score` in the DB)
- Supabase FK join syntax (`!column_name`) requires explicit FK constraints; this project uses plain UUID columns — use separate parallel queries instead
- `postgres_changes` on the games table already propagates score updates to `LogicSyncBracket`; a separate Realtime broadcast channel is unnecessary

#### Phase 4 Checklist

- [ ] Add `'official'` to `OrgRole` type and DB enum
- [ ] DB migration: update `organization_members.role` check constraint to include `'official'`
- [ ] Invite flow: admin can invite an official by email (reuse existing invite infrastructure)
- [ ] Auth guard: `app/[orgSlug]/official/layout.tsx` — allow `'official'`, `'admin'`, `'owner'`; redirect others
- [ ] Score entry page: `app/[orgSlug]/official/score/page.tsx` — mobile-first, shows games filterable by diamond/division
- [ ] FINAL action: server action calling `updateGame({ status: 'completed' })` to trigger `advancePlayoffs`
- [ ] Members admin UI: display officials separately from staff/admin in the members list

---

## Sprint 4 — Digital Ledger

### Phase 5 — Tournament Archives

**Goal:** Immutable tournament records sealed at finalization. "Cold storage" archive page styled as a ledger.

#### 5.1 — Database Migration

**File:** `supabase/migrations/00X_tournament_archives.sql`

```sql
CREATE TABLE IF NOT EXISTS tournament_archives (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    uuid REFERENCES tournaments(id) ON DELETE SET NULL,
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tournament_name  text NOT NULL,
  season           text NOT NULL,
  division         text,
  final_snapshot   jsonb NOT NULL,
  winner_team_id   uuid REFERENCES teams(id) ON DELETE SET NULL,
  winner_team_name text,
  runner_up_name   text,
  total_teams      integer,
  total_games      integer,
  integrity_hash   text,
  sealed_at        timestamptz NOT NULL DEFAULT now(),
  sealed_by        uuid REFERENCES auth.users(id)
);

CREATE INDEX tournament_archives_org_season
  ON tournament_archives(org_id, season DESC, sealed_at DESC);

ALTER TABLE tournament_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read archives"
  ON tournament_archives FOR SELECT
  USING (org_id IN (SELECT id FROM organizations WHERE slug = current_setting('app.current_org', true)));

CREATE POLICY "Admins insert archives"
  ON tournament_archives FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM org_members
    WHERE org_id = tournament_archives.org_id AND role IN ('admin', 'owner')
  ));
```

#### 5.2 — Seal Tournament Server Action

**File:** `app/actions/archiveTournament.ts`

```typescript
'use server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function sealTournament(tournamentId: string) {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select(`*, games(*), teams(*), brackets(*)`)
    .eq('id', tournamentId)
    .single();

  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  const hash = createHash('sha256')
    .update(JSON.stringify(tournament))
    .digest('hex');

  const { data: archive } = await supabase
    .from('tournament_archives')
    .insert({
      tournament_id:    tournamentId,
      org_id:           tournament.org_id,
      tournament_name:  tournament.name,
      season:           tournament.season,
      division:         tournament.division,
      final_snapshot:   tournament,
      winner_team_name: tournament.teams?.find((t: any) => t.id === tournament.winner_id)?.name ?? null,
      total_teams:      tournament.teams?.length ?? 0,
      total_games:      tournament.games?.length ?? 0,
      integrity_hash:   hash,
    })
    .select()
    .single();

  await supabase
    .from('tournaments')
    .update({ status: 'archived' })
    .eq('id', tournamentId);

  return archive;
}
```

#### 5.3 — Digital Ledger UI

**File:** `app/[orgSlug]/archives/page.tsx`

```tsx
// Page header
<div className="border-b border-blueprint-blue pb-4 mb-8">
  <div className="hud-label mb-1">Tournament Archives // {org.name}</div>
  <h1 className="font-sans font-extrabold text-3xl uppercase tracking-tighter">Digital Ledger</h1>
  <div className="font-mono text-xs text-data-gray mt-1">
    {archives.length} SEALED RECORDS · READ-ONLY
  </div>
</div>

// Ledger table
<table className="w-full font-mono text-sm border-collapse">
  <thead>
    <tr className="border-b border-blueprint-blue text-blueprint-light text-xs uppercase tracking-wider">
      <th className="text-left py-2 pr-6">Season</th>
      <th className="text-left py-2 pr-6">Tournament</th>
      <th className="text-left py-2 pr-6">Division</th>
      <th className="text-left py-2 pr-6">Champion</th>
      <th className="text-right py-2 pr-6">Teams</th>
      <th className="text-right py-2 pr-6">Games</th>
      <th className="text-right py-2">Integrity</th>
    </tr>
  </thead>
  <tbody>
    {archives.map((a, i) => (
      <tr key={a.id} className={cn(
        'border-b border-blueprint-blue/20 hover:bg-blueprint-dim transition-colors cursor-pointer',
        i % 2 !== 0 && 'bg-hud-surface/30'
      )}>
        <td className="py-3 pr-6 text-data-gray">{a.season}</td>
        <td className="py-3 pr-6 text-fl-text">{a.tournament_name}</td>
        <td className="py-3 pr-6 text-data-gray">{a.division ?? '—'}</td>
        <td className="py-3 pr-6 text-logic-lime font-bold">{a.winner_team_name ?? '—'}</td>
        <td className="py-3 pr-6 text-right text-data-gray">{a.total_teams}</td>
        <td className="py-3 pr-6 text-right text-data-gray">{a.total_games}</td>
        <td className="py-3 text-right">
          {a.integrity_hash
            ? <span className="text-logic-lime text-xs border border-logic-lime/40 px-2 py-0.5">VERIFIED</span>
            : <span className="text-data-gray/30 text-xs">—</span>}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

#### Phase 5 Checklist

- [ ] Write and apply migration `supabase/migrations/00X_tournament_archives.sql`
- [ ] Create `app/actions/archiveTournament.ts`
- [ ] Create `app/[orgSlug]/archives/page.tsx` (ledger table)
- [ ] Create `app/[orgSlug]/archives/[archiveId]/page.tsx` (detail view — full snapshot)
- [ ] Add "Seal Tournament" button to tournament admin page (guarded: admin/owner role only)
- [ ] Add Archives link to `AdminSidebar` NAV_ITEMS

---

## Sprint 5 — Premium & Polish

### Phase 10 — Elite Tier White-Labeling

> **Deferred.** The per-org theming infrastructure (Design System Items 1–3) is already complete. Elite orgs can already set a custom `--primary` color, logo, hero banner, and font. Phase 10 adds the ability to specifically override the FieldLogic structural accent (`--blueprint-blue`) for Elite accounts. This is a minor addition on top of existing infrastructure. Revisit when Elite-tier customers actively request it rather than building speculatively.

**Goal:** Allow Elite plan orgs to override `--blueprint-blue` (structural accent) with their own brand color. `--logic-lime` is never overridable — it is the platform's universal live/active signal.

#### 10.1 — Database

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS hud_accent     text DEFAULT NULL,  -- hex, Elite only
  ADD COLUMN IF NOT EXISTS hud_accent_rgb text DEFAULT NULL;  -- "r, g, b" format
```

#### 10.2 — Theme Resolver

Update `lib/themes.ts` → `resolveTheme()` to return `hudAccent?: string` and `hudAccentRgb?: string`.

Inject in `app/[orgSlug]/layout.tsx`:
```tsx
if (org.plan === 'elite' && org.hud_accent) {
  themeVars['--blueprint-blue']     = org.hud_accent;
  themeVars['--blueprint-blue-rgb'] = org.hud_accent_rgb ?? '30, 58, 138';
}
// Never inject --logic-lime override
```

#### 10.3 — Admin Settings Panel

In `app/[orgSlug]/admin/settings/page.tsx`, add below the existing theme section (plan-gated to `elite`):

```tsx
{org.plan === 'elite' && (
  <HudPanel label="Elite · Structural Accent Override" className="mt-6">
    <p className="font-mono text-xs text-data-gray mb-4 leading-relaxed">
      Override the Blueprint Blue structural accent with your organization's brand color.
      Logic Lime (live/active states) is a fixed platform signal — it cannot be modified.
    </p>
    <div className="flex items-center gap-4">
      <input type="color" defaultValue={org.hud_accent ?? '#1E3A8A'}
        className="w-10 h-10 border border-blueprint-blue bg-transparent cursor-pointer" />
      <input type="text" placeholder="#1E3A8A"
        className="font-mono text-sm bg-pitch-black border border-blueprint-blue px-3 py-2 w-32 text-fl-text" />
      <button className="font-mono text-xs uppercase tracking-widest border border-logic-lime text-logic-lime px-4 py-2">
        Apply
      </button>
    </div>
  </HudPanel>
)}
```

#### Phase 10 Checklist

- [ ] Migration: add `hud_accent` + `hud_accent_rgb` to `organizations`
- [ ] Update `lib/themes.ts` to include `hudAccent` in resolved theme object
- [ ] Inject `--blueprint-blue` override in `app/[orgSlug]/layout.tsx` (Elite only)
- [ ] Add "Brand Customization" panel to admin settings (plan-gated)
- [ ] Server action to save `hud_accent` + `hud_accent_rgb`
- [ ] Verify `--logic-lime` is never injected as an override

---

## Tone & Copy Reference

**Voice:** Direct, precise, neutral. No exclamation marks. No "You're all set!" No casual phrasing. Treat the user as a competent operator.

### Error State Messages

**Platform/developer-facing errors** (404, 500, admin routes) — use FieldLogic diagnostic tone:

| Scenario | Message |
|----------|---------|
| 404 | `[DIAGNOSTIC]: ROUTE_NOT_FOUND · Requested resource is outside current system scope.` |
| 401 (admin) | `[SECURITY]: SESSION_REQUIRED · Authenticate to access command level [ADMIN].` |
| 403 (admin) | `[SECURITY]: INSUFFICIENT_CLEARANCE · Your role does not permit this operation.` |
| 500 | `[SYSTEM]: INTERNAL_FAULT · Event logged. Retry or contact system support.` |

**End-user-facing errors** (auth, registration, form validation) — use plain-language copy:

| Scenario | Message |
|----------|---------|
| Invalid login | `Incorrect email or password. Please try again.` |
| Unconfirmed email | `Please verify your email before signing in. Check your inbox.` |
| Rate limit | `Too many attempts. Please wait a moment and try again.` |
| Required field | `This field is required.` |
| Stripe failure | `Payment was declined. Please check your card details and try again.` |

### Playoff Wizard Copy

```
Step 1 header:   "Initializing Bracket Generation"
Step 1 body:     "Define parameters for qualification thresholds and seed distribution."
Step 2 header:   "Configuring Round Structure"
Step 2 body:     "Select elimination logic: single-elimination, double-elimination, or round robin."
Step 3 header:   "Validating Team Matrix"
Step 3 body:     "Confirming {n} teams across {d} divisions. Cross-checking for seeding conflicts."
Confirm CTA:     "Execute Bracket Generation"
```

### Marketing Copy

```
Hero primary:    "Engineered for Competition."
Hero secondary:  "Infrastructure for Victory."
Hero body:       "A high-precision tournament management layer for organizations that demand
                 structural integrity in their operations."
Primary CTA:     "Initialize Your Organization"
Secondary CTA:   "View Live Systems"
```

---

## Appendix A — Implementation Priority Matrix

| Phase | Effort | Nature | Justification | Sprint |
|-------|--------|--------|---------------|--------|
| Phase 1 — Foundation | Low | Rebrand | Zero functional change — prerequisite for all | 1 |
| Phase 6 — Nav/Shell | Low | Rebrand | Marketing branch only; org nav untouched | 1 |
| Phase 7 — Landing Page | Medium | Rebrand | Standalone marketing page; proven section structure preserved | 1 |
| Phase 9 — Error States | Low | Rebrand | 404/500 tone change; auth errors stay plain-language | 1 |
| Phase 2 — Admin HUD | Low–Med | Cosmetic + Additive | Existing dashboard preserved; HUD styling + event feed | 2 |
| Phase 8 — Live Logic | Medium | Additive | Lightweight toast rail; no page restructuring | 2 |
| Phase 4 — Official Accounts | Medium | Auth + Net-new Feature | Requires role design; deferred until after bracket complete | 4 |
| Phase 3 — Bracket | High | Additive/Replace | Confirm public bracket view exists + assess before building | 3 |
| Phase 5 — Archives | Medium | Net-new Feature | Additive DB + UI; no existing functionality replaced | 5 |
| Phase 10 — White-Label | Low | Additive | Deferred — infrastructure already exists; build on demand | 6 |

**Sprint 1 is non-breaking and purely cosmetic.** No DB changes. No new API routes. Can ship as a standalone PR with confidence.

**Sprint 3 ordering note:** Phase 3 (Bracket) is the remaining Sprint 3 item. Phase 4 (Official Accounts) is deferred to Sprint 4 — it requires auth/role design work that benefits from the bracket and live scoring infrastructure being stable first.

---

## Appendix B — Token Reference

| Token | Value | Used By |
|-------|-------|---------|
| `--pitch-black` | `#0A0A0A` | Platform page backgrounds |
| `--blueprint-blue` | `#1E3A8A` | HUD borders, connectors, structural elements |
| `--blueprint-blue-rgb` | `30, 58, 138` | rgba() expressions in CSS |
| `--logic-lime` | `#D9F99D` | Live states, CTAs, winner highlight, accent |
| `--logic-lime-rgb` | `217, 249, 157` | rgba() expressions |
| `--hud-surface` | `#111827` | HudPanel backgrounds |
| `--structural-slate` | `#0F172A` | Notification rail, dark inset surfaces |
| `--data-gray` | `#94A3B8` | Secondary text, labels, muted data |
| `--fl-text` | `#F1F5F9` | Primary text on dark surfaces |
| `--font-data` | IBM Plex Mono | All data/stat/score/mono displays |

**Existing tokens preserved (do not replace):**

| Token | Kept For |
|-------|----------|
| `--border` | Per-org form inputs, cards (changes color per org) |
| `--surface` | Org page card/panel backgrounds |
| `--radius` | Org page rounded corners |
| `--primary*` | Per-org brand color injection |
| `--font-display` | Org page display font (Barlow Condensed) |

---

## Integration Notes

- **Design System:** Items 1–4 of `DESIGN_SYSTEM_PLAN.md` are complete. Per-org `--primary` injection, theme presets, logo, hero banner, font, and card style are all live. FieldLogic tokens are additive and do not conflict.
- **Item 5 (Demo pages):** Superseded. FieldLogic is the chosen palette direction. No action required.
- **Milton Bats verification (Item 1D):** User should manually confirm `/milton-softball/*` renders purple theme after Phase 1 token additions. No code change expected.
- **Supabase Realtime:** Enable table replication for `games` and `registrations` in Supabase dashboard → Database → Replication before implementing Phases 2, 3, or 8.
- **Channel naming convention:** `org-events-{orgId}`, `bracket-{tournamentId}`, `game-{gameId}`, `live-logic-{orgId}`.
- **Multi-tenancy invariant:** Every Realtime subscription must include an `org_id` or `tournament_id` row filter. Cross-tenant event leakage is a security issue.
- **Auth clients:** `createClient()` from `lib/supabase/server.ts` for Server Components and Server Actions. `createClient()` from `lib/supabase/client.ts` for Client Components.
- **Tailwind config:** If no `tailwind.config.ts` exists in the root, check `postcss.config.*` or `package.json` for where Tailwind is configured before writing Phase 1.
- **Branch:** All work commits to `dev`. Never push to `master` without explicit user confirmation.
