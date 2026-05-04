# Stock Logo Library — Implementation Plan

## Goal
Allow organizations to pick from a curated set of sport icons as their org logo, instead of requiring them to upload a custom image. Reduces the barrier to a polished-looking org profile for new or non-design-savvy admins. Tiered by plan to create upgrade incentive.

---

## User Experience

### Entry point
In **Admin → Settings → Organization Logo**, alongside the existing "Upload Logo" button, add a **"Browse Stock Logos"** button that opens a modal gallery.

### Modal gallery
- Grid of icon thumbnails (sport-themed SVGs)
- Selected icon gets a checkmark highlight
- "Use This Logo" button confirms selection; "Cancel" dismisses
- Icons are grouped by sport/category (Baseball, Softball, Multi-sport, Trophies/Shields, Text-only crests)

### Tiers
| Plan     | Icons available          |
|----------|--------------------------|
| Free     | 6 basic silhouettes      |
| Starter  | 15 icons                 |
| Pro      | 30 icons                 |
| Elite    | Full set (40+), including custom-colour variants |

Locked icons in the modal show a lock badge; clicking them shows "Upgrade to [Plan] to use this icon."

---

## Technical Design

### Asset storage
- Icons stored in `public/stock-logos/` as optimized SVGs
- Naming convention: `baseball-bat.svg`, `softball-diamond.svg`, `trophy-shield.svg`, etc.
- No upload or Supabase storage needed — they're static public assets
- When an org selects a stock icon, `logo_url` is set to the absolute public path: `https://{appUrl}/stock-logos/baseball-bat.svg`

### Plan gating
Each icon in the library manifest has a `minPlan` field. The settings page reads the org's `planId` and marks icons above the tier as locked.

### Library manifest
Add `lib/stock-logos.ts`:
```ts
export interface StockLogo {
  id: string;           // e.g. 'baseball-bat'
  label: string;        // e.g. 'Baseball Bat'
  category: string;     // e.g. 'Baseball'
  file: string;         // relative: '/stock-logos/baseball-bat.svg'
  minPlan: 'free' | 'starter' | 'pro' | 'elite';
}

export const STOCK_LOGOS: StockLogo[] = [
  { id: 'baseball-bat',       label: 'Baseball Bat',       category: 'Baseball',  file: '/stock-logos/baseball-bat.svg',       minPlan: 'free'    },
  { id: 'baseball-diamond',   label: 'Diamond',            category: 'Baseball',  file: '/stock-logos/baseball-diamond.svg',   minPlan: 'free'    },
  { id: 'baseball-glove',     label: 'Glove',              category: 'Baseball',  file: '/stock-logos/baseball-glove.svg',     minPlan: 'free'    },
  { id: 'softball-diamond',   label: 'Softball Diamond',   category: 'Softball',  file: '/stock-logos/softball-diamond.svg',   minPlan: 'free'    },
  { id: 'trophy-cup',         label: 'Trophy',             category: 'Awards',    file: '/stock-logos/trophy-cup.svg',         minPlan: 'free'    },
  { id: 'shield-star',        label: 'Shield Star',        category: 'Awards',    file: '/stock-logos/shield-star.svg',        minPlan: 'free'    },
  // --- Starter+ ---
  { id: 'baseball-home-plate',label: 'Home Plate',         category: 'Baseball',  file: '/stock-logos/baseball-home-plate.svg',minPlan: 'starter' },
  { id: 'baseball-cap',       label: 'Cap',                category: 'Baseball',  file: '/stock-logos/baseball-cap.svg',       minPlan: 'starter' },
  { id: 'crossed-bats',       label: 'Crossed Bats',       category: 'Baseball',  file: '/stock-logos/crossed-bats.svg',       minPlan: 'starter' },
  { id: 'crest-banner',       label: 'Crest Banner',       category: 'Crests',    file: '/stock-logos/crest-banner.svg',       minPlan: 'starter' },
  // ... more icons
];
```

### Settings page changes
1. Add `stockLogoOpen` modal state
2. Add `StockLogoPicker` component (or inline modal) that renders the grid
3. On selection, call `PATCH /api/admin/org-settings` (or `POST /api/admin/org-logo-stock`) with the chosen icon path
4. Update `logoPreview` and `setOrgNav` immediately

### API
Option A — reuse `POST /api/admin/org-logo` by accepting a `stockPath` body instead of a file upload (add a branch: if `stockPath` is in the request body and is a valid `/stock-logos/*.svg` path, write it directly to `logo_url`).

Option B — new route `POST /api/admin/org-logo-stock` with body `{ stockPath: '/stock-logos/baseball-bat.svg' }`. Validates the path is a known stock logo, writes to `logo_url`.

**Recommended: Option B** — keeps the existing file-upload route clean and makes the stock-logo route easy to validate (just check `STOCK_LOGOS.find(l => l.file === stockPath)`).

---

## Files to create / modify

| File | Change |
|------|--------|
| `public/stock-logos/*.svg` | Add all icon assets (source from open SVG library, e.g. Lucide, Heroicons, or custom) |
| `lib/stock-logos.ts` | Icon manifest with plan gating |
| `app/api/admin/org-logo-stock/route.ts` | New POST route — validates path, writes to `logo_url` |
| `app/[orgSlug]/admin/settings/page.tsx` | Add "Browse Stock Logos" button and modal |
| `app/[orgSlug]/admin/settings/settings.module.css` | Modal grid styles |

---

## Icon sourcing

Recommended approach: license-free SVG sport icons from one of:
- **Lucide** (MIT) — limited sport icons but clean style
- **Phosphor Icons** (MIT) — has baseball, trophy, shield
- **Font Awesome Free** (CC BY 4.0) — broader sport coverage
- **Custom hand-drawn** — most distinctive but requires design work

All icons should be single-colour (monochrome) SVGs so they respond to the org's `--primary` CSS variable via `currentColor`. This means the icon automatically takes the org's brand colour without any extra work.

**Implementation note:** SVGs should use `fill="currentColor"` or `stroke="currentColor"`. The `<img>` tag in the navbar and logo preview can't apply CSS colour to SVG via `currentColor`, so for coloured icons either:
1. Use `<img>` and accept monochrome only, OR
2. Inline the SVG in the navbar and settings preview (more complex), OR
3. Apply a CSS filter or mask to tint the image to the primary colour

Simplest approach: ship icons as white-on-transparent SVGs. They look great on the dark nav and the circular logo preview (which has `border: 2px solid var(--primary)` providing the brand colour accent).

---

## Build order

1. Source / create icon SVGs and add to `public/stock-logos/`
2. Write `lib/stock-logos.ts` manifest
3. Write `app/api/admin/org-logo-stock/route.ts`
4. Build `StockLogoPicker` modal in settings page
5. Wire up selection → API call → `setLogoPreview` + `setOrgNav`
6. Test plan gating (lock icons above current plan tier)
7. Add upgrade CTA on locked icons
