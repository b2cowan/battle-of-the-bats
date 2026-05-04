# Stock Logo Library — Implementation Plan

## Overview

Add a "Browse Stock Logos" modal to Admin → Settings so orgs can pick a curated sport icon as their logo without uploading a file. Access is tiered by plan. Selection saves immediately, bypassing the `isDirty` / navigation guard flow.

---

## Corrected Tier Table

The spec referenced a non-existent `'free'` plan. Corrected to match `lib/plan-config.ts` (`starter | pro | elite`):

| Plan    | Icon count | Notes |
|---------|-----------|-------|
| starter | 6         | Free tier — every org gets these at signup |
| pro     | 12 total  | +6 additional icons beyond starter |
| elite   | 18 total  | +6 additional icons beyond pro |

---

## Icon Manifest (18 icons)

All icons: white fill, transparent background, `viewBox="0 0 64 64"`, hand-crafted geometric SVGs.

### Starter tier (`minPlan: 'starter'`) — 6 icons
| id | label | category | SVG description |
|----|-------|----------|-----------------|
| `baseball-bat` | Baseball Bat | Baseball | Angled tapered bat, thick barrel at top-right |
| `softball-diamond` | Field Diamond | Softball | Rotated square outline (field diamond) |
| `trophy-cup` | Trophy | Awards | Classic two-handled cup, stem, and base |
| `shield-star` | Shield Star | Crests | Pentagon shield with centred 5-point star |
| `crossed-bats` | Crossed Bats | Baseball | Two bats in an X |
| `home-plate` | Home Plate | Baseball | Five-sided home plate polygon |

### Pro tier (`minPlan: 'pro'`) — 6 icons
| id | label | category | SVG description |
|----|-------|----------|-----------------|
| `baseball-cap` | Ball Cap | Baseball | Side-profile cap silhouette with brim |
| `crest-banner` | Crest Banner | Crests | Shield shape with horizontal banner ribbon |
| `laurel-wreath` | Laurel Wreath | Awards | Circular wreath of mirrored leaf arcs |
| `lightning-bolt` | Lightning Bolt | Multi-sport | Bold angular lightning bolt |
| `baseball-glove` | Baseball Glove | Baseball | Stylised mitt silhouette |
| `star-circle` | Star Circle | Awards | 5-point star inscribed in a circle outline |

### Elite tier (`minPlan: 'elite'`) — 6 icons
| id | label | category | SVG description |
|----|-------|----------|-----------------|
| `crown` | Crown | Crests | Three-point crown silhouette |
| `medal-ribbon` | Medal | Awards | Circle medal hanging from a folded ribbon |
| `flame` | Flame | Multi-sport | Stylised flame shape |
| `compass-rose` | Compass | Multi-sport | Four-pointed compass / target rings |
| `pennant-flag` | Pennant | Multi-sport | Triangular pennant on a pole |
| `diamond-field` | Diamond Field | Baseball | Full infield diamond with all four bases marked |

---

## Modal UX Detail

### Entry point
In the Organization Logo card (settings page), add a **"Browse Stock Logos"** button between the existing Upload button and the Remove button.

### Modal structure
1. Full-viewport overlay (`.modalOverlay` — already exists in CSS)
2. Wider modal panel: max-width 680px
3. **Header**: "Choose a Stock Logo" title + "Select an icon to represent your organization" subtitle + X close button
4. **Body**: icons rendered in category groups, each group labelled ("Baseball", "Softball", "Awards", "Crests", "Multi-sport")
5. **Grid**: 4-column on desktop, 3 on tablet (≤600px), 2 on mobile (≤400px)
6. **Each tile** (88px × 96px total):
   - 64×64px dark card background
   - Centred 40px SVG `<img>` tag
   - Label below in 0.7rem text
   - **Selected**: 2px `var(--primary)` border + semi-transparent primary background + white check overlay
   - **Locked**: 40% opacity + lock icon badge in top-right corner + `cursor: not-allowed`
   - **Locked click / hover**: shows an upgrade CTA below the grid ("This icon requires Pro. Upgrade to unlock.")
7. **Footer**: "Cancel" (btn-ghost) + "Use This Logo" (btn-primary, disabled until a tile is selected; shows spinner while POSTing)

### Navigation guard interaction
- Button is a `<button>`, not an `<a>` — not intercepted by the nav guard click listener
- Stock logo state (`stockLogoOpen`, `stockLogoSelected`) is separate from the `isDirty` computation — selecting or confirming a stock logo does NOT touch `form`, `presetKey`, `fontKey`, `cardStyle`, or `requireFinalization`
- Selection saves immediately, same pattern as file upload

---

## CSS Approach

Reuse `.modalOverlay` (already in settings.module.css). Add new rules:

```
.stockModal          max-width: 680px; max-height: 85vh; overflow-y: auto
.stockModalHeader    flex row, title + X button
.stockModalSubtitle  muted 0.85rem
.stockCategoryLabel  uppercase 0.7rem muted section divider
.stockGrid           grid; 4 cols; gap 0.625rem; margin-bottom 1.25rem
.stockTile           88px tall; dark bg; rounded-10; border; cursor pointer; transition
.stockTileImg        40px centred within tile
.stockTileLabel      0.7rem centred below
.stockTileActive     primary border + rgba primary bg
.stockTileLocked     opacity 0.4; cursor not-allowed
.stockLockBadge      absolute top-right; 18px circle; dark bg; lock icon
.stockUpgradeCta     amber warning box, shown when locked icon clicked
.stockModalFooter    flex row; gap; justify flex-end
```

---

## API Route

**`POST /api/admin/org-logo-stock`**

