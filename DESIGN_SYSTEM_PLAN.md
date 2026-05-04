# Design System & Theming Implementation Plan

**Project:** Battle of the Bats — Tournament Management Platform  
**Date:** 2026-05-03  
**Status:** Approved for implementation  

---

## Item 1 — Generalized Design System (Token Refactor)

**Goal:** Make `globals.css` theme-neutral. Rename brand color tokens to semantic names so per-org overrides work via CSS custom property cascade. No visual changes — the platform default values stay identical to the current Milton Bats palette.

### Stage A — Rename tokens in `globals.css`

- [x] Add `--primary-rgb: 139, 47, 201` to `:root`
- [x] Rename `--purple` → `--primary` (value stays `#8B2FC9`)
- [x] Rename `--purple-light` → `--primary-light` (value stays `#A855F7`)
- [x] Rename `--purple-glow` → `--primary-glow`; change value to `rgba(var(--primary-rgb), 0.35)`
- [x] Rename `--purple-faint` → `--primary-faint`; change value to `rgba(var(--primary-rgb), 0.08)`
- [x] Change `--border` value to `rgba(var(--primary-rgb), 0.25)`
- [x] Change `--glow` value to `0 0 32px rgba(var(--primary-rgb), 0.4)`
- [x] Change `--glow-sm` value to `0 0 16px rgba(var(--primary-rgb), 0.25)`
- [x] Update all remaining `--purple-*` references within `globals.css` itself (`.badge-purple`, `.text-purple`, `.tab-btn.active`, `.segment.active`, scrollbar thumb hover, etc.)

### Stage B — Update all CSS Modules and component files

- [x] `app/page.module.css` — replace all hardcoded `rgba(139,47,201,…)` and `var(--purple*)` references
- [x] `app/[orgSlug]/` CSS module files — grep and replace
- [x] All admin-area CSS modules — grep and replace
- [x] All `.tsx` files using inline `rgba(139,47,201…)` values
- [x] **Audit command:** `grep -r "purple\|139,47,201\|8B2FC9\|A855F7" --include="*.css" --include="*.tsx" app/`

### Stage C — Wire org theme injection in layout

- [x] Create `lib/themes.ts`:
  - Export `PRESETS` map (8 preset objects; see Item 2)
  - Export `resolveTheme(preset, customPrimary?, customAccent?)` → `{ primary, primaryLight, primaryRgb, accent }`
  - Include WCAG contrast-ratio check; return `isLowContrast: boolean`
- [x] Update `app/[orgSlug]/layout.tsx`:
  - Call `resolveTheme(org.theme_preset, org.theme_primary, org.theme_accent)`
  - Wrap `{children}` in `<div style={{ '--primary': ..., '--primary-light': ..., '--primary-rgb': ..., '--accent': ... } as React.CSSProperties}>`
- [x] Update `app/[orgSlug]/admin/layout.tsx` identically (admin pages need the same theme injection — inherited from parent `[orgSlug]/layout.tsx`; no separate file needed)

### Stage D — Milton Bats preservation

- [x] Confirm migration SQL includes: `UPDATE organizations SET theme_preset = 'platform' WHERE slug = 'milton-softball';`
- [ ] Verify `/milton-softball/*` pages render with exact purple/black palette after refactor

---

## Item 2 — Per-Org Color Scheme Selection

**Goal:** Org owners pick a color scheme from the admin settings page. Selection stored on the `organizations` table and injected server-side — zero client JS.

### Database migration

- [x] Create `supabase/migrations/004_org_theme.sql` (created as 004, not 003):
  ```sql
  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS theme_preset  text DEFAULT 'platform',
    ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS theme_accent  text DEFAULT NULL;
  UPDATE organizations SET theme_preset = 'platform' WHERE slug = 'milton-softball';
  ```
- [x] Apply migration in Supabase SQL Editor

### `lib/themes.ts` — preset definitions

8 presets with `primary`, `primaryLight`, `primaryRgb`, `accent` fields:

| Key | Name | Primary | Primary-Light | Accent |
|---|---|---|---|---|
| `platform` | Platform (default) | `#8B2FC9` | `#A855F7` | `#A855F7` |
| `ocean` | Ocean Blue | `#0284C7` | `#38BDF8` | `#38BDF8` |
| `forest` | Forest Green | `#15803D` | `#4ADE80` | `#4ADE80` |
| `sunset` | Sunset Orange | `#C2410C` | `#FB923C` | `#FB923C` |
| `crimson` | Crimson | `#BE123C` | `#FB7185` | `#FB7185` |
| `gold` | Gold | `#B45309` | `#FCD34D` | `#FCD34D` |
| `teal` | Teal | `#0F766E` | `#2DD4BF` | `#2DD4BF` |
| `midnight` | Midnight Blue | `#1D4ED8` | `#60A5FA` | `#60A5FA` |

