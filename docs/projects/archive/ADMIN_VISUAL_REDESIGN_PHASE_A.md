# Admin Visual Redesign — Phase A (Foundation) Implementation Spec

> Parent plan: `ADMIN_VISUAL_REDESIGN_PLAN.md` · PM brief: `ADMIN_VISUAL_REDESIGN_PM_BRIEF.md`
> Status: **BUILT 2026-06-03 — tsc clean (0 errors), `.next` cleared, dev server restarted, smoke route 200, no Supabase EACCES. Awaiting browser verification + greenlight before Phase B.**
> Phase A is the system-wide foundation: tokens + shared components only. It touches almost no page-specific logic, so it's the lowest-risk, highest-leverage slice and unlocks every later phase.

## Build status (2026-06-03)
**Shipped:** density tokens (globals.css) + `lib/admin-density.tsx` context + no-flash inline script (admin layout) + toggle in the sidebar footer & bottom-nav More "Display" section; shared rows (`.rowMain`, `.teamRowMain`) and toolbar controls (`.select`/`.searchInput`/`.segmented`/`.segment`/`.menuButton`) consume the density tokens; frosted chrome via `--blur-bar` (bottom nav + sticky toolbar); `--highlight-top` depth on `.analyticsPanel` + `.statCard`; press states on rows/segments/menu/stat-cards; quieter mobile blueprint grid. Reduced-motion (A2) was already global from the public Phase A — verified it covers the admin shell, nothing added.

**Mobile notification access → top app-bar (Phase B item pulled forward 2026-06-03):** the first Phase A floating-bell mount collided with per-page header actions and was too faint, so it was replaced by a proper slim mobile top app-bar — `components/admin/AdminMobileTopBar.tsx` + `.module.css`, mounted in `AdminChrome` (≤900px): tournament name + LIVE/DRAFT status pill + one-tap tournament `<select>` switcher + the `NotificationBell`. `.adminMain` top padding offsets the fixed 48px bar; focused flows (onboarding/help) reset it. Also gave the notification panel a mobile position (`notifications.module.css` ≤900px override — it was hardcoded `left: 248px` for the desktop sidebar and opened off-screen on phones).
**Built but not yet wired (safe follow-ups — working code left untouched):**
- `components/admin/BottomSheet.tsx` + `.module.css` — primitive ready; **migration** of the existing schedule + registrations settings sheets onto it is a focused follow-up (those bespoke sheets work today; migrating blind is risky).
- `components/admin/AdminSkeleton.tsx` + `.module.css` — primitives ready; **page wiring** is deferred because the dashboard/registrations/schedule render eagerly with empty defaults (no loading gate to swap into) — wiring needs a small loading-state change per page, best done with each page's later phase.
**Scope note:** density is applied to the *shared* row/control primitives; page-local dense grids (generator micro-grids, payment tables, chips) adopt the tokens incrementally in their own later phases. Compact (desktop default) is unchanged from today's look — current values became the compact token defaults.

## Guiding rules (apply to every item)
- **Preserve the terminal/HUD language** (2026-05-23): blueprint-blue = structural chrome; `--logic-lime` = active/CTA layer; `--font-data` mono; `border-radius: 2px`; no glow/lift theatrics. New polish must read operational.
- **Both surfaces polished + functional.** Density is a *user choice* on desktop and mobile (decision 2026-06-02), not a fixed split.
- **Tokens, not hex.** Every new token gets a `[data-color-mode="light"]` value (admin is dark-first but light parity is a standing rule).
- **All motion gated** behind `prefers-reduced-motion: reduce`.
- **Single 900px mobile threshold** for shell/content (2026-06-01); fix any 768↔900 mismatch we touch.

---

## New / updated tokens

