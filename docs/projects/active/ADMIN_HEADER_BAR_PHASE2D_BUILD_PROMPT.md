# Build prompt — Admin header, Phase 2D: the desktop strip

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-08, after walk §492 passed (25/25) and the
> owner ruled round 4 (D1–D5) from the drawings the same day. Plan of record: `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`
> ("Round 4 · the desktop strip" and "Phase 2D"). Phase 3 waits for this: every Phase 3 screen names itself, and it
> should land in the strip once, not in the white bar's desktop row first.

---

Admin header: the bar names where you are — **Phase 2D, the desktop strip.** Product code. Desktop only (above 900px).

## Read first, in this order

1. `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`: "Round 4 · the desktop strip" (D1–D5, the gate question about
   "Admin"), the round 4 entries under "Rulings this knowingly departs from", **Phase 2D's checklist**, and the two
   round 4 Architectural Decisions. Skim Phase 2's as-built notes for the lessons.
2. The drawings: artifact https://claude.ai/artifact/A1W443obR8aJd8PjUZEgUx, **version 2** (source
   `docs/projects/active/ADMIN_HEADER_DESKTOP_STRIP_DRAWINGS.html`). Option **B** is the ruling. Use the switches:
   Screen (Overview, Rep teams, a team, a long tournament name), Sidebar (Open / Collapsed), Workspaces pill. Build to
   it. Options A and C are rejected; ignore them.
3. `components/admin/AdminTopStrip.tsx` and the stylesheet it shares with the coaches portal,
   `components/coaches/CoachTopStrip.module.css` (**shared: the portal must not change**).
4. `components/admin/AdminEventHeader.tsx` and `components/admin/kit/AdminKitEventHeader.module.css` (the bar; its
   desktop rules are the `min-width: 901px` block), `components/admin/AdminBarPlace.tsx`, and `clubPlaceAt` in
   `lib/admin-kit-nav.ts`.
5. `app/[orgSlug]/admin/AdminChrome.tsx` (where the strip, the fee banner and the bar mount, and where the place
   providers sit: the strip must be inside them to read the place), `app/[orgSlug]/admin/admin.module.css`
   (`--admin-topstrip-h`, `--admin-rail-w`, collapsed 64px).
6. `components/admin/kit/AdminKitRail.tsx`, `components/admin/kit/AdminKitFrame.module.css` (the rail is sticky under
   the strip), and the initials helper in `components/shared/SidebarStrip.tsx`.
7. `components/shared/HubTabBar.tsx` + its stylesheet (`inBar`; shared with the coaches portal).
8. `lib/workspace-labels.ts` (the shared "Admin Area" word) and `tests/unit/nav-standard-guard.test.ts`.

Broad reading and censuses go to a helper agent (CLAUDE.md). Check a helper's claims against the code before building on them.

## What this session changes (desktop, above 900px)

- **The strip splits on the sidebar's edge.** Left cell = `--admin-rail-w` wide (240; 64 collapsed): the wordmark, a
  divider, "Admin" (D4). Collapsed: the logo mark only. Right cell: the place, then View site, the bell, the account
  menu and the Workspaces pill. The place's name starts at the page column's left padding, so it sits exactly where
  the bar's name sits today (walk §492 call G: keep the full-width alignment). Height stays 48px.