- [x] `resolveTheme()` validates hex format with regex `/^#[0-9A-Fa-f]{6}$/`; falls back to `platform` if invalid
- [x] `resolveTheme()` computes WCAG relative luminance contrast ratio vs `#FFFFFF`; returns `isLowContrast: boolean` if < 3:1

### Admin settings UI — theme picker

- [x] In `app/[orgSlug]/admin/settings/page.tsx`, add "Theme" card below org profile:
  - 8 color-swatch buttons (40×40px circles, `background: primary`, checkmark ring on selection)
  - Plan-gated "Custom" swatch (Pro/Elite only): expands to two `<input type="color">` fields (Primary, Accent)
  - Low-contrast warning badge if `isLowContrast` is true
  - Live mini-preview (border, button, badge) with inline CSS vars — no round-trip required
  - Save → `PATCH /api/admin/org-settings` with `{ themePreset, themePrimary, themeAccent }`
- [x] Update API route to accept and write theme fields
- [x] Plan-gate custom hex server-side: check `org.plan_id` before writing `theme_primary`/`theme_accent`

---

## Item 3 — Additional Per-Org Customization Options

**Goal:** First wave of beyond-color customization. Priority order: logo → hero banner → font → card style.

### Custom logo (already in schema — wire it up)

- [x] Display `org.logo_url` in `[orgSlug]` nav (replacing or beside org name text)
- [x] Use as `og:image` in `app/[orgSlug]/layout.tsx` metadata export
- [x] Admin settings: logo upload field wired to Supabase Storage (`org-assets` bucket) if not already done

### Hero banner image (Pro+)

- [x] Add column: `ALTER TABLE organizations ADD COLUMN hero_banner_url text DEFAULT NULL;`
- [x] Admin settings: image upload (Supabase Storage, `org-assets` bucket, max 4 MB, crop to 16:5)
- [x] `app/[orgSlug]/page.tsx`: if `hero_banner_url` set, render as `background-image` on hero section with `linear-gradient` dark overlay (text must remain readable)
- [x] Plan-gate upload: check `plan_id` in API route

### Font family preset (Pro+)

- [x] Add column: `ALTER TABLE organizations ADD COLUMN theme_font text DEFAULT 'system';`
- [x] Define 4 pairs in `lib/themes.ts`:
  - `system` — `system-ui, sans-serif` (current)
  - `inter` — Inter via `next/font/google`
  - `barlow` — Barlow Condensed (sporty)
  - `dm-serif` — DM Serif Display + DM Sans (editorial)
- [x] `app/[orgSlug]/layout.tsx`: conditionally load selected font and inject `--font-sans` / `--font-display` into wrapper div
- [x] Admin settings: 4 preset buttons with name + sample text rendered in that font

### Card style variant (all plans)

- [x] Add column: `ALTER TABLE organizations ADD COLUMN theme_card_style text DEFAULT 'default';`
  - Values: `'default' | 'glass' | 'outlined' | 'flat'`
- [x] Add `data-card-style={org.theme_card_style}` to org layout wrapper div
- [x] In `globals.css` add attribute selector variants:
  - `[data-card-style="glass"] .card { background: rgba(26,21,48,0.4); backdrop-filter: blur(16px); }`
  - `[data-card-style="outlined"] .card { background: transparent; border-width: 2px; }`
  - `[data-card-style="flat"] .card { background: var(--surface); border: none; box-shadow: none; }`
- [x] Admin settings: 4 card style preview thumbnails

---

## Item 4 — Platform Page Design Improvements

**Goal:** Polish the marketing landing and discover pages. Additive only — no structural changes to existing sections.

### Landing page (`app/page.tsx` + `app/page.module.css`)

- [x] **Stats bar**: Full-width stripe between hero and features. Static copy: `50+ tournaments · 2,000+ teams · 300+ age divisions`. `--surface` background, `text-label` size, `--white-60` for labels, `--primary-light` for numbers.
- [x] **"How it works" section**: 3 steps between features and pricing. Large step numerals (4rem, `--primary-faint` color), icon, heading, one-line description. 3-col grid → 1-col on mobile.
- [x] **Social proof section**: After pricing. 2–3 quote cards. Silhouette avatar + name + role + quote. Placeholder copy until real testimonials collected.
- [x] **Scroll-triggered animations**: `AnimateIn` client component using `IntersectionObserver` — adds `.visible` class on section entry. `globals.css` `.visible` triggers `animation: fadeInUp 0.5s ease forwards`. No external library.
- [x] **Annual pricing toggle**: `'monthly' | 'annual'` client state. Toggle above pricing grid. Annual display: Pro → `$20.75/mo`, Elite → `$58.25/mo`. "Save 26%" badge.
- [x] **Mobile hero fix**: At `max-width: 480px`, `heroSub` font-size `1rem`; CTA buttons `width: 100%`, stacked vertically.
- [x] **Accessibility**: Skip-to-content link in `app/layout.tsx`. `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` in `globals.css`.