Add to `app/globals.css` (`:root` + the `[data-color-mode="light"]` block). Admin-scoped density tokens live on `.adminShell` in `admin.module.css`.

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--blur-bar` | `20px` | `20px` | Single source for frosted chrome (nav, sticky toolbar, sheets) |
| `--hud-highlight` | `inset 0 1px 0 rgba(255,255,255,0.04)` | `inset 0 1px 0 rgba(15,17,35,0.035)` | Whisper-thin top edge on panels/cards |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | same | Sheet / count-up micro-interactions |
| `--admin-row-min` | `36px` (compact) | — | Shared row min-height (density-driven) |
| `--admin-row-pad-y` | `0.38rem` (compact) | — | Shared row vertical padding (density-driven) |
| `--admin-control-h` | `28px` (compact) | — | Toolbar control height (density-driven) |
| `--admin-chip-h` | `28px` (compact) | — | Filter/status chip height (density-driven) |
| `--admin-tap-min` | `44px` | — | Minimum tappable size on coarse pointers |

Comfortable overrides (set on `.adminShell[data-density="comfortable"]`): `--admin-row-min: 44px; --admin-row-pad-y: 0.55rem; --admin-control-h: 38px; --admin-chip-h: 34px;`.

`.tabular` utility: `font-variant-numeric: tabular-nums;` (additive — `--font-data`/IBM Plex Mono is already tabular; this future-proofs + covers any non-mono fallbacks).

---

## A1 — Density modes (`comfortable` / `compact`, user choice on both surfaces)

**Goal:** the dense terminal layout stays available everywhere, and a comfortable mode (larger rows/controls/targets) is available everywhere — comfortable defaults on touch, compact on desktop.

**Files:** `app/globals.css` (tokens), `app/[orgSlug]/admin/admin.module.css` (`.adminShell` density blocks), `app/[orgSlug]/admin/admin-common.module.css` (`.rowMain`, `.tableHeader`, `.filterChip`), `components/admin/tournament/TournamentAdminUI.module.css` (`.select`, `.search`, `.segmented`, `.menuButton`), `app/[orgSlug]/admin/AdminChrome.tsx` (set the attribute), `components/admin/AdminBottomNav.tsx` + sidebar footer (the toggle).

**Implementation:**
1. Refactor the shared primitives to read tokens instead of hardcoded values, e.g. `.rowMain { min-height: var(--admin-row-min); padding: var(--admin-row-pad-y) 1.5rem; }`, controls `height: var(--admin-control-h)`, chips `min-height: var(--admin-chip-h)`. Keep the current values as the compact defaults so **nothing changes until a user opts in**.
2. `.adminShell` carries `data-density`. Default resolution in `AdminChrome` (client): read `localStorage.fl_admin_density`; if unset, derive `matchMedia('(pointer: coarse)').matches ? 'comfortable' : 'compact'`. Set the attribute before first paint (inline blocking snippet in the layout or a `useLayoutEffect` with a sensible SSR default attribute) to avoid a hydration flash.
3. Toggle affordance bound to the same setting: a 2-segment control (`COMFORTABLE` / `COMPACT`) in (a) the **mobile More sheet** "Display" section and (b) the **desktop sidebar footer** beside Help/Logout. Writing persists to `localStorage` and updates the attribute live.
4. Scope for Phase A: density drives the **shared** row/control/chip/touch primitives + bottom-nav target height. Page-local dense grids (generator micro-grids, payment tables) adopt the tokens incrementally in their own later phases.

**Acceptance:** toggling updates row/control sizes live and persists across reloads; compact is byte-for-byte the current desktop look; comfortable hits ≥44px rows/controls; no hydration flash; both modes pass dark + light.

## A2 — Reduced-motion global guard

**Goal:** honor `prefers-reduced-motion` across the admin shell (none exists today).

**Files:** `app/globals.css` (or scoped in `admin.module.css`).

**Implementation:** one `@media (prefers-reduced-motion: reduce)` block scoped to `.adminShell` (and the sheet/overlay portals, which render outside the shell) that neutralizes movement: `animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto;` and disables transform-based keyframes (`slideDown`, `slideUpMenu`, `schedSheetSlideUp`, `teamsSheetSlideUp`, `adminSlideDown`, `pulse-lime`, `divisionPulse`) plus the Phase B count-up. Keep instantaneous opacity for state changes.

**Acceptance:** with OS reduce-motion on, no slide/pulse/scale anywhere in admin; functionality identical.

## A3 — Touch press states

**Goal:** tactile feedback on tappable surfaces (only the bottom-nav tab has it today).

**Files:** module CSS for `.rowMain`/`.teamRowMain`/`.planningRow`/`.scoringRow` (admin-common, schedule-admin), `.attentionBucket`/`.attentionItem`, `.statCard`, `.sheetSeg`, `.filterChip`, `.segment`.

**Implementation:** a shared pattern — `:active { transform: scale(0.985); }` for cards/buttons and a quick background flash for rows; **all gated** so under reduced-motion the scale is replaced by a background tint only. Keep ≤120ms.

**Acceptance:** pressing any primary tappable element gives immediate feedback; reduced-motion swaps scale→tint; no layout shift.

## A4 — Tabular numerals

**Goal:** live-updating numbers never reflow/jitter.

**Files:** `app/globals.css` (`.tabular`), then apply the property to `.statNum`, `.gaugeMain`, `.gaugePct`, `.attentionBucketCount`/`.attentionItemCount`, schedule-health `strong` KPIs, `.payDivCell`, `.scoreInlineValue`, `.registrationStatusCount`.

**Acceptance:** counts/gauges/scores hold column alignment as values change (verified live in Phase B with count-up).

## A5 — Unified frosted chrome (`--blur-bar`)

**Goal:** one frosted-glass treatment + a battery-safe fallback.

**Files:** `app/globals.css` (`--blur-bar`, `.frosted` helper + `@supports` fallback), `components/admin/AdminBottomNav.module.css`, `components/admin/tournament/TournamentAdminUI.module.css` (`.toolbar[data-sticky]` 14px → `var(--blur-bar)`), the sheet CSS (via the new BottomSheet, A8).

**Implementation:** `.frosted { backdrop-filter: blur(var(--blur-bar)); -webkit-backdrop-filter: blur(var(--blur-bar)); } @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .frosted { background: var(--hud-surface); } }`. Bottom nav already uses a near-opaque `rgba(17,24,39,0.97)` base → good fallback.

**Acceptance:** nav/sticky-toolbar/sheets share one blur; on a no-backdrop-filter browser they fall back to solid `--hud-surface` with no transparency artifacts.

## A6 — Whisper-thin elevation (`--hud-highlight`)

**Goal:** subtle CRT-panel depth without breaking the flat 2px rule.

**Files:** `app/globals.css` (token), applied to `.analyticsPanel`, `.statCard`, admin `.card`, the modal/sheet surfaces.

**Implementation:** add `--hud-highlight` to existing `box-shadow` (or as the sole shadow where none exists). Must be barely perceptible; verify it doesn't read as a consumer gradient and has a light-mode value.

**Acceptance:** side-by-side before/after shows a faint top edge only; flat aesthetic intact; passes dark + light.

## A7 — Blueprint-grid mobile tune

**Goal:** the 40px/0.09 blueprint grid is busy + paint-heavy on small screens.

**Files:** `app/[orgSlug]/admin/admin.module.css` (`.adminMain` ≤900px block).

**Implementation:** at ≤900px, `background-size: 28px 28px;` and drop the line alpha `0.09 → ~0.05`. Desktop unchanged.

**Acceptance:** grid still legible as brand texture on a phone but recedes behind content; desktop identical.

## A8 — Shared `<BottomSheet>` primitive

**Goal:** one sheet implementation; today the CSS is duplicated across schedule + teams (and the generator's ≤540px modal-as-sheet).

**Files:** new `components/admin/BottomSheet.tsx` + `BottomSheet.module.css`; migrate `schedule/page.tsx` settings sheet and `registrations/page.tsx` settings sheet onto it (the two near-identical ones). Generator modal→sheet stays in Phase C.

**API:**
```
<BottomSheet
  open: boolean
  onClose: () => void
  title?: ReactNode
  footer?: ReactNode        // sticky footer slot (e.g. Done button)
  maxHeight?: string        // default min(88vh, ...)
  ariaLabel?: string