Body: `{ stockPath: '/stock-logos/baseball-bat.svg' }`

Logic:
1. `getAuthContext()` → `{ user, org }` (includes `org.planId`)
2. Verify `organization_members.role === 'owner'` for this org
3. Look up `STOCK_LOGOS.find(l => l.file === stockPath)` — 400 if not found
4. Verify `PLAN_ORDER[org.planId] >= PLAN_ORDER[logo.minPlan]` — 403 if insufficient plan
5. Build absolute URL: `` `${process.env.NEXT_PUBLIC_APP_URL}${stockPath}` ``
6. `UPDATE organizations SET logo_url = <url> WHERE id = org.id`
7. Return `{ logoUrl }`

`PLAN_ORDER = { starter: 0, pro: 1, elite: 2 }` (defined locally in the route or in stock-logos.ts)

**Note**: Need to verify that `getAuthContext()` exposes `org.planId`. The existing logo route only uses `org.id`. May need to also query `organizations.plan_id` in the route, or check if `api-auth.ts` already returns it on the `org` object.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `public/stock-logos/baseball-bat.svg` | Create |
| `public/stock-logos/softball-diamond.svg` | Create |
| `public/stock-logos/trophy-cup.svg` | Create |
| `public/stock-logos/shield-star.svg` | Create |
| `public/stock-logos/crossed-bats.svg` | Create |
| `public/stock-logos/home-plate.svg` | Create |
| `public/stock-logos/baseball-cap.svg` | Create |
| `public/stock-logos/crest-banner.svg` | Create |
| `public/stock-logos/laurel-wreath.svg` | Create |
| `public/stock-logos/lightning-bolt.svg` | Create |
| `public/stock-logos/baseball-glove.svg` | Create |
| `public/stock-logos/star-circle.svg` | Create |
| `public/stock-logos/crown.svg` | Create |
| `public/stock-logos/medal-ribbon.svg` | Create |
| `public/stock-logos/flame.svg` | Create |
| `public/stock-logos/compass-rose.svg` | Create |
| `public/stock-logos/pennant-flag.svg` | Create |
| `public/stock-logos/diamond-field.svg` | Create |
| `lib/stock-logos.ts` | Create — manifest + `isStockLogoUnlocked()` + `PLAN_ORDER` |
| `app/api/admin/org-logo-stock/route.ts` | Create — POST handler |
| `app/[orgSlug]/admin/settings/settings.module.css` | Modify — add stock picker CSS rules |
| `app/[orgSlug]/admin/settings/page.tsx` | Modify — state, button, modal JSX, handler |

Do not touch: `app/api/admin/org-logo/route.ts`

---

## Build Sequence

1. **SVG assets** — Create all 18 hand-crafted SVGs in `public/stock-logos/`
2. **`lib/stock-logos.ts`** — Manifest, `PLAN_ORDER`, `isStockLogoUnlocked()`
3. **`app/api/admin/org-logo-stock/route.ts`** — POST handler (verify `getAuthContext` shape first)
4. **`settings.module.css`** — Append stock picker CSS
5. **`settings/page.tsx`** — Add state, "Browse Stock Logos" button, modal JSX, `handleStockLogoConfirm()`

---

## Settings Page Changes (detail)

### New state
```ts
const [stockLogoOpen, setStockLogoOpen]       = useState(false);
const [stockLogoSelected, setStockLogoSelected] = useState<string | null>(null);
const [stockLogoSaving, setStockLogoSaving]   = useState(false);
const [stockLogoLockedCta, setStockLogoLockedCta] = useState<string | null>(null); // planId needed
```

### New import
```ts
import { STOCK_LOGOS, isStockLogoUnlocked } from '@/lib/stock-logos';
import { Library } from 'lucide-react'; // or Grid icon
```

### Button placement
Add inside the `.logoActions` div, after the Upload button and before the Remove button:
```tsx
<button type="button" className="btn btn-outline" onClick={() => setStockLogoOpen(true)}>
  <Library size={15} />
  Browse Stock Logos
</button>
```

### Handler
```ts
async function handleStockLogoConfirm() {
  if (!stockLogoSelected || !currentOrg) return;
  setStockLogoSaving(true);
  try {
    const res = await fetch('/api/admin/org-logo-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockPath: stockLogoSelected }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to set logo');
    setLogoPreview(data.logoUrl);
    setSettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
    setOrgNav(data.logoUrl, currentOrg.name);
    setStockLogoOpen(false);
    setStockLogoSelected(null);
    setSuccessMsg('Logo updated.');
    setSuccessOpen(true);
    refresh();
  } catch (err: any) {
    showError(err.message ?? 'Something went wrong');
  } finally {
    setStockLogoSaving(false);
  }
}
```

### Modal reset on close
When modal closes (Cancel or confirm), reset `stockLogoSelected` and `stockLogoLockedCta`.

---

## Test Cases (for user to verify in browser)

1. Browse Stock Logos button opens modal
2. Starter icons are selectable for a starter-plan org
3. Pro/elite icons show lock badge on a starter-plan org
4. Clicking a locked icon shows upgrade CTA (not an error, no selection)
5. Selecting a starter icon + "Use This Logo" → logo updates in preview + navbar immediately
6. Cancel button closes modal, discards selection, does NOT set form dirty
7. After selecting a stock logo, the "Save Changes" button is still disabled (not dirty)
8. Stock logo URL is written to DB as absolute URL (`https://…/stock-logos/baseball-bat.svg`)
9. Page refresh retains the selected stock logo in the preview
10. Pro org can select pro-tier icons; elite org can select all icons