- **The place in the strip**, from the same source the bar uses (one place model, two renderings):
  - A club place: back link + divider where there is one ("← Teams │"), the name (16px bold, one line, "…"), the
    season switcher on a season, the status chip. **No small line** (D1, D3: the club, the section and a team's group go).
  - Overview: "Overview" (D2).
  - A tournament: the event's name (a link to its dashboard, as today), its dates, its status chip. Truncation order:
    the name gives way first; the dates and chip never cut. The page's own title ("Teams") stays on the paper, as today.
  - Calendar, Schedules, record pages and anything else the bar does not name today: whatever the bar shows today
    (Phase 3 changes those).
- **One `<h1>` per width.** The strip's name is the `<h1>` on desktop and the bar's copy is `display: none`; the reverse
  on a phone. Inside a tournament the name stays a link and the paper title stays the `<h1>`. Check the layout sweep's
  `ready` waits still hold (Phase 1 lesson: a bar `<h1>` released `ready: 'h1'` before the body).
- **View site moves into the strip**, beside the bell. The phone keeps its globe in the bar. Keep the
  cancelled/suspended rule.
- **The tab band.** On desktop the bar keeps only its tab row, a white band pinned under the strip, with its bottom
  rule. A place without tabs (Overview, a tournament) renders no desktop bar at all. `--admin-header-h` follows
  (0 when there is no band): rerun Phase 2's sticky census on the six places and a tournament page. Anything that
  slides under the strip or leaves a gap is a defect.
- **The club cell**, first in the sidebar: the club's name (14px bold), a link to Overview (D5). **Its height is the tab
  band's height through one shared variable**, and its bottom rule lines up with the tab band's rule to the pixel. Same
  height on every screen, tabs or not, so the navigation never moves. The usual sidebar spacing sits under it before
  Overview. Collapsed: the club's initials. A tournament-only org: the org's name. A tournament inside a club: the club.
- **The gate question (ask before building):** "Admin" and the Workspaces list. The plan recommends a short-form
  constant beside `WORKSPACE_KIND_LABEL` in `lib/workspace-labels.ts`, with the guard pinning it and the Workspaces list
  keeping "Admin Area". The alternative is one word everywhere. Present both and let the owner pick.

**Not this session:** the phone (nothing changes at 900px or below; prove it), the coaches portal (pixel-identical),
Calendar / Schedules / record pages / tournament-only org naming (Phase 3), help rewrites beyond checking two lines.

## Gotchas

- **The split is CSS, at 900/901px**, like the bar, strip and rail today. No `matchMedia`: a JS switch paints the wrong
  rendering on the server's first paint and swaps (the flash Phase 2 removed).
- **The strip is `position: fixed`, full width, and zeroed at 900px and below.** The phone has no strip; the bar is the
  phone's only header. Keep it that way.
- **Shared stylesheets.** `CoachTopStrip.module.css` and `HubTabBar.module.css` serve the coaches portal. Add opt-in
  classes only. Measure the portal's strip and tab row before and after: identical.
- **Narrowest desktop is 901px.** The right cell is tightest there (240 for the left cell, then name, View site, bell,
  account, Workspaces). The name is the thing that gives way, never the buttons. Measure and report.
- **Collapsed sidebar** (`html[data-sidebar='strip']`, 64px): both the strip's left cell and the club cell follow
  `--admin-rail-w`. No hard-coded 240 anywhere new (`sidebar-strip-guard` pins one 240 and one 64).
- **Guards to rewrite (to the new rule; do not delete):** `admin-header-bar-guard` (desktop padding, small-line order,
  `.metaDesk`), `nav-standard-guard` (the portal word), `club-stage1-screens-guard` (`<h1>`/span), `club-stage13i-places-guard`
  and `admin-kit-nav.test` (the `inBar` line), `fee-overdue-banner` (banner before the header), `sidebar-strip-guard`,
  `admin-cancelled-one-page-guard`. Add one: the club cell and the tab band read the same height variable.
  `anonymous-public-invariant.spec.ts` asserts "Admin Area" never appears on public pages; keep it meaningful for the new word.
- **Type check** (`scripts/check-admin-type.mjs`): the small line leaves the desktop; do not raise the baseline or edit the script.
- **Layout checker:** `hidden-behind-chrome` counts only fixed top bars as chrome. The strip is fixed; the tab band is
  sticky. Check a place's own sticky parts (the draft board, a season's group heads) against both.
- **Shared working tree.** Other sessions have uncommitted hunks (`components/admin/kit/club/ClubHubKit.tsx`,
  `MembersKit.tsx`, `Teams.module.css`, `TODO.md`, the ledger, `memory/design_decisions.md`). Read the live file; change
  only your hunks. Stage explicit pathspecs; never `git add -A`.
- **Dates and times** only through `formatStoredDate` / `formatTime`. Gate: `npm run check:spelling`.
- **Dev server:** shared shell + component change, so restart before hand-off (AGENTS.md). Only `npm run dev`.

## Steps

1. Present the **product-manager UX summary** (blocking): what a club admin and a tournament organizer see differently on
   desktop; that the phone and the coaches portal do not change. Ask the "Admin" gate question. Then the task list.
2. Build. Then `npm run verify:changed`, `npm run typecheck`, `npm run check:spelling`, `npm run check:demos`, and
   `npm run check:layout --changed` on Overview, Rep teams, a team, a season, Accounting and a tournament page at 1440
   and 390 (dev server; never a whole-product sweep there).
3. **Measure and report:** the pinned height at 1440 × 760 on Rep teams, a team and a tournament (drawing: 93 / 93 / 48px,
   today 151 / 151 / 108); the club cell's rule vs the tab band's rule (same pixel, open and collapsed, 1440 and 1280);
   the 901px strip; the coaches portal strip + tab row before/after (identical); the phone bar before/after (identical).
4. `/design` on the built screens against round 4 v2; apply its fixes. Offer `/simplify` (a second rendering of the
   place is new duplication risk). Then `/review`.
5. Check the two help lines (`lib/help-content/org.tsx`, "View site, at the top right" and "the tabs under its title");
   offer `/docs` if either now reads wrong on desktop.
6. Write the owner walk as a checkable Artifact (QA ledger §, one purpose: the desktop strip), desktop-first, with a
   short phone check that nothing changed. Tick Phase 2D's boxes in the plan with what was built and the measurements;
   update the TODO.md line and project memory with the positive fact ("built 2026-MM-DD").
7. **Do not commit without asking me.** On my yes, the commit takes only this session's files, built in a private index
   on the current HEAD (see the memory note on partial commits).

## Done when

- Above 900px there is no white name bar: the place names itself in the strip, View site sits by the bell, the tabs are
  one pinned band, and the club's name heads the sidebar in a cell whose bottom rule meets the tab band's in one line.
- Overview's strip says "Overview"; a team shows "← Teams │ 14U AA" and its season chip, no group; a long tournament
  name is one line with "…" and its dates and chip intact.
- Clicking the club cell opens Overview. Collapsed, the cell shows initials and the rules still meet.
- The navigation never moves between screens with and without tabs.
- At 900px and below, and in the coaches portal, nothing changed (measured).
- No page has two `<h1>`s in the accessibility tree. Guards, typecheck, spelling, demos and the changed-screen layout
  check pass. `/design` and `/review` findings are applied or recorded.
