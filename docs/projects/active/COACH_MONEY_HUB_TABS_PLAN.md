# Coach Money Hub — Tabbed Navigation

**Status:** ✅ BUILT + owner QA PASSED (2026-08-11), committed on `dev` — not yet released to prod.
**Origin:** owner request in-chat — mockup comparison, Option A ("Dashboard tab") selected 2026-08-10.
A second mockup round (2026-08-11) chose **Option C** for the tab bar's own layout after the owner
found it truncating on a real screen — see "Layout follow-up" at the foot of this file.

## What's changing

Today, `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx` ("Money") is a hub of
stacked cards. Each card (Season Budget Plan, Player Dues, Fundraisers, Expenses & Payables,
Org Allocations, Payment Requests, Budget vs. Actual — **7 cards**, confirmed by reading the
live page; the original mockup only covered 5) is a `<Link>` to its own full-page route.
Opening any one of them is a full navigation; getting to a sibling means navigating back to
Money first.

This becomes: a tab bar under the "Money" title — **Overview** (today's card-stack dashboard)
plus one tab per section — where clicking a tab, or a card inside Overview, swaps the visible
panel in place. The tab bar stays visible the whole time. Matches the approved mockup
(Option A) and its mobile behavior (the tab strip scrolls sideways on phone, same pattern as
the existing `TournamentTopTabs`/`CoachRecordJumpNav` scroll-tab convention).

## Confirmed architecture (research, 2026-08-10)

- All 7 sub-pages are already **Client Components** (`'use client'`) that fetch their own data
  from a dedicated API route under `app/api/coaches/[orgSlug]/teams/[teamId]/...` on mount, via
  `useState`/`useEffect` — not Server Components. This means no RSC/Suspense restructuring is
  needed; converting a page into a mountable panel is a matter of exporting its function, not
  re-architecting data flow.
- No existing precedent for swapping several independently-fetching, form-heavy pages into one
  another without navigation. The closest analog, `app/platform-admin/OverviewTabs.tsx`, fetches
  all panel data up front server-side — too light a case to copy directly (Money's panels are
  each independently heavy: Budget Plan 1486 lines / 35 states, Player Dues 1417 lines / 40
  states, Expenses 1009 lines / 33 states, Budget vs. Actual 934 lines / 17 states, Payment
  Requests 473 lines, Fundraisers 322 (+513 detail), Allocations 287 lines).
- **Decision: lazy-mount, keep-mounted.** Each panel keeps doing its own `fetch()` exactly as it
  does today, but only fires on first tab activation (not all 7 on hub load) and the panel stays
  mounted (not unmounted) once visited, so switching away and back doesn't lose in-progress form
  state or re-fetch. This matches today's per-navigation cost profile — no new load pattern to
  reason about, no double the query cost on hub load.
- Season-read gating is unaffected: `resolveCoachSeasonRead()` / `resolveCoachContext()` already
  runs per API call inside each panel's own route, independent of how the panel is mounted.
  Payment Requests and Org Allocations already gate to the **live season only**
  (`!page.isReadOnly`) via the older `resolveCoachContext()` helper — that gate is preserved
  as-is; those two tabs simply don't render when viewing an archived season, same as today.
- **Old routes stay live, unchanged.** `/accounting/dues`, `/accounting/budget`, etc. keep
  working exactly as they do today (full page, no tab chrome) — no redirect, no behavior change.
  Anything that already links to one of those URLs (bookmarks, notifications, the "See the full
  payment schedule →" link) keeps working. The tab bar is the new *discoverable* path from
  Money; the direct URLs are not being removed.
- Fundraiser detail (`fundraisers/[fundraiserId]`) stays a real, separate route reached by
  `router.push` from inside the Fundraisers tab — it's a drill-in, not a sibling, so it
  intentionally breaks out of the tab shell (same as today).

## Build steps

1. **Extract each of the 7 panels** — in each `accounting/<x>/page.tsx`, rename the current
   default-exported function to a named, exported `<X>Panel` component (zero logic change), add
   a two-line `export default function Page() { return <XPanel />; }` wrapper so the existing
   route renders byte-identical output. Flag (don't fix yet) anything that assumes it's the
   top-level route: a "‹ Back to Money" breadcrumb, `document.title` writes, `notFound()`/
   `redirect()` calls, or `usePathname()` logic that would behave oddly mounted inside a tab.
2. **Build the tab shell** in `accounting/page.tsx`: tab bar (Overview + up to 6 more, fewer
   when Payment Requests/Allocations are gated off a read-only season), `?tab=` query param for
   direct linking + back/forward, lazy-mount-and-keep-mounted panel switching. New CSS added to
   `coaches.module.css` alongside the existing `.money*` rules, following the same underline-tab
   convention as `TournamentTopTabs`/`CoachRecordJumpNav` (mono uppercase label, `--olive`-style
   active underline in the warm palette — using this portal's actual tokens, not the mockup's
   placeholder ones).
3. **Reconcile the flagged items** from step 1 (e.g. hide a redundant "Back to Money" link when
   rendered as a tab panel via a small `embedded?: boolean` prop) — targeted, not a rewrite.
4. **Verify**: `npm run typecheck` (shared-module + route changes touch enough surface to
   warrant it), then hand off for browser verification per the standing rule — the user drives
   browser testing.

## As built — deviations from the plan above

- The hub's own tab param is **`?section=`**, not `?tab=` as written in step 2. `?tab=` was
  already owned by the Expenses panel for its internal Expenses/Payables/Schedule view, read
  straight off `window.location.search`. Rather than collide, the hub took a different key —
  and `sectionHref()` now actively CLEARS the one-shot keys (`starter`, `generate`, `tab`) on
  any switch that doesn't re-specify them, so they can't linger in the URL and refire later.
- Panels are **code-split** via `next/dynamic`, not statically imported. Static imports would
  have put all 7 panels' JS (three of them 1000+ lines, two pulling in a heavy spreadsheet
  export library) into the hub's bundle before a coach clicked anything.
- `embedded` suppresses **the whole page-header block**, not just the back-link step 3
  anticipated — a panel rendered as a tab was otherwise printing a second page title directly
  under the hub's own.
- The panel list is **table-driven** (one array, one map) rather than 7 hand-written mount
  blocks, so an 8th panel is one row.

## Layout follow-up (2026-08-11, Option C)

The owner found the tab row truncating mid-word on a real screen with a large empty gutter
either side. Three options were mocked; **Option C** was chosen and built:

- Money's column widened **960px → 1200px** (`pageWide`), the width Dues / Expenses /
  Budget-vs-Actual each already opted into individually. Fixes the wasted gutter and gives
  every panel's own table more room.
- Two tab labels trimmed — **"Org Allocations" → "Allocations"**, **"Payment Requests" →
  "Payments"** — so all 8 fit on a 1280–1366px laptop, not just a large monitor. Each panel's
  own page title keeps the full name.
- Per-edge **fade + a real arrow button** on whichever side has content hidden, driven by a
  measured overflow check (`ResizeObserver` + scroll listener) so a row that fits shows no
  affordance at all. ⚠ The arrows were briefly `pointer-events: none` decoration; they looked
  clickable and passed the click through to the tab underneath. **An arrow is a control or it
  is not an arrow.**
- **Found while here (pre-existing, not caused by the tabs):** `budget.module.css` and
  `bva.module.css` each carry a *stale local copy* of the shared `.pageHeader`, which never
  received the shared rule's `> *:last-child:not(.pageHeaderLeft) { margin-left: auto }`.
  That's why those two screens' action buttons sat LEFT while the five on the shared class sat
  RIGHT. Both copies reconciled. The deeper fix — delete the local duplicates and consume the
  shared class — is deliberately left as a separate change.

## Explicitly not changing

- No data-fetching consolidation (the hub's `money-summary` rollup and each panel's own detailed
  query stay separate — that double-fetch already exists today and isn't a regression this
  project introduces).
- No redirect of the old standalone routes.
- No change to the season-read gating rules or the archive allow-lists in
  `tests/unit/coach-season-write-guard.test.ts` (Money already isn't in `APPROVED_ARCHIVE_DOORS`
  — that's unchanged; tabs don't add a new archive surface).

## Demo/help follow-up

- ✅ **Help docs synced (2026-08-11)** — `lib/help-content/coaches.tsx`'s "premium-money" section
  claimed "every page has a ← Back to Money link," which stopped being true once cards/tabs
  switch in place instead of navigating away. Rewrote that sentence to describe the tab bar,
  added `tab bar` / `money tabs` / `switch between money screens` as searchable keywords, and
  added a new FAQ ("How do I switch between Budget Plan, Player Dues, and the other Money
  screens?"). No other help-content module referenced the old per-page navigation. Lint +
  typecheck clean; no restart needed (content-only edit).
- ⬜ Coach sandbox (`riverdale-ridge`) runs the real product, so this reaches the demo the
  instant it ships. The current moment-dock line about the accounting screen ("Halfway through
  the year... here's what has actually gone out, line by line...") doesn't name specific
  sub-screens, so it should still read true — confirm in a pass, don't assume.
  See `DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md`.