### Discover page (`app/discover/page.tsx` + CSS module)

- [x] **Header gradient**: Subtle `radial-gradient` behind header (matches landing hero style).
- [x] **Empty state**: Replace plain icon with composed empty state (stacked ghost cards or inline SVG).
- [x] **Sticky filter bar**: `position: sticky; top: var(--nav-height); backdrop-filter: blur(16px)` when scrolled past header.
- [x] **Accessibility**: `aria-label="Grid view"` / `aria-label="List view"` on view toggle buttons.

---

## Item 5 — Landing Page Color Scheme Demo Pages

**Goal:** Three themed versions of the marketing landing page for palette evaluation. Self-contained — no changes to any production file.

**Route:** Single `/demo/themes` page with 3-way toggle (easier to compare without tab-switching).

### Files to create

- [ ] `app/demo/themes/page.tsx` (`'use client'`):
  - State: `theme: 'a' | 'b' | 'c'`, default `'a'`
  - Theme map: 3 objects with full CSS var overrides (see table below)
  - Fixed amber dev banner: "⚠ Design Demo — not linked in production"
  - Sticky theme toggle bar: pill buttons for each option
  - Sections: Hero, Stats bar, Features grid, Pricing table, Showcase card, Bottom CTA
  - Collapsible notes panel per theme: contrast observations + keep/discard recommendations
- [ ] `app/demo/themes/page.module.css`:
  - Structural styles copied from `app/page.module.css`
  - All hardcoded `rgba(139,47,201,…)` replaced with `rgba(var(--primary-rgb), …)` so themes switch instantly
  - Dev banner + toggle bar styles
- [ ] Verify `app/demo/` is not referenced in any nav, footer, `sitemap.ts`, or `robots.txt`

### Theme variable values

| CSS Var | Option A — Modern SaaS Sports | Option B — Premium Tournament | Option C — Energetic & Youth |
|---|---|---|---|
| `--bg` | `#0B1F3A` | `#1A1A1A` | `#312E81` |
| `--bg-2` | `#0F2547` | `#212121` | `#3730A3` |
| `--bg-3` | `#142D55` | `#2A2A2A` | `#4338CA` |
| `--surface` | `#1A3063` | `#252525` | `#4338CA` |
| `--surface-2` | `#1F3870` | `#2E2E2E` | `#4F46E5` |
| `--primary` | `#2D9CDB` | `#6D28D9` | `#F97316` |
| `--primary-light` | `#56B4E8` | `#8B5CF6` | `#FB923C` |
| `--primary-rgb` | `45, 156, 219` | `109, 40, 217` | `249, 115, 22` |
| `--accent` | `#A3E635` | `#D1D5DB` | `#F3F4F6` |

### Contrast / readability notes (to display in demo)

- **Option A (Navy/Blue):** Electric Blue on deep navy — excellent contrast. Lime accent looks strong as a highlight/badge color but would be garish as a CTA; keep it accent-only. Overall feel: sports analytics, B2B SaaS.
- **Option B (Charcoal/Purple):** Closest to the current platform palette. Silver accent is subtle — may need `#E5E7EB` or brighter for interactive elements. Charcoal background feels the most "premium tournament" of the three.
- **Option C (Indigo/Orange):** High energy, most distinctive. The `#4F46E5` surface shade is vivid — may feel overwhelming on long scroll pages; the darker `#312E81` bg helps. Orange CTA buttons need to stay at `#EA580C` or darker for WCAG AA. Best suited for a youth/recreational brand positioning.

---

## Recommended Build Order

1. **Item 1, Stages A + B** (token rename) — prerequisite for everything else; zero visual change
2. **Item 5** (demo pages) — fully independent; can run in parallel with Item 1
3. **Item 1, Stages C + D** (layout injection + Milton Bats DB update)
4. **Item 2** (DB migration + `lib/themes.ts` + settings UI) — follows Stage C
5. **Item 4** (platform page polish) — independent; any time
6. **Item 3** (additional org customization) — last; builds on Item 2 infrastructure
