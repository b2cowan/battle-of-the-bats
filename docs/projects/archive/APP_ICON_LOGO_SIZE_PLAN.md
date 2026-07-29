# App Icon — Logo Size Control (Version A)

**Status:** Planned, not started
**Owner-facing brief:** `docs/projects/active/APP_ICON_LOGO_SIZE_PM_BRIEF.md`
**Plan / pricing impact:** none (lives inside existing Tournament Plus "advanced branding"; no new gate, no pricing change)
**Estimated LOE:** ~0.5–1 day build + review + browser verify

---

## 1. Goal

Let a Tournament Plus+ organizer control **how large their logo sits inside the home-screen app icon tile** (the installed PWA icon fans get when they "Add to Home Screen"). Today the logo box is a fixed size baked into the two icon generators; this adds a single "Logo size" slider in the existing **Public Site → Advanced Branding → App Icon** panel, with a live preview.

This is **Version A — a centered size/scale slider** (logo stays centered, we just grow/shrink it). It is explicitly **not** a crop-and-pan editor (that was scoped as the larger "Version B" and is out of scope here).

## 2. Current behaviour (baseline to preserve)

The branded icon is composited at request time by two routes that share `lib/pwa-icon.tsx` (`resolveBrandedLogo`):

- `app/[orgSlug]/[tournamentSlug]/apple-icon.tsx` — iOS apple-touch-icon, 180² canvas, logo rendered in a **156² box (~87%)**, `objectFit: contain`, on the sampled/overridden background tile. iOS only rounds corners (no circular crop), so it has lots of headroom.
- `app/[orgSlug]/[tournamentSlug]/icon-maskable/route.tsx` — Android maskable icon, 512² canvas, logo in a **`LOGO_BOX = 280` box (~55%)**. Android crops ~10% off every edge into a circle/squircle, so the box is deliberately kept inside the maskable **safe circle** (radius ≈ 0.4×512 ≈ 205px). A centered square box of side S has corner distance (S/2)·√2; for the corner to stay inside the safe radius, **S ≤ ~290px**. So Android has almost no room to grow a square logo — this is the key constraint.

When no override is set the behaviour above is unchanged. Default tile colour = logo's own sampled background (`icon_bg_color` override already exists from mig 152). App name override already exists (`app_name`, mig 153).

## 3. Design decision — how "size" maps across two very different baselines

iOS and Android have very different natural baselines (87% vs 55%) and very different safe ceilings. Storing one absolute "fill %" would be confusing (a "70%" that makes iOS *smaller* than today). So:

**Store a relative size value anchored at today's tuned default (100 = current look), and clamp each platform to its own safe ceiling.**

- Storage: `tournaments.app_icon_scale` — `smallint`, integer percent where **100 = current default**, **NULL = default** (no behaviour change). Proposed accepted range **70–125** (clamped app-side).
- iOS box = `clamp(156 × scale/100, 110, 172)` → 172/180 ≈ 95% hard safe max.
- Android box = `clamp(280 × scale/100, 196, 288)` → 288 = corner-safe max (corners ≈203.6px, just inside the ≈204.8px safe radius; never crops a square logo).

Net effect: the slider reads as **Small ↔ Large**; iOS honours it across a wide range; Android grows only up to its safe limit and silently caps there (so we never ship a clipped Android icon). The number itself is not shown to the organizer — just a slider with a "Default" tick.

**Live preview:** the existing preview tile (`styles.iconTile` + `styles.iconTileImg`) is a **rounded square** — i.e. it already mimics the iOS framing. Apply the iOS box fraction to the preview image width so the preview honestly reflects the iPhone result. Add one line of helper copy: *"Android keeps a little more edge padding so its round icon never crops your logo."*

### Owner decision — RESOLVED 2026-06-24
- **Control style:** **Continuous slider** (Small ↔ Large, default tick at 100), range mapping above. Owner chose slider over preset chips.

## 4. The one UX caveat to put in the copy

**Installed home-screen icons are cached by the phone OS.** Changing the size later does **not** restyle an icon already on someone's phone — only fans who add the event *after* the change (or remove & re-add) see the new framing. So this control is "get the first impression right," and the **live preview is the real-time feedback**, not the installed icons. The panel's existing intro copy should gain a short note to this effect (one sentence) so organizers don't think it's broken when their own already-installed icon doesn't move.

## 5. Implementation steps

