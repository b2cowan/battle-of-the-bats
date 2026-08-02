# Coach Portal Desktop Shell — D1 width + D2 pinned header + D3 worst-five + D4 (partial)

**Date:** 2026-08-01 · **Status:** RATIFIED — owner approved recommendations 2026-08-01 ("I agree with your
recommendations… go ahead"), **density toggle explicitly declined**. Mockups = binding spec:
`claude.ai/code/artifact/949c4e72-05f7-47b5-bceb-63d5c9b7a8ed`.
**Review source:** `docs/agents/design/PREMIUM_COACH_PORTAL_DESKTOP_SHELL_REVIEW.md` (line-cited ground truth).
**Post-build deliverable (owner-requested):** Option C real-estate review — ranked list of pages that could
use right-rail layouts with real content, mockups appended to the artifact. Recommendations only, no build.

## Scope

### D1 — Width strategy (Option B, implemented as opt-in wide to match the binding allocation table)
- `.page` (`app/[orgSlug]/coaches/coaches.module.css:432`) gains `margin-inline: auto` — **every** portal page
  centers; unlisted pages keep 960px reading measure. `.pageWide` (1200) composes with it unchanged.
- Apply `.pageWide` to the binding wide list: Roster list (**both** views — drop the depth-only conditional),
  Attendance, Lineups builder `lineups/[eventId]` + `lineups/templates/[templateId]`, Schedule (**all** views —
  drop the calendar-only conditional), Insights (`history/page.tsx`), Documents, Dues, Expenses, Allocations,
  Practice plan editor `practice/[eventId]` (**NOT** `/run`).
- `budget.module.css` local `.page`: 960 → **1200** + centered (adopts its BvA sibling's fix — drift closure).
- `bva.module.css` local `.page`: add centering (already 1200).
- **No new breakpoints.** 640/900 rule intact.

### D2 — Pinned team header (shell-owned, sticky)
- New `components/coaches/CoachTeamHeader.tsx` (client) + classes in `coaches.module.css`.
- Mounted by `app/[orgSlug]/coaches/layout.tsx` as first child inside `.coachesMain` (the desktop scroll
  container — sticky `top: 0` pins to the scrollport, **over** the container's padding).
- **Low-blast-radius geometry:** the bar cancels `.coachesMain` padding with negative margins
  (Chat's `chat.module.css` precedent) — `margin: -2rem -2rem 1.5rem` desktop, matching the 1rem values ≤900.
  `.coachesMain` padding itself is untouched, so `.attendanceFooter`/`.lineupDockedPage`/`.stickyActionBar`
  bottom math (comment at `coaches.module.css:292`) is undisturbed.
- Content — **⚠ FINAL SHAPE: Option A TEAM MASTHEAD (owner-picked 2026-08-02 via AskUserQuestion after
  rejecting two built shapes; artifact section 08 = spec):** eyebrow (org name; team-workspace orgs show
  "Coaches Portal" so the team name appears once) → display-font team name → mono meta line (season
  **YEAR** — never `programYearName`, it can embed the team name — or the **year-only** archive chip via
  the new `label` prop on `CoachSeasonChip`) · flip pill "Public site" header-right. Phone collapse folds
  eyebrow + meta to the bare name. Page-title mirroring DELETED. Rejected shapes (do not re-propose):
  single-line identity strip (stutter ×3 on workspace teams); DOM-mirrored page title (thin echo of the
  h1 beneath). **A2 fast-follow (decided, unbuilt): record + game-day/next-event in the meta line from
  one cached feed** — needs its own small plan (data source, caching, sport-neutral wording).
- **Type (owner-picked Option 1, 2026-08-02):** masthead name = `--font-sans` (Inter) 700 @1.05rem, NOT
  the display face. Root cause: `--font-display` is **Barlow Condensed** (platform-wide, ~94 uses/34 files
  incl. marketing) and 900-weight lowercase crushes; new standing rule logged (heavy condensed = large or
  uppercase only). Deferred owner-aware options, NOT commissioned: swap `--font-display` → Barlow (wide
  sibling; needs /design + /marketing) or a new-face exploration. Specimens: artifact section 09.
- Team resolution: `usePathname()` → teamId → CoachesProvider assignments/closedAssignments (SSR-seeded).
  No teamId in path (hub/redirector) → render nothing.
- Flip pill: **hidden for team-workspace orgs** (no meaningful public site — reuse `isTeamWorkspaceOrg`).
  ⚠ This deliberately reintroduces a public-site door that Batch 3 removed **from the sidebar**; it was
  approved via the D2 mockup and follows the operator-family "flip header-right" standing rule + the
  2026-07-31 name-by-destination ruling. Style: neutral pill (`--border-2`), matches mockup.
- Opaque ground (binding 2026-07-24 warm-shell rule): paint `var(--bg)` or `--surface` — never translucent.
- Publishes `--coach-header-h` (ResizeObserver, mirror of admin's `--admin-header-h`).
- Mobile ≤900: renders, sticky top 0 of the scroll container; collapse-on-scroll with admin's hysteresis
  (collapse >64px, expand <12px). Desktop never collapses (same owner call as admin).
- z-index ≈ 40: above page content, below sheets/modals (200+) and bottom nav (300).

### D3 — Worst-five pages
1. **Season-end:** remove the inline `maxWidth: 560`; new `.seasonSpread` — 2-col grid ≥901px (Wrapped card |
   recap + doors), stacks ≤900. Page stays 960 centered.
2. **Player profile** (`roster/[playerId]/page.tsx`): `.profileCols` grid `minmax(0,1fr) 300px`; right rail =
   identity/guardian/safety/dues quick-facts (sticky below header ≥901px:
   `top: calc(var(--coach-header-h, 0px) + 1rem)`); main column = Development, Attendance, Awards, remaining
   sections in **new `CoachCollapseSection`** (native `<details>`, children stay mounted, `?section=` deep-link
   + scroll + flash — CollapsibleCard's behavior, portal styling). ⚠ **PII gating is untouchable:** every
   existing redaction/capability branch (rosterPii, documents) must survive byte-identical — restructure
   placement only, never condition logic. Rail moves last ≤900 (Staff precedent).
3. **Lineups builder + templates** → wide (D1 list).
4. **Budget** → 1200 (D1).
5. **Dues** → wide (D1).

### D4 — partial (density DECLINED by owner; do not build)
- ExportMenu standard: **RESOLVED AS ALREADY DONE (2026-08-01 discovery, no code change).** All four
  ≥2-format surfaces (Roster incl. sensitive-contacts opt-in, Schedule incl. iCal, Dues, Budget-vs-Actual)
  already mount `components/admin/ExportMenu` with plan-gated PDF — adopted in a prior session; the
  review's "scattered per-page buttons" claim was stale. Agent verified every token ExportMenu uses is
  warm-gate-remapped, so it renders correctly in the portal. Deliberately NOT converted: import-flow
  template downloads (Schedule/Budget import sheets — admin's own import dialogs use plain links, and
  ExportMenu's shape doesn't map to N template rows × 2 formats) and all single-format affordances.
- CoachCollapseSection rides with D3.

## Explicitly out of scope
Density toggle (owner: "we don't need a density choice") · dark re-theme · bell relocation · run screen /
Development band stack / Chat · full AdminChrome merge · any archive-door or season-read change (the header
only *displays* season state — no new data access; the opt-in archive contract lists are untouched).

## Build finding — the shell's scroll model was a fiction (fixed here, probe-driven)

The first probe run FAILED probes 3/7 and exposed a pre-existing structural fact: `.coachesMain`
declared `overflow-y: auto` but no ancestor ever height-clips it, so it **never actually scrolled**
— real scrolling always happened on the document (verified with genuine `page.mouse.wheel()`, not
scripted scrollTop). The phantom scroll container was every sticky descendant's scrollport, so
nothing in the portal could ever pin against real scrolling (the practice focus rail's sticky and
the page-level sticky bottom bars were only ever end-of-content geometry). Fix shipped in this
chunk: `.coachesMain` drops the overflow rule (document = the one scroll container, admin desktop
model); team header pins at `top: var(--coach-topstrip-h)`; **sidebar becomes sticky +
viewport-height-clipped (admin-identical)** — without this the sidebar scrolled away on long pages
the moment document scrolling became real; collapse listens to window scroll; profile + practice
rails' sticky tops clear strip+header; `.collapseSection` gets `scroll-margin-top` so deep links
don't land under the pinned chrome; chat's viewport calc reads `--coach-header-h`.

## Verification
- `npm run typecheck` (layout + shared module touched) · focused lint · `npm test` · token baselines via
  `verify:changed` (expect pre-existing cross-session schema-parity noise — report, don't re-baseline).
- Playwright probe @1920 + @1280 + @360×740: `.page` centered (symmetric inline margins), wide pages at
  1200, header pinned after scroll (bounding top stable, opaque ground), no horizontal overflow, bottom-nav
  clearance intact, attendance/lineup sticky footers still pin. Temp spec, deleted after (owner QA follows).
- Clean dev-server restart before handoff (new files + shared modules).

## Risks
- Wide pages stretching page-local fixed grids — probe + spot-check each converted page.
- Sticky header over warm ground: must be opaque in BOTH themes (token ground auto-flips).
- Header/season chip must show what Chunk F shipped, not new vocabulary.
- Concurrent sessions share the tree — explicit pathspecs at commit time; TODO.md line added once.

## Build status (2026-08-02)

**Owner amendment (2026-08-02) built + probe-verified 5/5:** bar mirrors the page h1 (Schedule
"Team Calendar"; player profile updates post-load via the observer), desktop eyebrow display:none,
phone eyebrow stacks above the title and folds at the collapse threshold, archive chip rides with
the mirrored title, pinning unchanged (top 48 through 600px scroll). Probe note for future readers:
the Overview badges are h1 SIBLINGS, not children — the text-node filter is belt-and-braces there.


✅ **BUILT ON DEV, uncommitted — owner QA pending.** Gates: typecheck/tests/lint **0 errors in this
work** (42 tsc errors + 1 failing spec + schema-parity are ALL concurrent sessions': drill-library
files and dev-only family/drill migrations — this chunk ships none); all six token ratchets ZERO;
date-correctness ZERO; snapshots fresh. **Playwright probes 9/9** (after the scroll-model fix; first
run legitimately failed 3 and exposed it): @1920 + @1280 header AND sidebar pin at 48px constant
through 600px of real document scroll; pageWide 1200/`.page` 960 both perfectly centered; @360
collapse >64px / expand at 0 with eyebrow fold, no nav overlap, no sideways scroll; chat composer
within viewport at scrollY 0; profile rail pins at 110px (= strip 48 + header ~46 + 1rem) across
two stuck-phase positions; 6 collapse sections render open; fixtures torn down (0 rows), temp spec
deleted. Probe lesson kept in the decision log: sticky/scroll probes must use REAL input — scripted
scrollTop on the wrong element passes and lies. Dev server restarted post-foundation; later edits
hot-reloaded and are what the passing probes measured.

## /review (high-risk tier, 5 lenses) — DONE 2026-08-02, all Confirmed findings FIXED

**Confirmed + fixed (8 + 4 hygiene):** ⚠ [High] `resolveOrgHomeHref` sat uncaught in the layout's
critical Promise.all — a DB blip would have 500'd the whole portal for every coach; now
`.catch(() => null)` (flip degrades to absent; tournament-layout parity; adjudicated main-loop after
two lenses disagreed — the "no exception path" claim was refuted by reading the resolver). ⚠ [High
a11y] TWO independent season switchers per archive page (masthead chip + Chunk F title chip, both
focusable, both openable) — masthead chip is now PRESENTATIONAL (year-only span; title chip stays
THE switcher; `CoachSeasonChip` label prop reverted as dead API). [Med] wall branch ran the same
resolver DB count twice → reuses `publicHref`. [Med] archive label fell back to `programYearName`
(stutter regression when `programYearYear` null) → year-only, bare "Complete" fallback. [Med]
deep-link `scrollIntoView('smooth')` overrode the global reduced-motion kill-switch (CSSOM: explicit
JS behavior wins) → preference honored. [Med] masthead `<header>`-in-`<main>` had NO landmark →
`role="banner"` (AdminEventHeader:137 parity, verified). [Med] Documents "Upload" button lost its
visible title context → `aria-label="Upload document"`. [Med+Low] stale `collapsed` on
breakpoint-entry mid-scroll and on team-switch → one evaluator run at attach + media-change + scroll.
Hygiene: roster stale width comment; `.teamHeader` CSS comment contradicting the scroll model;
collapse summary titles are now real `<h3>`s (`.collapseTitle` inherit-reset) for AT outline;
visually-hidden h2 → `clip-path: inset(50%)` (codebase convention).

**Refuted (recorded by the finders):** CoachRecordJumpNav masthead overlap (never mounts in the
premium portal); every other sticky/fixed element has its own real scroll container or is
position:fixed; anchored menus re-place via fixed+rect (scroll-model-safe); the practice page's
container "hunk" (already wide at HEAD — cross-session attribution noise).

**Accepted, not fixed:** masthead hydration pop-in (Suspense null fallback; vars carry 0px
fallbacks); phone deep-link landing offset if the bar collapses mid-smooth-scroll (cosmetic,
low-confidence); **pre-existing:** the profile rail's Guardian/Safety fields render ungated
client-side relying on server-side redaction — unchanged by this chunk (PII lens diff-verified every
gate byte-identical), flagged for a future hardening pass.

**PII lens verdict: zero findings** — every capability/redaction conditional on the player page
survived the restructure identically; collapse-mounted children introduce no new exposure because
gating sits OUTSIDE the details elements.

**Gate after fixes:** typecheck 0 · lint 0 errors · token ratchets ZERO · unit suite: the ONE failure
is the archive opt-in contract tripped by the CONCURRENT session's new tag/season routes (their
allow-list decision, not ours — this chunk adds no routes; that suite was green on our earlier run).

## Sequencing
1. Foundation (shared CSS + CoachTeamHeader + layout mount + collapse component) — main session.
2. Parallel: page-class sweep + season-end spread (main) · player-profile restructure (agent, diff-reviewed)
   · ExportMenu discovery (agent).
3. Gates + probes → dev restart → offer `/review` → owner QA → commit (per-action OK) → Option C addendum.