>{children}</BottomSheet>
```
**Behaviors:** frosted/dim backdrop; slide-up via `--ease-spring` (reduced-motion → instant); 36px drag handle; `padding-bottom: max(1.25rem, env(safe-area-inset-bottom))`; sticky footer that never clips; focus trap + `Esc` to close + body scroll-lock; `max-width: 760px` centered (matches existing); rendered in a portal; `z-index` above content, below nothing it must sit under.

**Acceptance:** both migrated sheets behave identically to before (visually + functionally); keyboard/Esc/scroll-lock work; safe-area respected; reduced-motion = no slide.

## A9 — Layout-matched skeletons

**Goal:** dense pages load into intentional placeholders, not blank/spinners.

**Files:** new `components/admin/AdminSkeleton.tsx` (+ small CSS); mount on `dashboard/page.tsx`, `registrations/page.tsx`, `schedule/page.tsx` loading branches.

**API:** exports `SkeletonRow` (matches `.rowMain` height/columns), `SkeletonStatCard`, `SkeletonPanel`. Blocks use `--white-5`/`--white-03` on 2px radius with a blueprint hairline; a left-to-right shimmer via keyframe that is **static under reduced-motion**.

**Acceptance:** skeletons match the real layout's geometry (no jump on load-in); shimmer disabled under reduced-motion; used on the 3 heaviest pages.

## A10 — Mobile notification access (approved quick win)

**Goal:** `NotificationBell` only renders in the desktop sidebar logo row (hidden <900px) — mobile admins currently get **no** notifications. Make it reachable now; Phase B's full top app-bar will absorb it.

**Files:** `app/[orgSlug]/admin/AdminChrome.tsx` (mobile-only mount), small CSS in `admin.module.css`.

**Implementation:** render `<NotificationBell orgId={...} />` in a mobile-only (`≤900px`) fixed slot, top-right, `top: max(0.5rem, env(safe-area-inset-top)); right: max(0.5rem, env(safe-area-inset-right))`, `z-index` below the More sheet/overlays. Keep it deliberately minimal so Phase B can replace it with the app-bar cleanly (single mount point).

**Acceptance:** on a phone, the bell is visible and opens the notifications panel on every admin route; it doesn't overlap page headers or the bottom nav; desktop unchanged.

---

## Build sequence within Phase A
1. Tokens (`--blur-bar`, `--hud-highlight`, `.tabular`, density tokens) + **A2 reduced-motion** (pure CSS, zero-risk) → A4 tabular, A5 frosted, A6 elevation, A7 grid.
2. **A1 density** plumbing + toggle (the one item with JS/state).
3. **A3 press states** (depends on reduced-motion being in place).
4. **A8 BottomSheet** primitive + migrate the two settings sheets.
5. **A9 skeletons** + **A10 mobile bell**.

## Verification matrix
Restart dev server first (new files + shared-module edits). Walk dashboard → registrations → schedule (planning + scoring) → divisions → event settings, across:
- widths: 375 / 390 / 430 (mobile) + desktop
- modes: dark + light · compact + comfortable
- org: a branded org + a default org
- motion: OS reduce-motion off **and** on

Confirm: nothing changes in compact-desktop vs today (compact is the current look); comfortable hits ≥44px targets; reduced-motion kills all movement; frosted falls back solid where unsupported; sheets respect safe-area + Esc + scroll-lock; skeletons match real geometry; the mobile bell is reachable; terminal/HUD language preserved (no consumer drift).

## Open micro-decisions (don't block the build)
- **Density toggle home:** More-sheet "Display" section (mobile) + sidebar footer (desktop) is the proposal — confirm you're happy with those two spots vs. a single Settings location.
- **Comfortable default trigger:** coarse-pointer detection vs. strictly ≤900px width. Proposal uses coarse-pointer (covers tablets/2-in-1s better); easy to switch.