Mirrors migs 152 (`icon_bg_color`) and 153 (`app_name`) exactly.

1. **Migration `154_tournament_app_icon_scale.sql`** — `alter table public.tournaments add column if not exists app_icon_scale smallint;` (additive, nullable, no default). Apply dev + prod together at release. Update `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` **in the same unit of work** (gate: `npm run check:dictionary`).
2. **Types** — add `iconScale?: number | null` to the `Tournament` type in `lib/types.ts` (next to `iconBgColor`/`appName`, ~L298–302).
3. **db.ts** — map it in `mapTournament` (`iconScale: r.app_icon_scale ?? null`, ~L2562) and add `app_icon_scale` to the `getPublicTournamentBySlug` SELECT (so the icon routes receive it). Also carry on clone/populate inserts alongside `icon_bg_color`/`app_name` (~L313–314, L715–716) for parity.
4. **Branding API** (`app/api/admin/tournament-branding/route.ts`):
   - GET: add `app_icon_scale` to the SELECT and return `iconScale: data.app_icon_scale ?? null`.
   - PATCH: add `iconScale` to the body type, add `'iconScale'` to `PLUS_VISUAL_FIELDS` (keeps it Plus-gated + manage_branding-gated for free), validate as int, clamp to 70–125, `null` clears.
5. **`lib/pwa-icon.tsx`** — `resolveBrandedLogo` already fetches the tournament row; read `t.iconScale` and return it on the result object: `{ src, bg, scale }` (scale = the raw stored int or null). No clamping here — let each route apply its own safe ceiling.
6. **Icon routes** — both compute their box from `branded.scale`:
   - apple-icon: `const box = clamp(Math.round(156 * (branded.scale ?? 100) / 100), 110, 172);` use for `width/height`.
   - icon-maskable: `const box = clamp(Math.round(280 * (branded.scale ?? 100) / 100), 196, 288);` replace the hard-coded `LOGO_BOX`. Keep a small `clamp` helper local to each (or add to pwa-icon).
7. **Branding admin page** (`app/[orgSlug]/admin/tournaments/branding/page.tsx`):
   - New state `iconScale` (number, default 100); seed from GET (only when `canUseAdvancedBranding`, like `iconBg`/`appName`); include in the dirty-check (`hasChanges`) and both save payloads (~L190, L219); send `null` when 100 to keep "unset = default" clean, or send the value — pick one and be consistent (recommend: send the value, treat 100 as the stored default).
   - New "Logo size" control (slider) in the App Icon accordion body, below the Background row.
   - Preview: apply the iOS box fraction to `styles.iconTileImg` via inline `style={{ width: `${(iosBox/180)*100}%`, height: 'auto' }}` (or a CSS var) so the preview tracks the slider live.
   - Add the OS-cache caveat sentence to the panel intro copy.
8. **CSS** (`branding.module.css`) — minor: ensure `.iconTileImg` honours a width override and stays centered; style the slider row to match existing controls (defer pixel polish to `/design` if needed).
9. **Help docs** — App Icon is a customer-facing flow → after build, offer `/docs` to add a line about the new "Logo size" control + the new-installs-only caveat (single source: `lib/help-content/tournaments.tsx`).

## 6. Gating & security

- Plus+ only (rides `advanced_tournament_branding` via `PLUS_VISUAL_FIELDS`); free tier sees the panel "Locked" exactly as today.
- Write requires `manage_branding` capability (owner + admin), already enforced for the whole branding payload.
- Value is server-clamped (70–125) regardless of client.

## 7. Verification

- `npm run typecheck` (touches shared `lib/types.ts`, `lib/db.ts`, `lib/pwa-icon.tsx`) + `npm run verify:changed` (incl. `check:dictionary`).
- Restart dev server (shared modules changed) before browser QA.
- Browser/manual (owner): set slider small/large on a Plus event with a logo → preview tracks; hit `/{org}/{tournament}/apple-icon` and `/{org}/{tournament}/icon-maskable` and confirm the logo grows/shrinks and Android caps at the safe size (square logo never clipped); free event still shows Locked; non-branding admin role still blocked from saving.
- `/review` (deterministic gate is cheap on this diff) before treating done — touches a shared module + an API contract.

## 8. Out of scope (Version B, separate future plan)

Drag-to-position / pinch-zoom cropper, per-axis offset, `objectFit: cover` crop mode, choosing *which part* of a logo shows. ~3–5 days; revisit only on explicit demand.
